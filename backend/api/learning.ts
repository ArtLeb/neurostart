import { and, asc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "./queries/connection";
import { courseAccess, courses, lessonProgress, lessons, type Course, type Lesson, type User } from "@db/schema";

export async function findCourse(slug: string, includeUnpublished = false) {
  const [course] = await getDb().select().from(courses).where(eq(courses.slug, slug)).limit(1);
  if (!course || (!includeUnpublished && !course.isPublished)) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Курс не найден" });
  }
  return course;
}

export async function hasCourseAccess(user: User, course: Course) {
  if (user.role === "admin" || course.accessType === "free") return true;
  const [access] = await getDb().select({ id: courseAccess.id }).from(courseAccess)
    .where(and(eq(courseAccess.userId, user.id), eq(courseAccess.courseId, course.id))).limit(1);
  return Boolean(access);
}

export async function courseLessons(courseId: number) {
  return getDb().select().from(lessons).where(eq(lessons.courseId, courseId))
    .orderBy(asc(lessons.sortOrder), asc(lessons.id));
}

export async function completedLessonIds(userId: number, courseId: number) {
  const rows = await getDb().select({ lessonId: lessonProgress.lessonId }).from(lessonProgress)
    .innerJoin(lessons, eq(lessons.id, lessonProgress.lessonId))
    .where(and(eq(lessonProgress.userId, userId), eq(lessons.courseId, courseId)));
  return new Set(rows.map((row) => Number(row.lessonId)));
}

export async function assertLessonAccess(user: User, course: Course, lesson: Lesson) {
  const allowed = await hasCourseAccess(user, course);
  if (!allowed && !lesson.isPreview) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Этот урок доступен после покупки курса" });
  }
  if (user.role === "admin") return;
  const ordered = await courseLessons(course.id);
  const index = ordered.findIndex((item) => item.id === lesson.id);
  if (index > 0) {
    const completed = await completedLessonIds(user.id, course.id);
    if (!completed.has(Number(ordered[index - 1].id))) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Сначала пройдите проверку предыдущего урока на 80% или выше" });
    }
  }
}
