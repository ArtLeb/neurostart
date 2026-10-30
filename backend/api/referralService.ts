import { randomBytes } from "node:crypto";
import { and, count, eq, isNull } from "drizzle-orm";
import { getDb } from "./queries/connection";
import { referrals, referralRewards, users } from "@db/schema";

export const REFERRALS_PER_REWARD = 10;

type Database = ReturnType<typeof getDb>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Executor = Database | Transaction;

export function makeReferralCode() {
  return randomBytes(6).toString("hex").toUpperCase();
}

export async function uniqueReferralCode(executor: Executor) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = makeReferralCode();
    const [existing] = await executor.select({ id: users.id }).from(users).where(eq(users.referralCode, code)).limit(1);
    if (!existing) return code;
  }
  throw new Error("Не удалось создать реферальный код");
}

export async function ensureReferralCode(userId: number) {
  const db = getDb();
  const [user] = await db.select({ id: users.id, referralCode: users.referralCode }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error("Пользователь не найден");
  if (user.referralCode) return user.referralCode;
  const code = await uniqueReferralCode(db);
  await db.update(users).set({ referralCode: code }).where(and(eq(users.id, userId), isNull(users.referralCode)));
  const [updated] = await db.select({ referralCode: users.referralCode }).from(users).where(eq(users.id, userId)).limit(1);
  return updated?.referralCode || code;
}

export async function syncReferralRewards(userId: number, executor: Executor = getDb()) {
  const [row] = await executor.select({ value: count() }).from(referrals)
    .where(and(eq(referrals.referrerUserId, userId), eq(referrals.status, "qualified")));
  const earned = Math.floor(Number(row?.value || 0) / REFERRALS_PER_REWARD);
  for (let rewardNumber = 1; rewardNumber <= earned; rewardNumber += 1) {
    await executor.insert(referralRewards).values({ userId, rewardNumber })
      .onDuplicateKeyUpdate({ set: { rewardNumber } });
  }
  return earned;
}

export async function qualifyReferralForPurchase(executor: Transaction, referredUserId: number, purchaseId: number) {
  const [referral] = await executor.select().from(referrals).where(eq(referrals.referredUserId, referredUserId)).limit(1);
  if (!referral || referral.status === "reversed") return;
  if (referral.status === "pending") {
    await executor.update(referrals).set({
      status: "qualified",
      qualifiedPurchaseId: purchaseId,
      qualifiedAt: new Date(),
    }).where(and(eq(referrals.id, referral.id), eq(referrals.status, "pending")));
  }
  await syncReferralRewards(referral.referrerUserId, executor);
}
