#!/usr/bin/env bun
/**
 * Demo seed command.
 *
 * Writes the demo dataset from `seed-demo-data.ts` into a database, or removes
 * it again. Every row this script writes carries a `demo_` id prefix, so the
 * clean command can remove exactly those rows and leave the courses the app
 * ships with, the e2e fixtures and any real user data untouched.
 */
import { createHash, scrypt } from "node:crypto";
import { getTableColumns, getTableName } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { Client } from "pg";
import {
  account,
  courseEvent,
  courses,
  enrollments,
  lessonProgress,
  lessons,
  modules,
  notifications,
  profiles,
  user,
} from "../packages/db/src/schema";
import type {
  NewCourse,
  NewCourseEvent,
  NewEnrollment,
  NewLesson,
  NewLessonProgress,
  NewModule,
  NewNotification,
  NewProfile,
} from "../packages/db/src/schema";
import {
  atHour,
  buildCourseEvents,
  DEMO_COURSES,
  DEMO_ENROLLMENTS,
  DEMO_ID_PREFIX,
  DEMO_LEARNER_EMAIL,
  DEMO_LESSONS,
  DEMO_MODULES,
  DEMO_NOTIFICATIONS,
  DEMO_PASSWORD,
  DEMO_PROGRESS,
  DEMO_TENANT_ID,
  DEMO_USERS,
} from "./seed-demo-data";

type NewUser = typeof user.$inferInsert;
type NewAccount = typeof account.$inferInsert;

/** Deterministic salt so the seeded credential hashes are reproducible. */
export function demoPasswordSalt(userId: string): string {
  return createHash("sha256").update(`${userId}:${DEMO_PASSWORD}`).digest("hex").slice(0, 32);
}

export interface WriteCounts {
  created: number;
  updated: number;
}

export type SeedReport = Record<string, WriteCounts>;

export type CleanReport = Record<string, number>;

interface UpsertSpec<Row extends Record<string, unknown>> {
  table: PgTable;
  fields: readonly (keyof Row & string)[];
  rows: readonly Row[];
  updateColumns: readonly (keyof Row & string)[];
  casts?: Record<string, string>;
}

/**
 * Writes rows by primary key.
 *
 * The table and the column names come from the Drizzle schema, so the SQL
 * cannot drift away from the columns the database actually has. `xmax = 0`
 * distinguishes a freshly inserted row from a row the conflict clause updated,
 * so the summary can report what the run actually changed.
 */
async function upsert<Row extends Record<string, unknown>>(
  client: Client,
  spec: UpsertSpec<Row>,
): Promise<WriteCounts> {
  if (spec.rows.length === 0) {
    return { created: 0, updated: 0 };
  }

  const schemaColumns = getTableColumns(spec.table);
  const columnName = (field: string): string => {
    const column = schemaColumns[field];
    if (!column) {
      throw new Error(`Unknown column "${field}" on table "${getTableName(spec.table)}"`);
    }
    return column.name;
  };

  const values: string[] = [];
  const params: unknown[] = [];

  for (const row of spec.rows) {
    const placeholders = spec.fields.map((field) => {
      params.push(row[field]);
      const cast = spec.casts?.[field];
      return cast ? `$${params.length}::${cast}` : `$${params.length}`;
    });
    values.push(`(${placeholders.join(", ")})`);
  }

  const updates = spec.updateColumns
    .map((field) => `"${columnName(field)}" = EXCLUDED."${columnName(field)}"`)
    .join(", ");
  const columns = spec.fields.map((field) => `"${columnName(field)}"`).join(", ");

  const result = await client.query<{ inserted: boolean }>(
    `INSERT INTO "${getTableName(spec.table)}" (${columns})
     VALUES ${values.join(", ")}
     ON CONFLICT (id) DO UPDATE SET ${updates}
     RETURNING (xmax = 0) AS inserted`,
    params,
  );

  let created = 0;
  let updated = 0;
  for (const row of result.rows) {
    if (row.inserted) created += 1;
    else updated += 1;
  }
  return { created, updated };
}

function scryptKey(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      64,
      { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 },
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      },
    );
  });
}

/**
 * Hashes a demo password the way Better Auth stores credential passwords, so
 * the seeded personas can sign in through the regular email/password form.
 */
