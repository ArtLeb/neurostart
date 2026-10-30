import { TRPCError } from "@trpc/server";
import { publicQuery } from "./middleware";
import { getSessionUser } from "./auth";

export const authedQuery = publicQuery.use(async ({ ctx, next }) => {
  const user = await getSessionUser(ctx.req);
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Войдите в аккаунт, чтобы продолжить" });
  return next({ ctx: { ...ctx, user } });
});

export const adminQuery = authedQuery.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Нужны права администратора" });
  }
  return next({ ctx });
});
