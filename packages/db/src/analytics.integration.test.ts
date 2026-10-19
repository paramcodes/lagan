import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  getAuthorCoursesMetrics,
  getCourseMetrics,
  getCourseTrendMetrics,
  getLessonDropOffMetrics,
} from "./analytics";

const DATABASE_URL = process.env.DATABASE_URL;
const TEST_SCHEMA = "p5_2_analytics_test";

const pool = DATABASE_URL
  ? new Pool({ connectionString: DATABASE_URL, options: `-c search_path=${TEST_SCHEMA}` })
  : null;

describe.skipIf(!DATABASE_URL)("analytics queries against real Postgres", () => {
  const db = drizzle(pool as Pool);

  const AUTHOR_A = "user_author_a";
  const AUTHOR_B = "user_author_b";
  const LEARNER_1 = "user_learner_1";
  const LEARNER_2 = "user_learner_2";
  const LEARNER_3 = "user_learner_3";
  const LEARNER_4 = "user_learner_4";

  const COURSE_1 = "course_101";
  const COURSE_2_EMPTY = "course_102";
  const COURSE_OTHER_TENANT = "course_103";
  const COURSE_AUTHOR_B = "course_201";

  const MODULE_1 = "mod_101";
  const MODULE_2 = "mod_102";
  const LESSON_1 = "les_101";
  const LESSON_2 = "les_102";
  const LESSON_3 = "les_103";

  beforeAll(async () => {
    if (!pool) return;
    await pool.query(`create schema if not exists ${TEST_SCHEMA}`);

    await pool.query(`
      create table if not exists "user" (
        "id" text primary key not null
      );

      create table if not exists "courses" (
        "id" text primary key not null,
        "tenant_id" text not null,
        "author_id" text not null references "user"("id") on delete cascade,
        "title" text not null,
        "description" text,
        "price_cents" integer default 0 not null,
        "discount_percent" integer default 0 not null,
        "is_free" boolean default false not null,
        "status" text default 'draft' not null,
        "version" integer default 1 not null,
        "published_at" timestamp with time zone,
        "created_at" timestamp with time zone default now() not null,
        "updated_at" timestamp with time zone default now() not null
      );
      create index if not exists "courses_tenant_id_idx" on "courses"("tenant_id");
      create index if not exists "courses_author_id_idx" on "courses"("author_id");

      create table if not exists "modules" (
        "id" text primary key not null,
        "course_id" text not null references "courses"("id") on delete cascade,
        "title" text not null,
        "position" integer default 0 not null
      );
      create index if not exists "modules_course_id_idx" on "modules"("course_id");
      create unique index if not exists "modules_course_id_position_key" on "modules"("course_id", "position");

      create table if not exists "lessons" (
        "id" text primary key not null,
        "module_id" text not null references "modules"("id") on delete cascade,
        "type" text not null,
        "title" text not null,
        "position" integer default 0 not null,
        "status" text default 'draft' not null,
        "mux_playback_id" text,
        "content_json" jsonb,
        "external_url" text,
        "file_key" text,
        "updated_at" timestamp with time zone default now() not null
      );
      create index if not exists "lessons_module_id_idx" on "lessons"("module_id");
      create unique index if not exists "lessons_module_id_position_key" on "lessons"("module_id", "position");

      create table if not exists "enrollments" (
        "id" text primary key not null,
        "user_id" text not null references "user"("id") on delete cascade,
        "course_id" text not null references "courses"("id") on delete cascade,
        "stripe_payment_id" text not null unique,
        "enrolled_at" timestamp with time zone default now() not null,
        "course_version_seen" integer default 1 not null
      );
      create index if not exists "enrollments_course_id_idx" on "enrollments"("course_id");
      create unique index if not exists "enrollments_user_id_course_id_key" on "enrollments"("user_id", "course_id");

      create table if not exists "course_event" (
        "id" text primary key not null,
        "tenant_id" text not null,
        "user_id" text not null references "user"("id") on delete cascade,
        "course_id" text not null references "courses"("id") on delete cascade,
        "lesson_id" text references "lessons"("id") on delete cascade,
        "type" text not null,
        "position_seconds" integer default 0 not null,
        "created_at" timestamp with time zone default now() not null
      );
      create index if not exists "course_event_tenant_id_idx" on "course_event"("tenant_id");
      create index if not exists "course_event_course_id_idx" on "course_event"("course_id");
      create index if not exists "course_event_lesson_id_idx" on "course_event"("lesson_id");
      create index if not exists "course_event_course_id_created_at_idx" on "course_event"("course_id", "created_at");
    `);

    for (const uid of [
      AUTHOR_A,
      AUTHOR_B,
      LEARNER_1,
      LEARNER_2,
      LEARNER_3,
      LEARNER_4,
    ]) {
      await pool.query(
        `insert into "user"("id") values ($1) on conflict ("id") do nothing`,
        [uid],
      );
    }

    await pool.query(`
      insert into "courses"("id", "tenant_id", "author_id", "title")
      values
        ('${COURSE_1}', 'default', '${AUTHOR_A}', 'Distributed Systems'),
        ('${COURSE_2_EMPTY}', 'default', '${AUTHOR_A}', 'Compiler Design'),
        ('${COURSE_OTHER_TENANT}', 'other-tenant', '${AUTHOR_A}', 'Secret Course'),
        ('${COURSE_AUTHOR_B}', 'default', '${AUTHOR_B}', 'Author B Course')
      on conflict ("id") do nothing;

      insert into "modules"("id", "course_id", "title", "position")
      values
        ('${MODULE_1}', '${COURSE_1}', 'Module 1: Foundations', 0),
        ('${MODULE_2}', '${COURSE_1}', 'Module 2: Advanced', 1)
      on conflict ("id") do nothing;

      insert into "lessons"("id", "module_id", "type", "title", "position")
      values
        ('${LESSON_1}', '${MODULE_1}', 'video', 'Lesson 1.1: Clock sync', 0),
        ('${LESSON_2}', '${MODULE_1}', 'video', 'Lesson 1.2: Paxos', 1),
        ('${LESSON_3}', '${MODULE_2}', 'text', 'Lesson 2.1: Raft', 0)
      on conflict ("id") do nothing;

      insert into "enrollments"("id", "user_id", "course_id", "stripe_payment_id", "enrolled_at")
      values
        ('enr_1', '${LEARNER_1}', '${COURSE_1}', 'pi_1', '2026-03-05 10:00:00+00'),
        ('enr_2', '${LEARNER_2}', '${COURSE_1}', 'pi_2', '2026-03-10 10:00:00+00'),
        ('enr_3', '${LEARNER_3}', '${COURSE_1}', 'pi_3', '2026-03-15 10:00:00+00'),
        ('enr_4', '${LEARNER_4}', '${COURSE_1}', 'pi_4', '2026-01-10 10:00:00+00')
      on conflict ("id") do nothing;

      insert into "course_event"("id", "tenant_id", "user_id", "course_id", "lesson_id", "type", "created_at")
      values
        ('evt_1', 'default', '${LEARNER_1}', '${COURSE_1}', '${LESSON_1}', 'view', '2026-03-06 10:00:00+00'),
        ('evt_2', 'default', '${LEARNER_1}', '${COURSE_1}', '${LESSON_2}', 'view', '2026-03-06 11:00:00+00'),
        ('evt_3', 'default', '${LEARNER_1}', '${COURSE_1}', '${LESSON_1}', 'complete', '2026-03-07 10:00:00+00'),
        ('evt_4', 'default', '${LEARNER_1}', '${COURSE_1}', '${LESSON_2}', 'complete', '2026-03-07 11:00:00+00'),
        ('evt_5', 'default', '${LEARNER_1}', '${COURSE_1}', null, 'complete', '2026-03-08 12:00:00+00'),

        ('evt_6', 'default', '${LEARNER_2}', '${COURSE_1}', '${LESSON_1}', 'view', '2026-03-11 10:00:00+00'),
        ('evt_7', 'default', '${LEARNER_2}', '${COURSE_1}', '${LESSON_2}', 'view', '2026-03-11 11:00:00+00'),
        ('evt_8', 'default', '${LEARNER_2}', '${COURSE_1}', '${LESSON_2}', 'drop', '2026-03-12 10:00:00+00'),

        ('evt_9', 'default', '${LEARNER_3}', '${COURSE_1}', '${LESSON_1}', 'view', '2026-03-16 10:00:00+00'),
        ('evt_10', 'default', '${LEARNER_3}', '${COURSE_1}', null, 'drop', '2026-03-17 10:00:00+00'),

        ('evt_11', 'default', '${LEARNER_4}', '${COURSE_1}', '${LESSON_1}', 'view', '2026-01-11 10:00:00+00'),
        ('evt_12', 'default', '${LEARNER_4}', '${COURSE_1}', null, 'complete', '2026-01-12 10:00:00+00')
      on conflict ("id") do nothing;
    `);
  });

  afterAll(async () => {
    if (pool) {
      await pool.query(`drop schema if exists ${TEST_SCHEMA} cascade`);
      await pool.end();
    }
  });

  it("calculates accurate course metrics for a March time window", async () => {
    const metrics = await getCourseMetrics(db, {
      authorId: AUTHOR_A,
      tenantId: "default",
      courseId: COURSE_1,
      from: new Date("2026-03-01T00:00:00Z"),
      to: new Date("2026-03-31T23:59:59Z"),
    });

    expect(metrics).not.toBeNull();
    expect(metrics?.enrolments).toBe(3);
    expect(metrics?.totalEnrolments).toBe(3);
    expect(metrics?.starts).toBe(3);
    expect(metrics?.completions).toBe(1);
    expect(metrics?.dropOffs).toBe(1);
    expect(metrics?.completionRate).toBeCloseTo(1 / 3, 5);
  });

  it("returns zero counts and 0 rate on empty windows without throwing or null errors", async () => {
    const metrics = await getCourseMetrics(db, {
      authorId: AUTHOR_A,
      tenantId: "default",
      courseId: COURSE_1,
      from: new Date("2026-08-01T00:00:00Z"),
      to: new Date("2026-08-31T23:59:59Z"),
    });

    expect(metrics).toEqual({
      courseId: COURSE_1,
      enrolments: 0,
      totalEnrolments: 0,
      starts: 0,
      completions: 0,
      dropOffs: 0,
      completionRate: 0,
    });
  });

  it("enforces strict author scoping: refuses access to other author courses", async () => {
    const metricsOtherAuthor = await getCourseMetrics(db, {
      authorId: AUTHOR_B,
      tenantId: "default",
      courseId: COURSE_1,
    });
    expect(metricsOtherAuthor).toBeNull();
  });

  it("enforces strict tenant scoping per ADR-0002", async () => {
    const metricsWrongTenant = await getCourseMetrics(db, {
      authorId: AUTHOR_A,
      tenantId: "default",
      courseId: COURSE_OTHER_TENANT,
    });
    expect(metricsWrongTenant).toBeNull();
  });

  it("getAuthorCoursesMetrics returns all authored courses with zero defaults for empty courses", async () => {
    const results = await getAuthorCoursesMetrics(db, {
      authorId: AUTHOR_A,
      tenantId: "default",
      from: new Date("2026-03-01T00:00:00Z"),
      to: new Date("2026-03-31T23:59:59Z"),
    });

    expect(results).toHaveLength(2);
    const c1 = results.find((r) => r.courseId === COURSE_1);
    const c2 = results.find((r) => r.courseId === COURSE_2_EMPTY);

    expect(c1).toBeDefined();
    expect(c1?.enrolments).toBe(3);
    expect(c1?.starts).toBe(3);
    expect(c1?.completions).toBe(1);

    expect(c2).toBeDefined();
    expect(c2?.enrolments).toBe(0);
    expect(c2?.starts).toBe(0);
    expect(c2?.completions).toBe(0);
    expect(c2?.completionRate).toBe(0);
  });

  it("getLessonDropOffMetrics returns drop-offs and completions in lesson progression order", async () => {
    const lessonsMetrics = await getLessonDropOffMetrics(db, {
      authorId: AUTHOR_A,
      tenantId: "default",
      courseId: COURSE_1,
      from: new Date("2026-03-01T00:00:00Z"),
      to: new Date("2026-03-31T23:59:59Z"),
    });

    expect(lessonsMetrics).not.toBeNull();
    const l1 = lessonsMetrics?.[0];
    const l2 = lessonsMetrics?.[1];
    const l3 = lessonsMetrics?.[2];
    if (!l1 || !l2 || !l3) {
      throw new Error("Expected at least 3 lessons metrics");
    }

    expect(l1.lessonId).toBe(LESSON_1);
    expect(l1.views).toBe(3);
    expect(l1.completions).toBe(1);
    expect(l1.dropOffs).toBe(0);
    expect(l1.dropOffRate).toBe(0);

    expect(l2.lessonId).toBe(LESSON_2);
    expect(l2.views).toBe(2);
    expect(l2.completions).toBe(1);
    expect(l2.dropOffs).toBe(1);
    expect(l2.dropOffRate).toBe(0.5);

    expect(l3.lessonId).toBe(LESSON_3);
    expect(l3.views).toBe(0);
    expect(l3.completions).toBe(0);
    expect(l3.dropOffs).toBe(0);
    expect(l3.dropOffRate).toBe(0);
  });

  it("getCourseTrendMetrics groups activity by period", async () => {
    const trend = await getCourseTrendMetrics(db, {
      authorId: AUTHOR_A,
      tenantId: "default",
      courseId: COURSE_1,
      interval: "day",
      from: new Date("2026-03-01T00:00:00Z"),
      to: new Date("2026-03-31T23:59:59Z"),
    });

    expect(trend).not.toBeNull();
    if (!trend || trend.length === 0) {
      throw new Error("Expected trend buckets");
    }

    for (let i = 1; i < trend.length; i++) {
      const current = trend[i];
      const prev = trend[i - 1];
      if (current && prev) {
        expect(current.date.getTime()).toBeGreaterThanOrEqual(prev.date.getTime());
      }
    }

    for (const bucket of trend) {
      expect(bucket.completionRate).toBeGreaterThanOrEqual(0);
      expect(bucket.completionRate).toBeLessThanOrEqual(1);
    }
  });
});
