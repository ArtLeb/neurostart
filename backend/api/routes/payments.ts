import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { applyPaymentStatus, fetchYooKassaPayment } from "../payments";

export const paymentRoutes = new Hono();

paymentRoutes.post(
  "/yookassa/webhook",
  bodyLimit({ maxSize: 256 * 1024, onError: (c) => c.body(null, 413) }),
  async (c) => {
    const event = await c.req.json().catch(() => null) as any;
    const paymentId = event?.object?.id;
    if (!paymentId) return c.json({ error: "Invalid notification" }, 400);
    try {
      const payment = await fetchYooKassaPayment(paymentId);
      await applyPaymentStatus(payment, event);
      return c.json({ ok: true });
    } catch {
      return c.json({ error: "Payment verification failed" }, 400);
    }
  },
);
