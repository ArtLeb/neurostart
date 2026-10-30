import { eq } from "drizzle-orm";
import { getDb } from "./queries/connection";
import { courseAccess, paymentEvents, purchases } from "@db/schema";
import { qualifyReferralForPurchase } from "./referralService";

type YooPayment = {
  id: string;
  status: string;
  amount: { value: string; currency: string };
  metadata?: { purchaseId?: string | number };
};

function credentials() {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secretKey) throw new Error("ЮKassa ещё не настроена");
  return { shopId, secretKey };
}

export function paymentsConfigured() {
  return Boolean(process.env.YOOKASSA_SHOP_ID && process.env.YOOKASSA_SECRET_KEY);
}

export async function fetchYooKassaPayment(paymentId: string): Promise<YooPayment> {
  const { shopId, secretKey } = credentials();
  const response = await fetch(`https://api.yookassa.ru/v3/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${shopId}:${secretKey}`).toString("base64")}` },
  });
  if (!response.ok) throw new Error("Не удалось подтвердить статус платежа");
  return await response.json() as YooPayment;
}

export async function createYooKassaPayment(input: {
  purchaseId: number;
  userId: number;
  courseId: number;
  email: string;
  title: string;
  amount: number;
  method: "bank_card" | "sbp";
  returnUrl: string;
}) {
  const { shopId, secretKey } = credentials();
  const response = await fetch("https://api.yookassa.ru/v3/payments", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${shopId}:${secretKey}`).toString("base64")}`,
      "Content-Type": "application/json",
      "Idempotence-Key": `course-${input.purchaseId}`,
    },
    body: JSON.stringify({
      amount: { value: input.amount.toFixed(2), currency: "RUB" },
      capture: true,
      confirmation: { type: "redirect", return_url: input.returnUrl },
      payment_method_data: { type: input.method },
      description: `НЕЙРОСТАРТ: ${input.title}`.slice(0, 128),
      metadata: { purchaseId: input.purchaseId, userId: input.userId, courseId: input.courseId },
      receipt: {
        customer: { email: input.email },
        items: [{
          description: input.title.slice(0, 128),
          quantity: "1.00",
          amount: { value: input.amount.toFixed(2), currency: "RUB" },
          vat_code: Number(process.env.YOOKASSA_VAT_CODE || 1),
          payment_mode: "full_payment",
          payment_subject: "service",
        }],
      },
    }),
  });
  const data = await response.json() as any;
  if (!response.ok) throw new Error(data.description || "ЮKassa отклонила создание платежа");
  return data as YooPayment & { confirmation?: { confirmation_url?: string } };
}

export async function applyPaymentStatus(payment: YooPayment, rawEvent?: unknown) {
  const purchaseId = Number(payment.metadata?.purchaseId);
  if (!purchaseId) throw new Error("В платеже нет номера заказа");
  const db = getDb();
  const [purchase] = await db.select().from(purchases).where(eq(purchases.id, purchaseId)).limit(1);
  if (!purchase || purchase.externalPaymentId !== payment.id) throw new Error("Заказ не соответствует платежу");
  if (Math.abs(Number(payment.amount.value) - purchase.amount) > 0.001 || payment.amount.currency !== purchase.currency) {
    throw new Error("Сумма платежа не совпадает с заказом");
  }
  if (rawEvent) {
    const event = rawEvent as any;
    const eventId = String(event.event_id || event.id || `${payment.id}:${payment.status}`);
    await db.insert(paymentEvents).values({ provider: "yookassa", eventId, payload: rawEvent, processedAt: new Date() })
      .onDuplicateKeyUpdate({ set: { processedAt: new Date() } });
  }
  if (payment.status === "succeeded") {
    await db.transaction(async (tx) => {
      await tx.update(purchases).set({ status: "paid", paidAt: new Date() }).where(eq(purchases.id, purchase.id));
      await tx.insert(courseAccess).values({
        userId: purchase.userId,
        courseId: purchase.courseId,
        accessSource: "purchase",
        purchaseId: purchase.id,
      }).onDuplicateKeyUpdate({ set: { accessSource: "purchase", purchaseId: purchase.id } });
      await qualifyReferralForPurchase(tx, purchase.userId, purchase.id);
    });
  } else if (payment.status === "canceled") {
    await db.update(purchases).set({ status: "cancelled" }).where(eq(purchases.id, purchase.id));
  }
}
