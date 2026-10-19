import {
  courses,
  enrollments,
  getCourseProgressSummary,
  getUserCoursesProgress,
  lessonProgress,
  lessons,
  modules,
  user,
} from "@lagan/db";
import type { CourseProgressSummary } from "@lagan/db";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../../lib/db";

export interface EnrolledCourseItem {
  id: string;
  title: string;
  description: string | null;
  authorName: string;
  tenantId: string;
  enrolledAt: Date;
  progress: CourseProgressSummary;
  resumeHref: string;
  resumeLessonId: string | null;
  resumeLessonTitle: string | null;
  actionLabel: string;
}

export interface LessonProgressRow {
  lessonId: string;
  lessonTitle: string;
  completed: boolean | null;
  positionSeconds: number | null;
  lastSeenAt: Date | null;
}

/** Better Auth owns the user table; this column reference reaches its name cleanly. */
const authorNameSql = sql<string>`coalesce(${user}."name", 'Unknown author')`;

/**
 * Resolves the direct resume link and action label for an enrolled course.
 *
 * Behavior:
 * 1. If the course has no published lessons -> link to the course catalogue details (/courses/:id).
 * 2. If all lessons are completed -> link to the first lesson (/courses/:id/lessons/:id) with "Review Course".
 * 3. If there are incomplete lessons:
 *    a. If any incomplete lesson has prior activity (lastSeenAt or positionSeconds > 0), deep-link to the most recently active lesson.
 *    b. Otherwise, deep-link to the first incomplete lesson in sequential course order.
 */
export function resolveResumeLesson(
  courseId: string,
  courseLessons: LessonProgressRow[],
): {
  resumeLessonId: string | null;
  resumeHref: string;
  resumeLessonTitle: string | null;
  actionLabel: string;
} {
  if (courseLessons.length === 0) {
    return {
      resumeLessonId: null,
      resumeHref: `/courses/${courseId}`,
      resumeLessonTitle: null,
      actionLabel: "View Course",
    };
  }

  const incompleteLessons = courseLessons.filter((l) => !l.completed);

  if (incompleteLessons.length === 0) {
    const firstLesson = courseLessons[0];
    if (!firstLesson) {
      return {
        resumeLessonId: null,
        resumeHref: `/courses/${courseId}`,
        resumeLessonTitle: null,
        actionLabel: "View Course",
      };
    }
    return {
      resumeLessonId: firstLesson.lessonId,
      resumeHref: `/courses/${courseId}/lessons/${firstLesson.lessonId}`,
      resumeLessonTitle: firstLesson.lessonTitle,
      actionLabel: "Review Course",
    };
  }

  const touchedIncomplete = incompleteLessons.filter(
    (l) => l.lastSeenAt !== null || (l.positionSeconds !== null && l.positionSeconds > 0),
  );

  let targetLesson: LessonProgressRow | undefined;

  if (touchedIncomplete.length > 0) {
    touchedIncomplete.sort((a, b) => {
      const timeA = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
      const timeB = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
      return timeB - timeA;
    });
    targetLesson = touchedIncomplete[0];
  } else {
    targetLesson = incompleteLessons[0];
  }

  if (!targetLesson) {
    return {
      resumeLessonId: null,
      resumeHref: `/courses/${courseId}`,
      resumeLessonTitle: null,
      actionLabel: "View Course",
    };
  }

  return {
    resumeLessonId: targetLesson.lessonId,
    resumeHref: `/courses/${courseId}/lessons/${targetLesson.lessonId}`,
    resumeLessonTitle: targetLesson.lessonTitle,
    actionLabel: "Continue Learning",
  };
}

/**
 * Queries all courses the authenticated user is enrolled in, aggregates their
 * progress summary using DB helpers, and calculates the next lesson resume deep link.
 */
export async function listEnrolledCourses(
  userId: string,
  database = db,
): Promise<EnrolledCourseItem[]> {
  if (!userId) {
    return [];
  }

  const enrolledRows = await database
    .select({
      id: courses.id,
      title: courses.title,
      description: courses.description,
      tenantId: courses.tenantId,
      status: courses.status,
      enrolledAt: enrollments.enrolledAt,
      authorName: authorNameSql,
    })
    .from(enrollments)
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .leftJoin(user, eq(user.id, courses.authorId))
    .where(eq(enrollments.userId, userId))
    .orderBy(desc(enrollments.enrolledAt), desc(courses.updatedAt));

  if (enrolledRows.length === 0) {
    return [];
  }

  const targetCourseIds = enrolledRows.map((r) => r.id);

  // Group by tenant to accurately call multi-tenant getUserCoursesProgress helper
  const coursesByTenant = new Map<string, string[]>();
  for (const row of enrolledRows) {
    const list = coursesByTenant.get(row.tenantId) ?? [];
    list.push(row.id);
    coursesByTenant.set(row.tenantId, list);
  }

  const progressSummaryMap = new Map<string, CourseProgressSummary>();
  await Promise.all(
    Array.from(coursesByTenant.entries()).map(async ([tenantId, courseIds]) => {
      const progressList = await getUserCoursesProgress(database, {
        userId,
        tenantId,
        courseIds,
        round: true,
      });
      for (const prog of progressList) {
        progressSummaryMap.set(
          prog.courseId,
          getCourseProgressSummary(prog.completedLessons, prog.totalLessons, {
            courseId: prog.courseId,
            round: true,
          }),
        );
      }
    }),
  );

  // Fetch all published lessons and user progress for enrolled courses to compute resume positions
  const lessonRows = await database
    .select({
      courseId: modules.courseId,
      lessonId: lessons.id,
      lessonTitle: lessons.title,
      modulePosition: modules.position,
      lessonPosition: lessons.position,
      completed: lessonProgress.completed,
      positionSeconds: lessonProgress.positionSeconds,
      lastSeenAt: lessonProgress.lastSeenAt,
    })
    .from(lessons)
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .leftJoin(
      lessonProgress,
      and(
        eq(lessonProgress.lessonId, lessons.id),
        eq(lessonProgress.userId, userId),
      ),
    )
    .where(
      and(
        inArray(modules.courseId, targetCourseIds),
        eq(lessons.status, "published"),
      ),
    )
    .orderBy(
      asc(modules.courseId),
      asc(modules.position),
      asc(lessons.position),
      asc(lessons.id),
    );

  const lessonsByCourse = new Map<string, LessonProgressRow[]>();
  for (const row of lessonRows) {
    const existing = lessonsByCourse.get(row.courseId) ?? [];
    existing.push({
      lessonId: row.lessonId,
      lessonTitle: row.lessonTitle,
      completed: row.completed,
      positionSeconds: row.positionSeconds,
      lastSeenAt: row.lastSeenAt,
    });
    lessonsByCourse.set(row.courseId, existing);
  }

  return enrolledRows.map((course) => {
    const progress =
      progressSummaryMap.get(course.id) ??
      getCourseProgressSummary(0, 0, { courseId: course.id, round: true });
    const courseLessons = lessonsByCourse.get(course.id) ?? [];
    const resumeInfo = resolveResumeLesson(course.id, courseLessons);

    return {
      id: course.id,
      title: course.title,
      description: course.description,
      authorName: course.authorName,
      tenantId: course.tenantId,
      enrolledAt: course.enrolledAt,
      progress,
      ...resumeInfo,
    };
  });
}
