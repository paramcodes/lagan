export type PublishedContentType = "module" | "lesson" | "assignment" | "announcement";

export interface NewContentEmailJobData {
  kind: "notification";
  to: { email: string; name?: string | undefined } | string;
  type: "new_content_published";
  props: {
    recipientName: string;
    courseTitle: string;
    contentTitle: string;
    contentType: PublishedContentType;
    contentUrl: string;
    publishedBy?: string | undefined;
    summary?: string | undefined;
    appName?: string | undefined;
    appUrl?: string | undefined;
    supportEmail?: string | undefined;
    unsubscribeUrl?: string | undefined;
  };
  options?:
    | {
        headers?: Record<string, string> | undefined;
        tags?: Record<string, string> | undefined;
      }
    | undefined;
}

export type EmailJobData = NewContentEmailJobData;
import { and, eq, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { courses } from "./schema/course";
import { enrollments } from "./schema/enrollment";
import {
  type NewNotification,
  type Notification,
  type NotificationPayload,
  notifications,
} from "./schema/notification";

export type NotificationDb = Pick<NodePgDatabase<Record<string, never>>, "select" | "insert">;

let defaultNotificationDb: NotificationDb | null = null;
let lazyPool: Pool | null = null;
let lazyDrizzleDb: NotificationDb | null = null;

export function setDefaultNotificationDb(db: NotificationDb | null): void {
  defaultNotificationDb = db;
}

export function resetNotificationDb(): void {
  defaultNotificationDb = null;
  if (lazyPool) {
    lazyPool.end().catch(() => {});
    lazyPool = null;
    lazyDrizzleDb = null;
  }
}

function resolveDb(explicitDb?: NotificationDb): NotificationDb {
  if (explicitDb) return explicitDb;
  if (defaultNotificationDb) return defaultNotificationDb;
  if (process.env.DATABASE_URL) {
    if (!lazyDrizzleDb) {
      lazyPool = new Pool({ connectionString: process.env.DATABASE_URL });
      lazyDrizzleDb = drizzle(lazyPool) as unknown as NotificationDb;
    }
    return lazyDrizzleDb;
  }
  throw new Error(
    "Notification helper requires a database instance. Pass db as an argument, call setDefaultNotificationDb(db), or define process.env.DATABASE_URL.",
  );
}

export interface NotifyEnrolledLearnersInput {
  courseId: string;
  lessonId?: string | undefined;
  title: string;
  summary?: string | undefined;
  tenantId: string;
  eventId: string;
  db?: NotificationDb | undefined;
  batchSize?: number | undefined;
  url?: string | undefined;
  courseTitle?: string | undefined;
}

export interface NotifyEnrolledLearnersResult {
  eventId: string;
  courseId: string;
  lessonId?: string | undefined;
  tenantId: string;
  enrolledLearnerCount: number;
  notifiedCount: number;
  skippedCount: number;
  notifications: Notification[];
}

/**
 * Fans out in-app notifications to all enrolled learners for newly published content.
 * Strictly scopes queries by tenantId and courseId.
 * Non-enrolled users and users outside tenant are never notified.
 * Dedupes per event to prevent duplicate notifications on job retry.
 */
export async function notifyEnrolledLearnersOfNewContent(
  options: NotifyEnrolledLearnersInput,
): Promise<NotifyEnrolledLearnersResult>;
export async function notifyEnrolledLearnersOfNewContent(
  db: NotificationDb,
  options: NotifyEnrolledLearnersInput,
): Promise<NotifyEnrolledLearnersResult>;
export async function notifyEnrolledLearnersOfNewContent(
  first: NotificationDb | NotifyEnrolledLearnersInput,
  second?: NotifyEnrolledLearnersInput,
): Promise<NotifyEnrolledLearnersResult> {
  let activeDb: NotificationDb;
  let input: NotifyEnrolledLearnersInput;

  if (second !== undefined) {
    activeDb = first as NotificationDb;
    input = second;
  } else if (
    typeof (first as NotificationDb)?.select === "function" &&
    typeof (first as NotificationDb)?.insert === "function" &&
    !("courseId" in (first as Record<string, unknown>))
  ) {
    activeDb = first as NotificationDb;
    input = {} as NotifyEnrolledLearnersInput;
  } else {
    input = first as NotifyEnrolledLearnersInput;
    activeDb = resolveDb(input?.db);
  }

  const { courseId, lessonId, title, summary, tenantId, eventId, batchSize = 500 } = input;

  if (!courseId || !tenantId || !eventId || !title) {
    return {
      eventId: eventId ?? "",
      courseId: courseId ?? "",
      ...(lessonId ? { lessonId } : {}),
      tenantId: tenantId ?? "",
      enrolledLearnerCount: 0,
      notifiedCount: 0,
      skippedCount: 0,
      notifications: [],
    };
  }

  // 1. Verify course existence strictly within the given tenant boundary
  const courseRows = await activeDb
    .select({
      id: courses.id,
      title: courses.title,
      tenantId: courses.tenantId,
    })
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.tenantId, tenantId)));

  if (courseRows.length === 0) {
    return {
      eventId,
      courseId,
      ...(lessonId ? { lessonId } : {}),
      tenantId,
      enrolledLearnerCount: 0,
      notifiedCount: 0,
      skippedCount: 0,
      notifications: [],
    };
  }

  const courseRow = courseRows[0];
  const courseTitle = input.courseTitle ?? courseRow?.title ?? "";

  // 2. Query all enrolled learners for this course
  const enrolledRows = await activeDb
    .select({
      userId: enrollments.userId,
      courseId: enrollments.courseId,
    })
    .from(enrollments)
    .where(eq(enrollments.courseId, courseId));

  const uniqueUserIds = Array.from(new Set(enrolledRows.map((row) => row.userId).filter(Boolean)));

  if (uniqueUserIds.length === 0) {
    return {
      eventId,
      courseId,
      ...(lessonId ? { lessonId } : {}),
      tenantId,
      enrolledLearnerCount: 0,
      notifiedCount: 0,
      skippedCount: 0,
      notifications: [],
    };
  }

  // 3. Deduplicate per event: find notifications that already exist for this event
  const candidateIds = uniqueUserIds.map((userId) => `notif_${eventId}_${userId}`);

  const existingRows = await activeDb
    .select()
    .from(notifications)
    .where(and(eq(notifications.tenantId, tenantId), inArray(notifications.id, candidateIds)));

  const candidateIdSet = new Set(candidateIds);
  const matchedExistingRows = existingRows.filter((r) => candidateIdSet.has(r.id));
  const alreadyNotifiedUserIds = new Set(matchedExistingRows.map((r) => r.userId));
  const unnotifiedUserIds = uniqueUserIds.filter((userId) => !alreadyNotifiedUserIds.has(userId));

  if (unnotifiedUserIds.length === 0) {
    return {
      eventId,
      courseId,
      ...(lessonId ? { lessonId } : {}),
      tenantId,
      enrolledLearnerCount: uniqueUserIds.length,
      notifiedCount: 0,
      skippedCount: uniqueUserIds.length,
      notifications: matchedExistingRows,
    };
  }

  // 4. Batch insert notifications for newly notified enrolled learners
  const now = new Date();
  const targetUrl =
    input.url ?? (lessonId ? `/courses/${courseId}/lessons/${lessonId}` : `/courses/${courseId}`);

  const newNotificationRecords: NewNotification[] = unnotifiedUserIds.map((userId) => ({
    id: `notif_${eventId}_${userId}`,
    tenantId,
    userId,
    type: "new_content",
    payload: {
      eventId,
      courseId,
      ...(lessonId ? { lessonId } : {}),
      title,
      ...(summary ? { summary } : {}),
      url: targetUrl,
      contentType: lessonId ? "lesson" : "course",
      courseTitle,
    } as NotificationPayload,
    readAt: null,
    createdAt: now,
  }));

  const insertedNotifications: Notification[] = [];
  const safeBatchSize = Math.max(1, batchSize);

  for (let i = 0; i < newNotificationRecords.length; i += safeBatchSize) {
    const chunk = newNotificationRecords.slice(i, i + safeBatchSize);
    const rows = await activeDb
      .insert(notifications)
      .values(chunk)
      .onConflictDoNothing()
      .returning();

    if (rows && rows.length > 0) {
      insertedNotifications.push(...rows);
    } else {
      // Driver or mock fallback when returning() does not yield rows directly
      insertedNotifications.push(
        ...chunk.map(
          (c) =>
            ({
              id: c.id,
              tenantId: c.tenantId,
              userId: c.userId,
              type: c.type,
              payload: c.payload,
              readAt: null,
              createdAt: c.createdAt ?? now,
            }) as Notification,
        ),
      );
    }
  }

  return {
    eventId,
    courseId,
    ...(lessonId ? { lessonId } : {}),
    tenantId,
    enrolledLearnerCount: uniqueUserIds.length,
    notifiedCount: insertedNotifications.length,
    skippedCount: alreadyNotifiedUserIds.size,
    notifications: [...matchedExistingRows, ...insertedNotifications],
  };
}

