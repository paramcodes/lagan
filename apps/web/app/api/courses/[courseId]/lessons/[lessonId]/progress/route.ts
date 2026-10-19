import { courses, hasAccess, lessonProgress } from "@lagan/db";
import { and, eq, sql } from "drizzle-orm";
import { auth } from "../../../../../../../lib/auth";
import { db } from "../../../../../../../lib/db";

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

  let body: { positionSeconds?: number; completed?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    // Body is optional or empty
  }

  const positionSeconds = Math.max(0, Math.floor(body.positionSeconds ?? 0));
  const isCompleted = Boolean(body.completed);
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
