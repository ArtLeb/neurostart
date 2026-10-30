import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter } from "./middleware";
import { authedQuery } from "./procedures";
import { getDb } from "./queries/connection";
import { courseAccess, courses, purchases } from "@db/schema";
import { applyPaymentStatus, createYooKassaPayment, fetchYooKassaPayment, paymentsConfigured } from "./payments";

export const paymentRouter = createRouter({
  configured: authedQuery.query(() => ({ configured: paymentsConfigured() })),

  create: authedQuery.input(z.object({
    slug: z.string(),
    method: z.enum(["bank_card", "sbp"]),
  })).mutation(async ({ ctx, input }) => {
    if (!paymentsConfigured()) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Оплата будет доступна после подключения ключей магазина ЮKassa" });
    }
    const db = getDb();
    const [course] = await db.select().from(courses).where(eq(courses.slug, input.slug)).limit(1);
    if (!course || !course.isPublished || course.accessType !== "paid") {
      throw new TRPCError({ code: "NOT_FOUND", message: "Платный курс не найден" });
    }
    const [access] = await db.select().from(courseAccess).where(and(eq(courseAccess.userId, ctx.user.id), eq(courseAccess.courseId, course.id))).limit(1);
    if (access) return { alreadyPaid: true as const, confirmationUrl: null };
    const [{ id: purchaseId }] = await db.insert(purchases).values({
      userId: ctx.user.id,
      courseId: course.id,
      amount: course.price,
      paymentProvider: "yookassa",
      paymentMethod: input.method,
    }).$returningId();
    try {
      const origin = process.env.PUBLIC_APP_URL || new URL(ctx.req.url).origin;
      const payment = await createYooKassaPayment({
        purchaseId,
        userId: ctx.user.id,
        courseId: course.id,
        email: ctx.user.email,
        title: course.title,
        amount: course.price,
        method: input.method,
        returnUrl: `${origin}/payment/return?purchase=${purchaseId}`,
      });
      await db.update(purchases).set({ externalPaymentId: payment.id }).where(eq(purchases.id, purchaseId));
      if (!payment.confirmation?.confirmation_url) throw new Error("ЮKassa не вернула страницу оплаты");
      return { alreadyPaid: false as const, confirmationUrl: payment.confirmation.confirmation_url };
    } catch (error) {
      await db.update(purchases).set({ status: "cancelled" }).where(eq(purchases.id, purchaseId));
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Не удалось создать платёж" });
    }
  }),

  status: authedQuery.input(z.object({ purchaseId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const db = getDb();
    const [purchase] = await db.select().from(purchases).where(and(eq(purchases.id, input.purchaseId), eq(purchases.userId, ctx.user.id))).limit(1);
    if (!purchase) throw new TRPCError({ code: "NOT_FOUND", message: "Заказ не найден" });
    if (purchase.status === "pending" && purchase.externalPaymentId && paymentsConfigured()) {
      const payment = await fetchYooKassaPayment(purchase.externalPaymentId);
      await applyPaymentStatus(payment);
    }
    const [updated] = await db.select().from(purchases).where(eq(purchases.id, purchase.id)).limit(1);
    const [course] = await db.select({ slug: courses.slug, title: courses.title }).from(courses).where(eq(courses.id, purchase.courseId)).limit(1);
    return { purchase: updated, course };
  }),
});