export interface PrepareNewContentEmailJobPayloadInput {
  recipient: { email: string; name?: string | undefined } | string;
  courseTitle: string;
  contentTitle: string;
  contentType?: PublishedContentType | undefined;
  contentUrl: string;
  summary?: string | undefined;
  publishedBy?: string | undefined;
  appName?: string | undefined;
  appUrl?: string | undefined;
  supportEmail?: string | undefined;
  unsubscribeUrl?: string | undefined;
  eventId?: string | undefined;
}

export interface PrepareNewContentEmailJobsInput {
  recipients: Array<{ email: string; name?: string | undefined } | string>;
  courseTitle: string;
  contentTitle: string;
  contentType?: PublishedContentType | undefined;
  contentUrl: string;
  summary?: string | undefined;
  publishedBy?: string | undefined;
  appName?: string | undefined;
  appUrl?: string | undefined;
  supportEmail?: string | undefined;
  unsubscribeUrl?: string | undefined;
  eventId?: string | undefined;
}

export interface PrepareEmailJobsForNotificationResultInput {
  result: NotifyEnrolledLearnersResult;
  recipientsByUserId: Record<string, { email: string; name?: string | undefined } | string>;
  courseTitle?: string | undefined;
  contentTitle?: string | undefined;
  contentType?: PublishedContentType | undefined;
  contentUrl?: string | undefined;
  summary?: string | undefined;
  publishedBy?: string | undefined;
  appName?: string | undefined;
  appUrl?: string | undefined;
  supportEmail?: string | undefined;
  unsubscribeUrl?: string | undefined;
}

