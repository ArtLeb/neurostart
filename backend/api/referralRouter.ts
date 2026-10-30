import { and, asc, count, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter } from "./middleware";
import { authedQuery } from "./procedures";
import { getDb } from "./queries/connection";
import { courseAccess, courses, referrals, referralRewards, users } from "@db/schema";
import { ensureReferralCode, REFERRALS_PER_REWARD, syncReferralRewards } from "./referralService";

export const referralRouter = createRouter({
  me: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const referralCode = await ensureReferralCode(ctx.user.id);
    await syncReferralRewards(ctx.user.id);
    const [totals] = await db.select({
      total: count(),
    }).from(referrals).where(eq(referrals.referrerUserId, ctx.user.id));
    const [qualifiedRow] = await db.select({ value: count() }).from(referrals)
      .where(and(eq(referrals.referrerUserId, ctx.user.id), eq(referrals.status, "qualified")));
    const invited = await db.select({
      id: referrals.id,
      displayName: users.displayName,
      status: referrals.status,
      createdAt: referrals.createdAt,
      qualifiedAt: referrals.qualifiedAt,
    }).from(referrals).innerJoin(users, eq(users.id, referrals.referredUserId))
      .where(eq(referrals.referrerUserId, ctx.user.id)).orderBy(desc(referrals.id)).limit(20);
    const rewards = await db.select({
      id: referralRewards.id,
      rewardNumber: referralRewards.rewardNumber,
      status: referralRewards.status,
      courseId: referralRewards.courseId,
      courseTitle: courses.title,
      courseSlug: courses.slug,
      createdAt: referralRewards.createdAt,
      claimedAt: referralRewards.claimedAt,
    }).from(referralRewards).leftJoin(courses, eq(courses.id, referralRewards.courseId))
      .where(eq(referralRewards.userId, ctx.user.id)).orderBy(asc(referralRewards.rewardNumber));
    const giftCourses = await db.select({
      id: courses.id,
      slug: courses.slug,
      title: courses.title,
      price: courses.price,
    }).from(courses).where(and(
      eq(courses.accessType, "paid"),
      eq(courses.isPublished, true),
      eq(courses.allowAsGift, true),
    )).orderBy(asc(courses.sortOrder), asc(courses.id));
    const access = await db.select({ courseId: courseAccess.courseId }).from(courseAccess).where(eq(courseAccess.userId, ctx.user.id));
    const qualified = Number(qualifiedRow?.value || 0);
    return {
      referralCode,
      required: REFERRALS_PER_REWARD,
      total: Number(totals?.total || 0),
      qualified,
      remaining: REFERRALS_PER_REWARD - qualified % REFERRALS_PER_REWARD,
      invited,
      rewards,
      giftCourses: giftCourses.map((course) => ({ ...course, hasAccess: access.some((item) => item.courseId === course.id) })),
    };
  }),

  claim: authedQuery.input(z.object({
    rewardId: z.number().int().positive(),
    courseId: z.number().int().positive(),
  })).mutation(async ({ ctx, input }) => {
    const db = getDb();
    return db.transaction(async (tx) => {
      const [reward] = await tx.select().from(referralRewards).where(and(
        eq(referralRewards.id, input.rewardId),
        eq(referralRewards.userId, ctx.user.id),
        eq(referralRewards.status, "available"),
      )).limit(1);
      if (!reward) throw new TRPCError({ code: "NOT_FOUND", message: "Награда уже использована или ещё не доступна" });
      const [course] = await tx.select().from(courses).where(and(
        eq(courses.id, input.courseId),
        eq(courses.accessType, "paid"),
        eq(courses.isPublished, true),
        eq(courses.allowAsGift, true),
      )).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND", message: "Этот курс нельзя выбрать в подарок" });
      const [existingAccess] = await tx.select({ id: courseAccess.id }).from(courseAccess).where(and(
        eq(courseAccess.userId, ctx.user.id),
        eq(courseAccess.courseId, course.id),
      )).limit(1);
      if (existingAccess) throw new TRPCError({ code: "CONFLICT", message: "Этот курс уже есть в вашем кабинете. Выберите другой" });
      const updated = await tx.update(referralRewards).set({
        status: "claimed",
        courseId: course.id,
        claimedAt: new Date(),
      }).where(and(eq(referralRewards.id, reward.id), eq(referralRewards.status, "available")));
      if (!Number(updated[0]?.affectedRows)) {
        throw new TRPCError({ code: "CONFLICT", message: "Награда уже использована" });
      }
      await tx.insert(courseAccess).values({
        userId: ctx.user.id,
        courseId: course.id,
        accessSource: "gift",
      }).onDuplicateKeyUpdate({ set: { userId: ctx.user.id } });
      return { ok: true as const, courseSlug: course.slug, courseTitle: course.title };
    });
  }),
});
