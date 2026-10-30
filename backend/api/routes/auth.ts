import { Hono, type Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { count, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../queries/connection";
import { referrals, users, type User } from "@db/schema";
import { COOKIE_NAME, MAX_AGE, createToken, getSessionUser, hashPassword, publicUser, verifyPassword } from "../auth";
import { uniqueReferralCode } from "../referralService";

const credentials = z.object({
  email: z.string().trim().email("Введите корректную почту").max(320),
  password: z.string().min(8, "Пароль должен содержать минимум 8 символов").max(128),
  displayName: z.string().trim().max(160).optional(),
  referralCode: z.string().trim().max(32).optional(),
});

export const authRoutes = new Hono();

function setSession(c: Context, user: User) {
  const token = createToken(user);
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

authRoutes.post("/register", async (c) => {
  const parsed = credentials.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message || "Проверьте данные" }, 400);
  const email = parsed.data.email.toLowerCase();
  const db = getDb();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return c.json({ error: "Аккаунт с такой почтой уже существует" }, 409);
  const invitationCode = parsed.data.referralCode?.toUpperCase();
  let referrer: { id: number } | undefined;
  if (invitationCode) {
    [referrer] = await db.select({ id: users.id }).from(users).where(eq(users.referralCode, invitationCode)).limit(1);
    if (!referrer) return c.json({ error: "Приглашение недействительно. Попросите владельца отправить новую ссылку" }, 400);
  }
  const id = await db.transaction(async (tx) => {
    const [{ value: total }] = await tx.select({ value: count() }).from(users);
    const role = Number(total) === 0 ? "admin" : "student";
    const referralCode = await uniqueReferralCode(tx);
    const [{ id: userId }] = await tx.insert(users).values({
      email,
      passwordHash: hashPassword(parsed.data.password),
      displayName: parsed.data.displayName || null,
      role,
      referralCode,
      referredByUserId: referrer?.id || null,
    }).$returningId();
    if (referrer) await tx.insert(referrals).values({ referrerUserId: referrer.id, referredUserId: userId });
    return userId;
  });
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  setSession(c, user);
  return c.json({ user: publicUser(user), firstAdmin: user.role === "admin" }, 201);
});

authRoutes.post("/login", async (c) => {
  const parsed = credentials.pick({ email: true, password: true }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Введите почту и пароль" }, 400);
  const [user] = await getDb().select().from(users).where(eq(users.email, parsed.data.email.toLowerCase())).limit(1);
  if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
    return c.json({ error: "Неверная почта или пароль" }, 401);
  }
  setSession(c, user);
  return c.json({ user: publicUser(user) });
});

authRoutes.post("/logout", async (c) => {
  deleteCookie(c, COOKIE_NAME, { path: "/" });
  return c.json({ ok: true });
});

authRoutes.get("/me", async (c) => {
  const user = await getSessionUser(c.req.raw);
  return c.json({ user: user ? publicUser(user) : null });
});
