import { courses, hasAccess, lessonProgress } from "@lagan/db";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { auth } from "../../../../../../../lib/auth";
import { db } from "../../../../../../../lib/db";
import { checkRateLimit, rateLimitResponse } from "../../../../../../../lib/rate-limit";

const progressBodySchema = z
  .object({
    positionSeconds: z.number().int().min(0).max(86400).optional(),
    completed: z.boolean().optional(),
  })
  .strict();
interface RouteParams {
  courseId: string;
  lessonId: string;
}

export async function POST(
  request: Request,
  context: { params: Promise<RouteParams> | RouteParams },
) {
  const { courseId, lessonId } = await Promise.resolve(context.params);
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const rl = checkRateLimit(`progress:${userId}`, 60, 60);
  if (!rl.allowed) {
    return rateLimitResponse(rl.resetSeconds);
  }
  const [courseRow] = await db
    .select({
      id: courses.id,
      tenantId: courses.tenantId,
      authorId: courses.authorId,
      isFree: courses.isFree,
      priceCents: courses.priceCents,
    })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);

  if (!courseRow) {
    return Response.json({ error: "Course not found" }, { status: 404 });
  }

  const isAuthor = courseRow.authorId === userId;
  const authorized =
    isAuthor ||
    (await hasAccess({
      db,
      userId,
      courseId,
      tenantId: courseRow.tenantId,
      allowFree: true,
    }));

  if (!authorized) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let rawBody: unknown = {};
  try {
    const text = await request.text();
    if (text.trim().length > 0) {
      rawBody = JSON.parse(text);
    }
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = progressBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const positionSeconds = parsed.data.positionSeconds ?? 0;
  const isCompleted = Boolean(parsed.data.completed);
  const now = new Date();

  await db
    .insert(lessonProgress)
    .values({
      id: `${userId}_${lessonId}`,
      tenantId: courseRow.tenantId,
      userId,
      lessonId,
      courseId,
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

  return Response.json({
    success: true,
    lessonId,
    courseId,
    positionSeconds,
    completed: isCompleted,
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<RouteParams> | RouteParams },
) {
  const { courseId, lessonId } = await Promise.resolve(context.params);
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const [courseRow] = await db
    .select({
      id: courses.id,
      tenantId: courses.tenantId,
      authorId: courses.authorId,
    })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);

  if (!courseRow) {
    return Response.json({ error: "Course not found" }, { status: 404 });
  }

  const isAuthor = courseRow.authorId === userId;
  const authorized =
    isAuthor ||
    (await hasAccess({
      db,
      userId,
      courseId,
      tenantId: courseRow.tenantId,
      allowFree: true,
    }));

  if (!authorized) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const [progressRow] = await db
    .select({
      positionSeconds: lessonProgress.positionSeconds,
      completed: lessonProgress.completed,
    })
    .from(lessonProgress)
    .where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lessonId)))
    .limit(1);

  return Response.json({
    lessonId,
    courseId,
    positionSeconds: progressRow?.positionSeconds ?? 0,
    completed: progressRow?.completed ?? false,
  });
}