export async function hashDemoPassword(password: string, salt: string): Promise<string> {
  const key = await scryptKey(password, salt);
  return `${salt}:${key.toString("hex")}`;
}

export interface SeedOptions {
  now?: Date;
}

/**
 * Writes the whole demo dataset.
 *
 * Every statement upserts by primary key, so running the seed twice converges
 * on the same rows instead of duplicating them.
 */
export async function seedDemoData(client: Client, options: SeedOptions = {}): Promise<SeedReport> {
  const now = options.now ?? new Date();
  const report: SeedReport = {};

  const userRows: NewUser[] = DEMO_USERS.map((person) => {
    const createdAt = atHour(now, person.createdDaysAgo, 10);
    return {
      id: `${DEMO_ID_PREFIX}user_${person.key}`,
      name: person.name,
      email: person.email,
      emailVerified: true,
      image: null,
      createdAt,
      updatedAt: createdAt,
    };
  });

  const profileRows: NewProfile[] = DEMO_USERS.map((person) => {
    const createdAt = atHour(now, person.createdDaysAgo, 10);
    return {
      id: `${DEMO_ID_PREFIX}profile_${person.key}`,
      userId: `${DEMO_ID_PREFIX}user_${person.key}`,
      bio: person.bio,
      websiteUrl: person.websiteUrl,
      socialLinksJson: JSON.stringify(person.socialLinks),
      avatarUrl: null,
      createdAt,
      updatedAt: createdAt,
    };
  });

  const accountRows: NewAccount[] = [];
  for (const person of DEMO_USERS) {
    if (!person.hasLogin) continue;
    const userId = `${DEMO_ID_PREFIX}user_${person.key}`;
    const createdAt = atHour(now, person.createdDaysAgo, 10);
    accountRows.push({
      id: `${DEMO_ID_PREFIX}account_${person.key}`,
      accountId: userId,
      providerId: "credential",
      userId,
      password: await hashDemoPassword(DEMO_PASSWORD, demoPasswordSalt(userId)),
      createdAt,
      updatedAt: createdAt,
    });
  }

  const courseById = new Map(DEMO_COURSES.map((course) => [course.id, course]));
  const courseRows: NewCourse[] = DEMO_COURSES.map((course) => {
    const createdAt = atHour(now, course.createdDaysAgo, 9);
    const publishedAt =
      course.publishedDaysAgo === null ? null : atHour(now, course.publishedDaysAgo, 9);
    return {
      id: course.id,
      tenantId: DEMO_TENANT_ID,
      authorId: `${DEMO_ID_PREFIX}user_${course.authorKey}`,
      title: course.title,
      description: course.description,
      priceCents: course.priceCents,
      discountPercent: course.discountPercent,
      isFree: course.isFree,
      status: course.status,
      version: 1,
      publishedAt,
      createdAt,
      updatedAt: createdAt,
    };
  });

  const moduleRows: NewModule[] = DEMO_MODULES.map((module) => ({
    id: module.id,
    courseId: module.courseId,
    title: module.title,
    position: module.position,
  }));

  const courseByModule = new Map(
    DEMO_MODULES.map((module) => [module.id, courseById.get(module.courseId)]),
  );

  const lessonRows: NewLesson[] = DEMO_LESSONS.map((lesson) => {
    const course = courseByModule.get(lesson.moduleId);
    const updatedAt =
      course?.publishedDaysAgo === null || course?.publishedDaysAgo === undefined
        ? atHour(now, course?.createdDaysAgo ?? 7, 12)
        : atHour(now, course.publishedDaysAgo, 12);
    return {
      id: lesson.id,
      moduleId: lesson.moduleId,
      type: lesson.type,
      title: lesson.title,
      position: lesson.position,
      status: lesson.status,
      muxPlaybackId: lesson.muxPlaybackId,
      contentJson: lesson.contentJson,
      externalUrl: null,
      fileKey: null,
      updatedAt,
    };
  });

  const enrollmentRows: NewEnrollment[] = DEMO_ENROLLMENTS.map((enrollment) => ({
    id: enrollment.id,
    userId: `${DEMO_ID_PREFIX}user_${enrollment.userKey}`,
    courseId: enrollment.courseId,
    stripePaymentId: enrollment.stripePaymentId,
    enrolledAt: atHour(now, enrollment.enrolledDaysAgo, 12),
    courseVersionSeen: 1,
  }));

  const progressRows: NewLessonProgress[] = DEMO_PROGRESS.map((progress) => {
    const lastSeenAt = atHour(now, progress.daysAgo, 19);
    return {
      id: progress.id,
      tenantId: DEMO_TENANT_ID,
      userId: `${DEMO_ID_PREFIX}user_${progress.userKey}`,
      lessonId: progress.lessonId,
      courseId: progress.courseId,
      completed: progress.completed,
      completedAt: progress.completed ? lastSeenAt : null,
      positionSeconds: progress.positionSeconds,
      lastSeenAt,
    };
  });

  const notificationRows: NewNotification[] = DEMO_NOTIFICATIONS.map((notification) => {
    const createdAt = atHour(now, notification.createdDaysAgo, 12);
    return {
      id: notification.id,
      tenantId: DEMO_TENANT_ID,
      userId: `${DEMO_ID_PREFIX}user_${notification.userKey}`,
      type: notification.type,
      payload: {
        title: notification.title,
        courseId: notification.courseId,
        courseTitle: notification.courseTitle,
        lessonId: notification.lessonId,
        summary: notification.summary,
        message: notification.summary,
        url: notification.lessonId
          ? `/courses/${notification.courseId}/lessons/${notification.lessonId}`
          : `/courses/${notification.courseId}`,
      },
      readAt: notification.read
        ? atHour(now, Math.max(0, notification.createdDaysAgo - 1), 12)
        : null,
      createdAt,
    };
  });

  const eventRows: NewCourseEvent[] = buildCourseEvents(now).map((event) => ({
    id: event.id,
    tenantId: DEMO_TENANT_ID,
    userId: `${DEMO_ID_PREFIX}user_${event.userKey}`,
    courseId: event.courseId,
    lessonId: event.lessonId,
    type: event.type,
    positionSeconds: event.positionSeconds,
    createdAt: event.createdAt,
  }));

  await client.query("BEGIN");

  try {
    report.user = await upsert(client, {
      table: user,
      fields: ["id", "name", "email", "emailVerified", "image", "createdAt", "updatedAt"],
      rows: userRows,
      updateColumns: ["name", "email", "emailVerified", "image", "updatedAt"],
    });

    report.account = await upsert(client, {
      table: account,
      fields: ["id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt"],
      rows: accountRows,
      updateColumns: ["accountId", "providerId", "userId", "password", "updatedAt"],
    });

    report.profiles = await upsert(client, {
      table: profiles,
      fields: [
        "id",
        "userId",
        "bio",
        "websiteUrl",
        "socialLinksJson",
        "avatarUrl",
        "createdAt",
        "updatedAt",
      ],
      rows: profileRows,
      updateColumns: ["userId", "bio", "websiteUrl", "socialLinksJson", "avatarUrl", "updatedAt"],
    });

    report.courses = await upsert(client, {
      table: courses,
      fields: [
        "id",
        "tenantId",
        "authorId",
        "title",
        "description",
        "priceCents",
        "discountPercent",
        "isFree",
        "status",
        "version",
        "publishedAt",
        "createdAt",
        "updatedAt",
      ],
      rows: courseRows,
      updateColumns: [
        "tenantId",
        "authorId",
        "title",
        "description",
        "priceCents",
        "discountPercent",
        "isFree",
        "status",
        "publishedAt",
        "updatedAt",
      ],
    });

    report.modules = await upsert(client, {
      table: modules,
      fields: ["id", "courseId", "title", "position"],
      rows: moduleRows,
      updateColumns: ["courseId", "title", "position"],
    });

    report.lessons = await upsert(client, {
      table: lessons,
      fields: [
        "id",
        "moduleId",
        "type",
        "title",
        "position",
        "status",
        "muxPlaybackId",
        "contentJson",
        "externalUrl",
        "fileKey",
        "updatedAt",
      ],
      rows: lessonRows,
      updateColumns: [
        "moduleId",
        "type",
        "title",
        "position",
        "status",
        "muxPlaybackId",
        "contentJson",
        "externalUrl",
        "fileKey",
        "updatedAt",
      ],
      casts: { contentJson: "jsonb" },
    });

    report.enrollments = await upsert(client, {
      table: enrollments,
      fields: ["id", "userId", "courseId", "stripePaymentId", "enrolledAt", "courseVersionSeen"],
      rows: enrollmentRows,
      updateColumns: ["userId", "courseId", "stripePaymentId", "enrolledAt"],
    });

    report.lesson_progress = await upsert(client, {
      table: lessonProgress,
      fields: [
        "id",
        "tenantId",
        "userId",
        "lessonId",
        "courseId",
        "completed",
        "completedAt",
        "positionSeconds",
        "lastSeenAt",
      ],
      rows: progressRows,
      updateColumns: [
        "tenantId",
        "userId",
        "lessonId",
        "courseId",
        "completed",
        "completedAt",
        "positionSeconds",
        "lastSeenAt",
      ],
    });

    report.notifications = await upsert(client, {
      table: notifications,
      fields: ["id", "tenantId", "userId", "type", "payload", "readAt", "createdAt"],
      rows: notificationRows,
      updateColumns: ["tenantId", "userId", "type", "payload", "readAt"],
      casts: { payload: "jsonb" },
    });

    report.course_event = await upsert(client, {
      table: courseEvent,
      fields: [
        "id",
        "tenantId",
        "userId",
        "courseId",
        "lessonId",
        "type",
        "positionSeconds",
        "createdAt",
      ],
      rows: eventRows,
      updateColumns: [
        "tenantId",
        "userId",
        "courseId",
        "lessonId",
        "type",
        "positionSeconds",
        "createdAt",
      ],
    });

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  return report;
}

const CLEAN_ORDER = [
  courseEvent,
  lessonProgress,
  notifications,
  enrollments,
  lessons,
  modules,
  courses,
  profiles,
  account,
  user,
];

/**
 * Removes the rows the seed created.
 *
 * The prefix check is the only selector, so rows without a `demo_` id are
 * never touched, and the order respects the foreign keys.
 */
export async function cleanDemoData(client: Client): Promise<CleanReport> {
  const report: CleanReport = {};

  await client.query("BEGIN");

  try {
    for (const table of CLEAN_ORDER) {
      const name = getTableName(table);
      const result = await client.query(`DELETE FROM "${name}" WHERE starts_with(id, $1)`, [
        DEMO_ID_PREFIX,
      ]);
      report[name] = result.rowCount ?? 0;
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  return report;
}

export function requireDatabaseUrl(env: Record<string, string | undefined> = process.env): string {
  const url = env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env in the repository root, or export DATABASE_URL, then run the seed again.",
    );
  }
  return url;
}

function redactDatabaseUrl(url: string): string {
  return url.replace(/\/\/([^:@/]+):([^@/]*)@/, "//$1:***@");
}

function printSeedReport(report: SeedReport, databaseUrl: string): void {
  console.log(`Seeded the demo dataset into ${redactDatabaseUrl(databaseUrl)}\n`);
  let created = 0;
  let updated = 0;
  for (const [table, counts] of Object.entries(report)) {
    created += counts.created;
    updated += counts.updated;
    console.log(`  ${table.padEnd(16)} ${counts.created} created, ${counts.updated} updated`);
  }
  console.log(`  ${"total".padEnd(16)} ${created} created, ${updated} updated`);
  console.log(
    `\nSign in as ${DEMO_LEARNER_EMAIL} (password ${DEMO_PASSWORD}) to see My Learning, the notification centre and the course player.`,
  );
}

function printCleanReport(report: CleanReport, databaseUrl: string): void {
  console.log(`Removed the demo dataset from ${redactDatabaseUrl(databaseUrl)}\n`);
  let removed = 0;
  for (const [table, count] of Object.entries(report)) {
    removed += count;
    console.log(`  ${table.padEnd(16)} ${count} removed`);
  }
  console.log(`  ${"total".padEnd(16)} ${removed} removed`);
}

async function run(argv: string[]): Promise<void> {
  const clean = argv.includes("--clean");
  const databaseUrl = requireDatabaseUrl();
  const client = new Client({ connectionString: databaseUrl });

  await client.connect();
  try {
    if (clean) {
      printCleanReport(await cleanDemoData(client), databaseUrl);
    } else {
      printSeedReport(await seedDemoData(client), databaseUrl);
    }
  } finally {
    await client.end();
  }
}

const isEntryPoint = (import.meta as ImportMeta & { main?: boolean }).main === true;

if (isEntryPoint) {
  run(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
