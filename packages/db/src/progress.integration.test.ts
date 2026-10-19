import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getCourseProgress, getUserCoursesProgress } from "./progress";

const DATABASE_URL = process.env.DATABASE_URL;
const TEST_SCHEMA = "p4_5_progress_integration";

const pool = DATABASE_URL
  ? new Pool({ connectionString: DATABASE_URL, options: `-c search_path=${TEST_SCHEMA}` })
  : null;

describe.skipIf(!DATABASE_URL)("progress aggregation queries against Postgres", () => {
  const db = drizzle(pool as Pool);

  const TENANT_A = "tenant_a";
  const TENANT_B = "tenant_b";
  const USER_1 = "usr_integration_1";
  const USER_2 = "usr_integration_2";

  const COURSE_FULL = "crs_full";
  const COURSE_PARTIAL = "crs_partial";
  const COURSE_ZERO = "crs_zero";
  const COURSE_OTHER_TENANT = "crs_other_tenant";

  beforeAll(async () => {
    if (!pool) return;
    await pool.query(`create schema if not exists ${TEST_SCHEMA}`);

    await pool.query(`
      create table if not exists "user" (id text primary key not null);
      create table if not exists "courses" (
        id text primary key not null,
        tenant_id text not null,
        author_id text not null references "user"(id) on delete cascade,
        title text not null,
        status text default 'draft' not null
      );
      create index if not exists courses_tenant_id_idx on courses(tenant_id);
      create table if not exists "modules" (
        id text primary key not null,
        course_id text not null references courses(id) on delete cascade,
        title text not null,
        position integer default 0 not null
      );
      create index if not exists modules_course_id_idx on modules(course_id);
      create table if not exists "lessons" (
        id text primary key not null,
        module_id text not null references modules(id) on delete cascade,
        type text not null,
        title text not null,
        position integer default 0 not null,
        status text default 'draft' not null
      );
      create index if not exists lessons_module_id_idx on lessons(module_id);
      create table if not exists "enrollments" (
        id text primary key not null,
        user_id text not null references "user"(id) on delete cascade,
        course_id text not null references courses(id) on delete cascade,
        stripe_payment_id text not null unique,
        enrolled_at timestamp with time zone default now() not null
      );
      create index if not exists enrollments_user_id_idx on enrollments(user_id);
      create table if not exists "lesson_progress" (
        id text primary key not null,
        tenant_id varchar(64) not null,
        user_id text not null references "user"(id) on delete cascade,
        lesson_id text not null references lessons(id) on delete cascade,
        course_id text not null references courses(id) on delete cascade,
        completed boolean default false not null,
        completed_at timestamp with time zone,
        position_seconds integer default 0 not null,
        last_seen_at timestamp with time zone default now() not null
      );
      create unique index if not exists lesson_progress_user_id_lesson_id_key on lesson_progress(user_id, lesson_id);
      create index if not exists lesson_progress_user_id_course_id_completed_idx on lesson_progress(user_id, course_id, completed);
      create index if not exists lesson_progress_tenant_id_idx on lesson_progress(tenant_id);
      insert into "user" (id) values ('${USER_1}'), ('${USER_2}') on conflict do nothing;
      insert into courses (id, tenant_id, author_id, title, status) values
        ('${COURSE_FULL}', '${TENANT_A}', '${USER_1}', 'Full Course', 'published'),
        ('${COURSE_PARTIAL}', '${TENANT_A}', '${USER_1}', 'Partial Course', 'published'),
        ('${COURSE_ZERO}', '${TENANT_A}', '${USER_1}', 'Zero Lesson Course', 'published'),
        ('${COURSE_OTHER_TENANT}', '${TENANT_B}', '${USER_2}', 'Other Tenant Course', 'published')
      on conflict do nothing;
      insert into modules (id, course_id, title, position) values
        ('mod_f1', '${COURSE_FULL}', 'M1', 0),
        ('mod_p1', '${COURSE_PARTIAL}', 'M1', 0)
      on conflict do nothing;
      insert into lessons (id, module_id, type, title, position, status) values
        ('les_f1', 'mod_f1', 'video', 'F1', 0, 'published'),
        ('les_f2', 'mod_f1', 'video', 'F2', 1, 'published'),
        ('les_p1', 'mod_p1', 'video', 'P1', 0, 'published'),
        ('les_p2', 'mod_p1', 'video', 'P2', 1, 'published'),
        ('les_p3', 'mod_p1', 'text', 'P3 Draft', 2, 'draft')
      on conflict do nothing;
      insert into enrollments (id, user_id, course_id, stripe_payment_id) values
        ('enr_1', '${USER_1}', '${COURSE_FULL}', 'sp_1'),
        ('enr_2', '${USER_1}', '${COURSE_PARTIAL}', 'sp_2'),
        ('enr_3', '${USER_1}', '${COURSE_ZERO}', 'sp_3')
      on conflict do nothing;
      insert into lesson_progress (id, tenant_id, user_id, lesson_id, course_id, completed) values
        ('lp_1', '${TENANT_A}', '${USER_1}', 'les_f1', '${COURSE_FULL}', true),
        ('lp_2', '${TENANT_A}', '${USER_1}', 'les_f2', '${COURSE_FULL}', true),
        ('lp_3', '${TENANT_A}', '${USER_1}', 'les_p1', '${COURSE_PARTIAL}', true),
        ('lp_4', '${TENANT_A}', '${USER_1}', 'les_p3', '${COURSE_PARTIAL}', true)
      on conflict do nothing;
      analyze lesson_progress;
      analyze lessons;
    `);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`drop schema if exists ${TEST_SCHEMA} cascade`);
    await pool.end();
  });

  it("calculates 100% completion for fully completed course", async () => {
    const progress = await getCourseProgress(db, {
      userId: USER_1,
      courseId: COURSE_FULL,
      tenantId: TENANT_A,
    });
    expect(progress).toEqual({
      courseId: COURSE_FULL,
      totalLessons: 2,
      completedLessons: 2,
      percent: 100,
    });
  });

  it("calculates partial progress and ignores draft lessons", async () => {
    const progress = await getCourseProgress(db, {
      userId: USER_1,
      courseId: COURSE_PARTIAL,
      tenantId: TENANT_A,
    });
    expect(progress).toEqual({
      courseId: COURSE_PARTIAL,
      totalLessons: 2,
      completedLessons: 1,
      percent: 50,
    });
  });

  it("handles zero-lesson courses cleanly without divide-by-zero", async () => {
    const progress = await getCourseProgress(db, {
      userId: USER_1,
      courseId: COURSE_ZERO,
      tenantId: TENANT_A,
    });
    expect(progress).toEqual({
      courseId: COURSE_ZERO,
      totalLessons: 0,
      completedLessons: 0,
      percent: 0,
    });
  });

  it("strictly enforces tenant scoping", async () => {
    const crossTenantProgress = await getCourseProgress(db, {
      userId: USER_1,
      courseId: COURSE_OTHER_TENANT,
      tenantId: TENANT_A,
    });
    expect(crossTenantProgress).toBeNull();
  });

  it("retrieves progress for all enrolled user courses via batch query", async () => {
    const batch = await getUserCoursesProgress(db, {
      userId: USER_1,
      tenantId: TENANT_A,
    });

    const byId = Object.fromEntries(batch.map((item) => [item.courseId, item]));
    expect(byId[COURSE_FULL]?.percent).toBe(100);
    expect(byId[COURSE_PARTIAL]?.percent).toBe(50);
    expect(byId[COURSE_ZERO]?.percent).toBe(0);
    expect(byId[COURSE_OTHER_TENANT]).toBeUndefined();
  });

  it("verifies index usage on lesson_progress_user_id_course_id_completed_idx via EXPLAIN", async () => {
    if (!pool) return;
    await pool.query("set enable_seqscan = off;");

    const explainResult = await pool.query<{ "QUERY PLAN": string }>(`
      EXPLAIN (COSTS OFF)
      SELECT lp.course_id, count(lp.id)
      FROM lesson_progress lp
      INNER JOIN lessons l ON l.id = lp.lesson_id
      WHERE lp.user_id = '${USER_1}'
        AND lp.tenant_id = '${TENANT_A}'
        AND lp.course_id = '${COURSE_PARTIAL}'
        AND lp.completed = true
        AND l.status = 'published'
      GROUP BY lp.course_id;
    `);

    const planLines = explainResult.rows.map((row) => row["QUERY PLAN"]).join("\n");
    expect(planLines).toContain("lesson_progress_user_id_course_id_completed_idx");
  });
});
