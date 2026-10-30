import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { createRouter } from "./middleware";
import { adminQuery } from "./procedures";
import { getDb } from "./queries/connection";
import { courseAccess, courses, lessonProgress, lessons, purchases, questions, users } from "@db/schema";

const courseInput = z.object({
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/, "Только латинские буквы, цифры и дефис"),
  title: z.string().trim().min(2).max(255),
  description: z.string().trim().max(5000),
  level: z.string().trim().min(1).max(80),
  price: z.number().int().min(0).max(10000000),
  accessType: z.enum(["free", "paid"]),
  isPublished: z.boolean(),
  sortOrder: z.number().int().min(0).max(10000),
});

const lessonInput = z.object({
  courseId: z.number().int().positive(),
  title: z.string().trim().min(2).max(255),
  content: z.string().max(200000),
  videoUrl: z.string().trim().max(2000).refine((value) => !value || /^https:\/\//.test(value) || /^\/[a-zA-Z0-9_./-]+$/.test(value), "Укажите HTTPS-ссылку или локальный путь вида /videos/lesson.mp4"),
  sortOrder: z.number().int().min(0).max(10000),
  isPreview: z.boolean(),
  passPercent: z.number().int().min(1).max(100),
});

const questionInput = z.object({
  lessonId: z.number().int().positive(),
  prompt: z.string().trim().min(3).max(5000),
  options: z.array(z.string().trim().min(1).max(1000)).min(2).max(6),
  correctOption: z.number().int().min(0),
  sortOrder: z.number().int().min(0).max(10000),
}).superRefine((value, ctx) => {
  if (value.correctOption >= value.options.length) ctx.addIssue({ code: "custom", message: "Правильный ответ выбран неверно" });
});

export const adminRouter = createRouter({
  overview: adminQuery.query(async () => {
    const db = getDb();
    const studentRows = await db.select({ id: users.id }).from(users).where(eq(users.role, "student"));
    const courseRows = await db.select({ id: courses.id }).from(courses);
    const purchaseRows = await db.select({ status: purchases.status, amount: purchases.amount }).from(purchases);
    return {
      students: studentRows.length,
      courses: courseRows.length,
      paidPurchases: purchaseRows.filter((item) => item.status === "paid").length,
      revenue: purchaseRows.filter((item) => item.status === "paid").reduce((total, item) => total + item.amount, 0),
    };
  }),

  students: adminQuery.query(async () => {
    const db = getDb();
    const [people, allCourses, progress, access, payments] = await Promise.all([
      db.select({ id: users.id, email: users.email, displayName: users.displayName, role: users.role, createdAt: users.createdAt }).from(users).orderBy(desc(users.id)).limit(500),
      db.select().from(courses),
      db.select({ userId: lessonProgress.userId, lessonId: lessonProgress.lessonId, courseId: lessons.courseId }).from(lessonProgress).innerJoin(lessons, eq(lessons.id, lessonProgress.lessonId)),
      db.select().from(courseAccess),
      db.select().from(purchases),
    ]);
    return people.map((person) => {
      const relevantIds = new Set([
        ...access.filter((item) => item.userId === person.id).map((item) => item.courseId),
        ...progress.filter((item) => item.userId === person.id).map((item) => item.courseId),
      ]);
      const studentCourses = allCourses.filter((course) => relevantIds.has(course.id)).map((course) => ({
        id: course.id,
        title: course.title,
        completed: progress.filter((item) => item.userId === person.id && item.courseId === course.id).length,
      }));
      return {
        ...person,
        totalPaid: payments.filter((item) => item.userId === person.id && item.status === "paid").reduce((total, item) => total + item.amount, 0),
        courses: studentCourses,
      };
    });
  }),

  studentCourses: adminQuery.input(z.object({ userId: z.number().int().positive() })).query(async ({ input }) => {
    const db = getDb();
    const allLessons = await db.select().from(lessons);
    const progress = await db.select({ lessonId: lessonProgress.lessonId }).from(lessonProgress).where(eq(lessonProgress.userId, input.userId));
    const completed = new Set(progress.map((item) => Number(item.lessonId)));
    const access = await db.select().from(courseAccess).where(eq(courseAccess.userId, input.userId));
    const startedCourseIds = new Set(allLessons.filter((lesson) => completed.has(Number(lesson.id))).map((lesson) => lesson.courseId));
    const allCourses = await db.select().from(courses);
    return allCourses.filter((course) => access.some((item) => item.courseId === course.id) || startedCourseIds.has(course.id)).map((course) => {
      const total = allLessons.filter((lesson) => lesson.courseId === course.id).length;
      const done = allLessons.filter((lesson) => lesson.courseId === course.id && completed.has(Number(lesson.id))).length;
      return { ...course, totalLessons: total, completedLessons: done, progress: total ? Math.round(done / total * 100) : 0 };
    });
  }),

  courses: adminQuery.query(async () => {
    const db = getDb();
    const allCourses = await db.select().from(courses).orderBy(asc(courses.sortOrder), asc(courses.id));
    const allLessons = await db.select().from(lessons).orderBy(asc(lessons.sortOrder), asc(lessons.id));
    const allQuestions = await db.select({ id: questions.id, lessonId: questions.lessonId }).from(questions);
    return allCourses.map((course) => ({
      ...course,
      lessons: allLessons.filter((lesson) => lesson.courseId === course.id).map((lesson) => ({
        ...lesson,
        questionCount: allQuestions.filter((question) => question.lessonId === lesson.id).length,
      })),
    }));
  }),

  createCourse: adminQuery.input(courseInput).mutation(async ({ input }) => {
    const [{ id }] = await getDb().insert(courses).values({ ...input, currency: "RUB" }).$returningId();
    return { id };
  }),
  updateCourse: adminQuery.input(courseInput.extend({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    const { id, ...values } = input;
    await getDb().update(courses).set(values).where(eq(courses.id, id));
    return { ok: true };
  }),
  createLesson: adminQuery.input(lessonInput).mutation(async ({ input }) => {
    const [{ id }] = await getDb().insert(lessons).values({ ...input, videoUrl: input.videoUrl || null }).$returningId();
    return { id };
  }),
  updateLesson: adminQuery.input(lessonInput.extend({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    const { id, ...values } = input;
    await getDb().update(lessons).set({ ...values, videoUrl: values.videoUrl || null }).where(eq(lessons.id, id));
    return { ok: true };
  }),
  deleteLesson: adminQuery.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    await getDb().delete(lessons).where(eq(lessons.id, input.id));
    return { ok: true };
  }),
  lessonQuestions: adminQuery.input(z.object({ lessonId: z.number().int().positive() })).query(async ({ input }) => {
    return getDb().select().from(questions).where(eq(questions.lessonId, input.lessonId)).orderBy(asc(questions.sortOrder), asc(questions.id));
  }),
  createQuestion: adminQuery.input(questionInput).mutation(async ({ input }) => {
    const [{ id }] = await getDb().insert(questions).values(input).$returningId();
    return { id };
  }),
  updateQuestion: adminQuery.input(questionInput.extend({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    const { id, ...values } = input;
    await getDb().update(questions).set(values).where(eq(questions.id, id));
    return { ok: true };
  }),
  deleteQuestion: adminQuery.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    await getDb().delete(questions).where(eq(questions.id, input.id));
    return { ok: true };
  }),
  purchases: adminQuery.query(async () => {
    const db = getDb();
    const rows = await db.select({
      id: purchases.id, status: purchases.status, amount: purchases.amount, createdAt: purchases.createdAt,
      paidAt: purchases.paidAt, paymentMethod: purchases.paymentMethod, email: users.email, courseTitle: courses.title,
    }).from(purchases).innerJoin(users, eq(users.id, purchases.userId)).innerJoin(courses, eq(courses.id, purchases.courseId)).orderBy(desc(purchases.id)).limit(500);
    return rows;
  }),
  grantAccess: adminQuery.input(z.object({ userId: z.number().int().positive(), courseId: z.number().int().positive() })).mutation(async ({ input }) => {
    await getDb().insert(courseAccess).values({ ...input, accessSource: "admin" })
      .onDuplicateKeyUpdate({ set: { accessSource: "admin" } });
    return { ok: true };
  }),
});
