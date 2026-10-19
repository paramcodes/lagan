"use server";

import {
  type Course,
  type CourseEventType,
  type CourseStatus,
  courseEvent,
  courses,
  lessons,
  modules,
} from "@lagan/db";
import { and, asc, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "../../../../../../lib/auth";
import { db } from "../../../../../../lib/db";
import { RateLimitError, checkRateLimit } from "../../../../../../lib/rate-limit";
export interface PublishPreflightResult {
  valid: boolean;
  errors: string[];
}

export type PublishCourseResult =
  | {
      success: true;
      course: Course;
      isVersionBump: boolean;
      version: number;
    }
  | {
      success: false;
      errors: string[];
    };

export type CourseMutationResult = {
  success: true;
  course: Course;
};

async function requireUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

async function assertCourseOwned(courseId: string, authorId: string): Promise<Course> {
  const [course] = await db
    .select()
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.authorId, authorId)))
    .limit(1);

  if (!course) {
    throw new Error("Course not found");
  }
  return course;
}

const courseIdInputSchema = z.union([
  z.string().trim().min(1, "Course ID is required"),
  z.object({ id: z.string().trim().min(1, "Course ID is required") }).strict(),
]);

function resolveCourseId(input: string | { id: string }): string {
  const parsed = courseIdInputSchema.parse(input);
  return typeof parsed === "string" ? parsed : parsed.id;
}

/**
 * Validates whether a course satisfies all requirements for publication:
 * 1. Has at least one module.
 * 2. Each module contains at least one published lesson.
 * 3. Every published lesson has required content for its type:
 *    - video: muxPlaybackId
 *    - text: contentJson
 *    - quiz: contentJson
 *    - file: fileKey
 *    - external: externalUrl
 */
