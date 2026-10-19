"use server";

import { courses, hasAccess, lessonProgress } from "@lagan/db";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "../../../../../../lib/auth";
import { db } from "../../../../../../lib/db";
import { RateLimitError, checkRateLimit } from "../../../../../../lib/rate-limit";

const saveLessonProgressInputSchema = z
  .object({
    courseId: z.string().min(1),
    lessonId: z.string().min(1),
    positionSeconds: z.number().int().min(0).max(86400).optional(),
    completed: z.boolean().optional(),
  })
  .strict();

export type SaveLessonProgressInput = z.input<typeof saveLessonProgressInputSchema>;

export async function saveLessonProgress(input: SaveLessonProgressInput) {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("Unauthorized");
  }

  const data = saveLessonProgressInputSchema.parse(input);

  const rl = checkRateLimit(`progress:${userId}`, 60, 60);
  if (!rl.allowed) {
    throw new RateLimitError(rl.resetSeconds);
  }

  const [courseRow] = await db
    .select({
      id: courses.id,
      tenantId: courses.tenantId,
      authorId: courses.authorId,
    })
    .from(courses)
    .where(eq(courses.id, data.courseId))
    .limit(1);

  if (!courseRow) {
    throw new Error("Course not found");
  }

  const isAuthor = courseRow.authorId === userId;
  const authorized =
    isAuthor ||
    (await hasAccess({
      db,
      userId,
      courseId: data.courseId,
      tenantId: courseRow.tenantId,
      allowFree: true,
    }));

  if (!authorized) {
    throw new Error("Forbidden");
  }

  const positionSeconds = Math.max(0, Math.floor(data.positionSeconds ?? 0));
  const isCompleted = Boolean(data.completed);
  const now = new Date();

  await db
    .insert(lessonProgress)
    .values({
      id: `${userId}_${data.lessonId}`,
      tenantId: courseRow.tenantId,
      userId,
      lessonId: data.lessonId,
      courseId: data.courseId,
      positionSeconds,
      completed: isCompleted,
      completedAt: isCompleted ? now : null,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: [lessonProgress.userId, lessonProgress.lessonId],
      set: {
        positionSeconds,
        completed: isCompleted ? true : sql`${lessonProgress.completed}`,
        completedAt: isCompleted
          ? sql`coalesce(${lessonProgress.completedAt}, ${now})`
          : sql`${lessonProgress.completedAt}`,
        lastSeenAt: now,
      },
    });

  revalidatePath(`/courses/${data.courseId}/lessons/${data.lessonId}`);

  return {
    success: true,
    lessonId: data.lessonId,
    courseId: data.courseId,
    positionSeconds,
    completed: isCompleted,
  };
}
