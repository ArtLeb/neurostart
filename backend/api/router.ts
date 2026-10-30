import { createRouter, publicQuery } from "./middleware";
import { courseRouter } from "./courseRouter";
import { paymentRouter } from "./paymentRouter";
import { adminRouter } from "./adminRouter";
import { referralRouter } from "./referralRouter";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  course: courseRouter,
  payment: paymentRouter,
  referral: referralRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