/**
 * Prepares a single `@lagan/email` job payload for newly published content.
 */
export function prepareNewContentEmailJobPayload(
  input: PrepareNewContentEmailJobPayloadInput,
): EmailJobData {
  const recipientName =
    typeof input.recipient === "object"
      ? (input.recipient.name ?? input.recipient.email)
      : input.recipient;

  return {
    kind: "notification",
    to: input.recipient,
    type: "new_content_published",
    props: {
      recipientName,
      courseTitle: input.courseTitle,
      contentTitle: input.contentTitle,
      contentType: input.contentType ?? "lesson",
      contentUrl: input.contentUrl,
      ...(input.summary ? { summary: input.summary } : {}),
      ...(input.publishedBy ? { publishedBy: input.publishedBy } : {}),
      ...(input.appName ? { appName: input.appName } : {}),
      ...(input.appUrl ? { appUrl: input.appUrl } : {}),
      ...(input.supportEmail ? { supportEmail: input.supportEmail } : {}),
      ...(input.unsubscribeUrl ? { unsubscribeUrl: input.unsubscribeUrl } : {}),
    },
    ...(input.eventId
      ? {
          options: {
            headers: {
              "X-Event-ID": input.eventId,
            },
          },
        }
      : {}),
  };
}

/**
 * Prepares a batch of `@lagan/email` job payloads for multiple recipients.
 */
export function prepareNewContentEmailJobs(input: PrepareNewContentEmailJobsInput): EmailJobData[] {
  return input.recipients.map((recipient) =>
    prepareNewContentEmailJobPayload({
      ...input,
      recipient,
    }),
  );
}

/**
 * Bridges notification fan-out result and recipient email lookup into `@lagan/email` job payloads.
 */
export function prepareEmailJobsForNotificationResult(
  input: PrepareEmailJobsForNotificationResultInput,
): EmailJobData[] {
  const jobs: EmailJobData[] = [];
  for (const notif of input.result.notifications) {
    const recipient = input.recipientsByUserId[notif.userId];
    if (!recipient) continue;
    const payload = notif.payload as Record<string, unknown>;
    jobs.push(
      prepareNewContentEmailJobPayload({
        recipient,
        courseTitle:
          input.courseTitle ?? (typeof payload.courseTitle === "string" ? payload.courseTitle : ""),
        contentTitle:
          input.contentTitle ?? (typeof payload.title === "string" ? payload.title : ""),
        contentType:
          input.contentType ??
          (payload.contentType as PublishedContentType) ??
          (input.result.lessonId ? "lesson" : "course"),
        contentUrl:
          input.contentUrl ??
          (typeof payload.url === "string" ? payload.url : `/courses/${input.result.courseId}`),
        summary:
          input.summary ?? (typeof payload.summary === "string" ? payload.summary : undefined),
        publishedBy: input.publishedBy,
        appName: input.appName,
        appUrl: input.appUrl,
        supportEmail: input.supportEmail,
        unsubscribeUrl: input.unsubscribeUrl,
        eventId: input.result.eventId,
      }),
    );
  }
  return jobs;
}
