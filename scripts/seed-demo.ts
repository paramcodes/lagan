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

interface UpsertSpec {
  table: PgTable;
  columns: string[];
  rows: unknown[][];
  updateColumns: string[];
  casts?: Record<string, string>;
}

/**
 * Writes rows by primary key.
 *
 * The table and the column names come from the Drizzle schema, so the SQL
 * cannot name a column the database does not have. `xmax = 0` distinguishes a
 * freshly inserted row from a row the conflict clause updated, so the summary
 * can report what the run actually changed.
 */
async function upsert(client: Client, spec: UpsertSpec): Promise<WriteCounts> {
  if (spec.rows.length === 0) {
    return { created: 0, updated: 0 };
  }

  const schemaColumns = Object.values(getTableColumns(spec.table));
  for (const column of spec.columns) {
    if (!schemaColumns.some((schemaColumn) => schemaColumn.name === column)) {
      throw new Error(`Unknown column "${column}" on table "${getTableName(spec.table)}"`);
    }
  }

  const values: string[] = [];
  const params: unknown[] = [];

  for (const row of spec.rows) {
    const placeholders = row.map((value, index) => {
      params.push(value);
      const column = spec.columns[index] ?? "";
      const cast = spec.casts?.[column];
      return cast ? `$${params.length}::${cast}` : `$${params.length}`;
    });
    values.push(`(${placeholders.join(", ")})`);
  }

  const updates = spec.updateColumns
    .map((column) => `"${column}" = EXCLUDED."${column}"`)
    .join(", ");
  const columns = spec.columns.map((column) => `"${column}"`).join(", ");

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

  const userRows: unknown[][] = [];
  const accountRows: unknown[][] = [];
  const profileRows: unknown[][] = [];

  for (const user of DEMO_USERS) {
    const userId = `${DEMO_ID_PREFIX}user_${user.key}`;
    const createdAt = atHour(now, user.createdDaysAgo, 10);
    userRows.push([userId, user.name, user.email, true, null, createdAt, createdAt]);
    profileRows.push([
      `${DEMO_ID_PREFIX}profile_${user.key}`,
      userId,
      user.bio,
      user.websiteUrl,
      JSON.stringify(user.socialLinks),
      null,
      createdAt,
      createdAt,
    ]);
    if (user.hasLogin) {
      const password = await hashDemoPassword(DEMO_PASSWORD, demoPasswordSalt(userId));
      accountRows.push([
        `${DEMO_ID_PREFIX}account_${user.key}`,
        userId,
        "credential",
        userId,
        password,
        createdAt,
        createdAt,
      ]);
    }
  }

  const courseById = new Map(DEMO_COURSES.map((course) => [course.id, course]));
  const courseRows = DEMO_COURSES.map((course) => {
    const createdAt = atHour(now, course.createdDaysAgo, 9);
    const publishedAt =
      course.publishedDaysAgo === null ? null : atHour(now, course.publishedDaysAgo, 9);
    return [
      course.id,
      DEMO_TENANT_ID,
      `${DEMO_ID_PREFIX}user_${course.authorKey}`,
      course.title,
      course.description,
      course.priceCents,
      course.discountPercent,
      course.isFree,
      course.status,
      1,
      publishedAt,
      createdAt,
      createdAt,
    ];
  });

  const moduleRows = DEMO_MODULES.map((module) => [
    module.id,
    module.courseId,
    module.title,
    module.position,
  ]);

  const courseByModule = new Map(
    DEMO_MODULES.map((module) => [module.id, courseById.get(module.courseId)]),
  );

  const lessonRows = DEMO_LESSONS.map((lesson) => {
    const course = courseByModule.get(lesson.moduleId);
    const updatedAt =
      course?.publishedDaysAgo === null || course?.publishedDaysAgo === undefined
        ? atHour(now, course?.createdDaysAgo ?? 7, 12)
        : atHour(now, course.publishedDaysAgo, 12);
    return [
      lesson.id,
      lesson.moduleId,
      lesson.type,
      lesson.title,
      lesson.position,
      lesson.status,
      lesson.muxPlaybackId,
      lesson.contentJson,
      null,
      null,
      updatedAt,
    ];
  });

  const enrollmentRows = DEMO_ENROLLMENTS.map((enrollment) => [
    enrollment.id,
    `${DEMO_ID_PREFIX}user_${enrollment.userKey}`,
    enrollment.courseId,
    enrollment.stripePaymentId,
    atHour(now, enrollment.enrolledDaysAgo, 12),
    1,
  ]);

  const progressRows = DEMO_PROGRESS.map((progress) => {
    const lastSeenAt = atHour(now, progress.daysAgo, 19);
    return [
      progress.id,
      DEMO_TENANT_ID,
      `${DEMO_ID_PREFIX}user_${progress.userKey}`,
      progress.lessonId,
      progress.courseId,
      progress.completed,
      progress.completed ? lastSeenAt : null,
      progress.positionSeconds,
      lastSeenAt,
    ];
  });

  const notificationRows = DEMO_NOTIFICATIONS.map((notification) => {
    const createdAt = atHour(now, notification.createdDaysAgo, 12);
    const payload = {
      title: notification.title,
      courseId: notification.courseId,
      courseTitle: notification.courseTitle,
      lessonId: notification.lessonId,
      summary: notification.summary,
      message: notification.summary,
      url: notification.lessonId
        ? `/courses/${notification.courseId}/lessons/${notification.lessonId}`
        : `/courses/${notification.courseId}`,
    };
    return [
      notification.id,
      DEMO_TENANT_ID,
      `${DEMO_ID_PREFIX}user_${notification.userKey}`,
      notification.type,
      JSON.stringify(payload),
      notification.read ? atHour(now, Math.max(0, notification.createdDaysAgo - 1), 12) : null,
      createdAt,
    ];
  });

  const eventRows = buildCourseEvents(now).map((event) => [
    event.id,
    DEMO_TENANT_ID,
    `${DEMO_ID_PREFIX}user_${event.userKey}`,
    event.courseId,
    event.lessonId,
    event.type,
    event.positionSeconds,
    event.createdAt,
  ]);

  await client.query("BEGIN");

  try {
    report.user = await upsert(client, {
      table: user,
      columns: ["id", "name", "email", "email_verified", "image", "created_at", "updated_at"],
      rows: userRows,
      updateColumns: ["name", "email", "email_verified", "image", "updated_at"],
    });

    report.account = await upsert(client, {
      table: account,
      columns: [
        "id",
        "account_id",
        "provider_id",
        "user_id",
        "password",
        "created_at",
        "updated_at",
      ],
      rows: accountRows,
      updateColumns: ["account_id", "provider_id", "user_id", "password", "updated_at"],
    });

    report.profiles = await upsert(client, {
      table: profiles,
      columns: [
        "id",
        "user_id",
        "bio",
        "website_url",
        "social_links_json",
        "avatar_url",
        "created_at",
        "updated_at",
      ],
      rows: profileRows,
      updateColumns: [
        "user_id",
        "bio",
        "website_url",
        "social_links_json",
        "avatar_url",
        "updated_at",
      ],
    });

    report.courses = await upsert(client, {
      table: courses,
      columns: [
        "id",
        "tenant_id",
        "author_id",
        "title",
        "description",
        "price_cents",
        "discount_percent",
        "is_free",
        "status",
        "version",
        "published_at",
        "created_at",
        "updated_at",
      ],
      rows: courseRows,
      updateColumns: [
        "tenant_id",
        "author_id",
        "title",
        "description",
        "price_cents",
        "discount_percent",
        "is_free",
        "status",
        "published_at",
        "updated_at",
      ],
    });

    report.modules = await upsert(client, {
      table: modules,
      columns: ["id", "course_id", "title", "position"],
      rows: moduleRows,
      updateColumns: ["course_id", "title", "position"],
    });

    report.lessons = await upsert(client, {
      table: lessons,
      columns: [
        "id",
        "module_id",
        "type",
        "title",
        "position",
        "status",
        "mux_playback_id",
        "content_json",
        "external_url",
        "file_key",
        "updated_at",
      ],
      rows: lessonRows,
      updateColumns: [
        "module_id",
        "type",
        "title",
        "position",
        "status",
        "mux_playback_id",
        "content_json",
        "external_url",
        "file_key",
        "updated_at",
      ],
      casts: { content_json: "jsonb" },
    });

    report.enrollments = await upsert(client, {
      table: enrollments,
      columns: [
        "id",
        "user_id",
        "course_id",
        "stripe_payment_id",
        "enrolled_at",
        "course_version_seen",
      ],
      rows: enrollmentRows,
      updateColumns: ["user_id", "course_id", "stripe_payment_id", "enrolled_at"],
    });

    report.lesson_progress = await upsert(client, {
      table: lessonProgress,
      columns: [
        "id",
        "tenant_id",
        "user_id",
        "lesson_id",
        "course_id",
        "completed",
        "completed_at",
        "position_seconds",
        "last_seen_at",
      ],
      rows: progressRows,
      updateColumns: [
        "tenant_id",
        "user_id",
        "lesson_id",
        "course_id",
        "completed",
        "completed_at",
        "position_seconds",
        "last_seen_at",
      ],
    });

    report.notifications = await upsert(client, {
      table: notifications,
      columns: ["id", "tenant_id", "user_id", "type", "payload", "read_at", "created_at"],
      rows: notificationRows,
      updateColumns: ["tenant_id", "user_id", "type", "payload", "read_at"],
      casts: { payload: "jsonb" },
    });

    report.course_event = await upsert(client, {
      table: courseEvent,
      columns: [
        "id",
        "tenant_id",
        "user_id",
        "course_id",
        "lesson_id",
        "type",
        "position_seconds",
        "created_at",
      ],
      rows: eventRows,
      updateColumns: [
        "tenant_id",
        "user_id",
        "course_id",
        "lesson_id",
        "type",
        "position_seconds",
        "created_at",
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
