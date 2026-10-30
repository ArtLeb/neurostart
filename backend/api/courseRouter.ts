import { and, asc, count, eq } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery } from "./middleware";
import { authedQuery } from "./procedures";
import { getDb } from "./queries/connection";
import { courseAccess, courses, lessons, questions, quizAttempts, lessonProgress } from "@db/schema";
import { assertLessonAccess, completedLessonIds, courseLessons, findCourse, hasCourseAccess } from "./learning";

export const courseRouter = createRouter({
  list: publicQuery.query(async () => {
    const db = getDb();
    const items = await db.select().from(courses).where(eq(courses.isPublished, true))
      .orderBy(asc(courses.sortOrder), asc(courses.id));
    const totals = await db.select({ courseId: lessons.courseId, value: count() }).from(lessons).groupBy(lessons.courseId);
    return items.map((course) => ({
      ...course,
      lessonCount: Number(totals.find((row) => row.courseId === course.id)?.value || 0),
    }));
  }),

  my: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const all = await db.select().from(courses).where(eq(courses.isPublished, true)).orderBy(asc(courses.sortOrder), asc(courses.id));
    const access = await db.select().from(courseAccess).where(eq(courseAccess.userId, ctx.user.id));
    const result = [];
    for (const course of all) {
      if (course.accessType !== "free" && !access.some((item) => item.courseId === course.id) && ctx.user.role !== "admin") continue;
      const ordered = await courseLessons(course.id);
      const completed = await completedLessonIds(ctx.user.id, course.id);
      result.push({
        ...course,
        lessonCount: ordered.length,
        completedCount: completed.size,
        progress: ordered.length ? Math.round(completed.size / ordered.length * 100) : 0,
      });
    }
    return result;
  }),

  get: authedQuery.input(z.object({ slug: z.string().min(1) })).query(async ({ ctx, input }) => {
    const course = await findCourse(input.slug);
    const [ordered, completed, allowed] = await Promise.all([
      courseLessons(course.id),
      completedLessonIds(ctx.user.id, course.id),
      hasCourseAccess(ctx.user, course),
    ]);
    let previousCompleted = true;
    const items = ordered.map((lesson) => {
      const unlockedByProgress = lesson.isPreview || ctx.user.role === "admin" || previousCompleted;
      const locked = !(allowed || lesson.isPreview || ctx.user.role === "admin") || !unlockedByProgress;
      const isCompleted = completed.has(Number(lesson.id));
      previousCompleted = isCompleted;
      return {
        id: lesson.id,
        title: lesson.title,
        sortOrder: lesson.sortOrder,
        isPreview: lesson.isPreview,
        locked,
        completed: isCompleted,
      };
    });
    return {
      course,
      lessons: items,
      hasAccess: allowed,
      progress: ordered.length ? Math.round(completed.size / ordered.length * 100) : 0,
      completedCount: completed.size,
    };
  }),

  lesson: authedQuery.input(z.object({ slug: z.string(), lessonId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const course = await findCourse(input.slug);
    const [lesson] = await getDb().select().from(lessons).where(and(eq(lessons.id, input.lessonId), eq(lessons.courseId, course.id))).limit(1);
    if (!lesson) throw new TRPCError({ code: "NOT_FOUND", message: "Урок не найден" });
    await assertLessonAccess(ctx.user, course, lesson);
    const quiz = await getDb().select({ id: questions.id, prompt: questions.prompt, options: questions.options, sortOrder: questions.sortOrder })
      .from(questions).where(eq(questions.lessonId, lesson.id)).orderBy(asc(questions.sortOrder), asc(questions.id));
    return { lesson, questions: quiz };
  }),

  submitQuiz: authedQuery.input(z.object({
    slug: z.string(),
    lessonId: z.number().int().positive(),
    answers: z.record(z.string(), z.number().int().min(0).max(8)),
  })).mutation(async ({ ctx, input }) => {
    const db = getDb();
    const course = await findCourse(input.slug);
    const [lesson] = await db.select().from(lessons).where(and(eq(lessons.id, input.lessonId), eq(lessons.courseId, course.id))).limit(1);
    if (!lesson) throw new TRPCError({ code: "NOT_FOUND", message: "Урок не найден" });
    await assertLessonAccess(ctx.user, course, lesson);
    const quiz = await db.select().from(questions).where(eq(questions.lessonId, lesson.id)).orderBy(asc(questions.sortOrder), asc(questions.id));
    if (!quiz.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Для этого урока ещё не добавлены вопросы" });
    const correctCount = quiz.filter((question) => input.answers[String(question.id)] === question.correctOption).length;
    const score = Math.round(correctCount / quiz.length * 100);
    const passed = score >= lesson.passPercent;
    await db.transaction(async (tx) => {
      await tx.insert(quizAttempts).values({
        userId: ctx.user.id,
        lessonId: lesson.id,
        score,
        correctCount,
        totalQuestions: quiz.length,
        passed,
        answers: input.answers,
      });
      if (passed) {
        await tx.insert(lessonProgress).values({ userId: ctx.user.id, lessonId: lesson.id })
          .onDuplicateKeyUpdate({ set: { completedAt: new Date() } });
      }
    });
    const ordered = await courseLessons(course.id);
    const index = ordered.findIndex((item) => item.id === lesson.id);
    return {
      score,
      correctCount,
      totalQuestions: quiz.length,
      passed,
      passPercent: lesson.passPercent,
      nextLessonId: passed && index >= 0 ? ordered[index + 1]?.id || null : null,
    };
  }),
});