async function runPreflight(courseId: string): Promise<PublishPreflightResult> {
  const errors: string[] = [];

  const moduleRows = await db
    .select()
    .from(modules)
    .where(eq(modules.courseId, courseId))
    .orderBy(asc(modules.position));

  if (moduleRows.length === 0) {
    errors.push("Course must have at least one module.");
    return { valid: false, errors };
  }

  const moduleIds = moduleRows.map((m) => m.id);
  const lessonRows = await db
    .select()
    .from(lessons)
    .where(inArray(lessons.moduleId, moduleIds))
    .orderBy(asc(lessons.position));

  const lessonsByModule = new Map<string, typeof lessonRows>();
  for (const mod of moduleRows) {
    lessonsByModule.set(mod.id, []);
  }
  for (const lesson of lessonRows) {
    lessonsByModule.get(lesson.moduleId)?.push(lesson);
  }

  for (const mod of moduleRows) {
    const modLessons = lessonsByModule.get(mod.id) ?? [];
    const publishedLessons = modLessons.filter((l) => l.status === "published");

    if (publishedLessons.length === 0) {
      errors.push(`Module "${mod.title}" must have at least one published lesson.`);
    }
  }

  for (const lesson of lessonRows) {
    if (lesson.status !== "published") continue;

    switch (lesson.type) {
      case "video":
        if (!lesson.muxPlaybackId || lesson.muxPlaybackId.trim() === "") {
          errors.push(`Lesson "${lesson.title}" (video) requires a video playback ID.`);
        }
        break;
      case "text":
        if (!lesson.contentJson || typeof lesson.contentJson !== "object") {
          errors.push(`Lesson "${lesson.title}" (text) requires text content.`);
        }
        break;
      case "quiz":
        if (!lesson.contentJson || typeof lesson.contentJson !== "object") {
          errors.push(`Lesson "${lesson.title}" (quiz) requires quiz content.`);
        }
        break;
      case "file":
        if (!lesson.fileKey || lesson.fileKey.trim() === "") {
          errors.push(`Lesson "${lesson.title}" (file) requires an uploaded file.`);
        }
        break;
      case "external":
        if (!lesson.externalUrl || lesson.externalUrl.trim() === "") {
          errors.push(`Lesson "${lesson.title}" (external) requires an external URL.`);
        }
        break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates whether a course satisfies all requirements for publication:
 * 1. Has at least one module.
 * 2. Each module contains at least one published lesson.
 * 3. Every published lesson has required content for its type:
 *    - video: muxPlaybackId
 *    - text: contentJson
 *    - quiz: contentJson
 *    - file: fileKey
 *    - external: externalUrl
 */
export async function validateCoursePreflight(
  courseInput: string | { id: string },
): Promise<PublishPreflightResult> {
  const authorId = await requireUserId();
  const courseId = resolveCourseId(courseInput);
  await assertCourseOwned(courseId, authorId);
  return runPreflight(courseId);
}

/**
 * Publishes a course or bumps its version if already published:
 * - If draft: transitions status to "published" and sets publishedAt = now().
 * - If published: bumps version integer (version = version + 1) and updates publishedAt = now().
 * - Records event transition in course_event table ("publish" or "version_bump").
 */
export async function publishCourse(
  courseInput: string | { id: string },
): Promise<PublishCourseResult> {
  const authorId = await requireUserId();
  const rl = checkRateLimit(`publish:${authorId}`, 15, 60);
  if (!rl.allowed) {
    throw new RateLimitError(rl.resetSeconds);
  }
  const courseId = resolveCourseId(courseInput);
  const course = await assertCourseOwned(courseId, authorId);

  const preflight = await runPreflight(courseId);
  if (!preflight.valid) {
    return {
      success: false,
      errors: preflight.errors,
    };
  }

  const now = new Date();
  const isAlreadyPublished = course.status === "published";
  const newVersion = isAlreadyPublished ? course.version + 1 : course.version;
  const eventType: CourseEventType = isAlreadyPublished ? "version_bump" : "publish";

  const [updatedCourse] = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(courses)
      .set({
        status: "published",
        version: newVersion,
        publishedAt: now,
        updatedAt: now,
      })
      .where(and(eq(courses.id, courseId), eq(courses.authorId, authorId)))
      .returning();

    await tx.insert(courseEvent).values({
      id: crypto.randomUUID(),
      tenantId: course.tenantId,
      userId: authorId,
      courseId,
      lessonId: null,
      type: eventType,
      positionSeconds: 0,
      createdAt: now,
    });

    return [updated];
  });

  if (!updatedCourse) {
    throw new Error("Failed to publish course");
  }

  return {
    success: true,
    course: updatedCourse,
    isVersionBump: isAlreadyPublished,
    version: newVersion,
  };
}

/**
 * Transitions course status to "archived".
 */
export async function archiveCourse(
  courseInput: string | { id: string },
): Promise<CourseMutationResult> {
  const authorId = await requireUserId();
  const rl = checkRateLimit(`archive:${authorId}`, 15, 60);
  if (!rl.allowed) {
    throw new RateLimitError(rl.resetSeconds);
  }
  const courseId = resolveCourseId(courseInput);
  const course = await assertCourseOwned(courseId, authorId);

  const now = new Date();

  const [updatedCourse] = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(courses)
      .set({
        status: "archived",
        updatedAt: now,
      })
      .where(and(eq(courses.id, courseId), eq(courses.authorId, authorId)))
      .returning();

    await tx.insert(courseEvent).values({
      id: crypto.randomUUID(),
      tenantId: course.tenantId,
      userId: authorId,
      courseId,
      lessonId: null,
      type: "archive",
      positionSeconds: 0,
      createdAt: now,
    });

    return [updated];
  });

  if (!updatedCourse) {
    throw new Error("Failed to archive course");
  }

  return {
    success: true,
    course: updatedCourse,
  };
}

/**
 * Restores course status to "published" (if previously published) or "draft".
 */
export async function unarchiveCourse(
  courseInput: string | { id: string },
  targetStatus?: "draft" | "published",
): Promise<CourseMutationResult> {
  const authorId = await requireUserId();
  const rl = checkRateLimit(`unarchive:${authorId}`, 15, 60);
  if (!rl.allowed) {
    throw new RateLimitError(rl.resetSeconds);
  }
  const courseId = resolveCourseId(courseInput);
  const course = await assertCourseOwned(courseId, authorId);

  const restoredStatus: CourseStatus = targetStatus ?? (course.publishedAt ? "published" : "draft");
  const now = new Date();

  const [updatedCourse] = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(courses)
      .set({
        status: restoredStatus,
        updatedAt: now,
      })
      .where(and(eq(courses.id, courseId), eq(courses.authorId, authorId)))
      .returning();

    await tx.insert(courseEvent).values({
      id: crypto.randomUUID(),
      tenantId: course.tenantId,
      userId: authorId,
      courseId,
      lessonId: null,
      type: "unarchive",
      positionSeconds: 0,
      createdAt: now,
    });

    return [updated];
  });

  if (!updatedCourse) {
    throw new Error("Failed to unarchive course");
  }

  return {
    success: true,
    course: updatedCourse,
  };
}
