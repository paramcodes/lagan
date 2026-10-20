import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyLessonOrder, applyModuleOrder } from "./ordering";
import { lessons, modules } from "./schema/course";

const DATABASE_URL = process.env.DATABASE_URL;
const SCHEMA = "p2_7_ordering_check";

const DDL = [
  `create table if not exists courses (
     id text primary key,
     tenant_id text not null,
     author_id text not null,
     title text not null,
     position integer not null default 0
   )`,
  `create table if not exists modules (
     id text primary key,
     course_id text not null references courses(id) on delete cascade,
     title text not null,
     position integer not null default 0
   )`,
  `create unique index if not exists modules_course_id_position_key
     on modules(course_id, position)`,
  `create table if not exists lessons (
     id text primary key,
     module_id text not null references modules(id) on delete cascade,
     type text not null,
     title text not null,
     position integer not null default 0
   )`,
  `create unique index if not exists lessons_module_id_position_key
     on lessons(module_id, position)`,
];

const pool = DATABASE_URL
  ? new Pool({ connectionString: DATABASE_URL, options: `-c search_path=${SCHEMA}` })
  : null;

function positionsOf(rows: { id: string; position: number }[]): Record<string, number> {
  return Object.fromEntries(rows.map((row) => [row.id, row.position]));
}

function errorMessages(error: unknown): string {
  const messages: string[] = [];
  let current: unknown = error;
  while (current instanceof Error) {
    messages.push(current.message);
    current = (current as { cause?: unknown }).cause;
  }
  return messages.join(" | ");
}

describe.skipIf(!DATABASE_URL)("ordering against Postgres", () => {
  const db = drizzle(pool as Pool);

  beforeAll(async () => {
    if (!pool) return;
    const { rows } = await pool.query<{ search_path: string }>("show search_path");
    expect(rows[0]?.search_path).toBe(SCHEMA);
    await db.execute(sql.raw(`create schema if not exists ${SCHEMA}`));
    for (const statement of DDL) {
      await db.execute(sql.raw(statement));
    }
  });

  afterAll(async () => {
    await pool?.end();
  });

  beforeEach(async () => {
    await db.execute(sql.raw("delete from lessons"));
    await db.execute(sql.raw("delete from modules"));
    await db.execute(sql.raw("delete from courses"));
    await db.execute(
      sql.raw(
        `insert into courses (id, tenant_id, author_id, title) values ('c1', 'default', 'u1', 'Course')`,
      ),
    );
    await db.execute(
      sql.raw(
        `insert into modules (id, course_id, title, position) values
         ('m1', 'c1', 'One', 0), ('m2', 'c1', 'Two', 1), ('m3', 'c1', 'Three', 2)`,
      ),
    );
    await db.execute(
      sql.raw(
        `insert into lessons (id, module_id, type, title, position) values
         ('l1', 'm1', 'text', 'One', 0), ('l2', 'm1', 'text', 'Two', 1),
         ('l3', 'm2', 'text', 'Three', 0)`,
      ),
    );
  });

  it("refuses a naive single-pass reorder, proving the unique index is enforced", async () => {
    const failure = await db
      .transaction(async (tx) => {
        await tx.update(modules).set({ position: 0 }).where(eq(modules.id, "m2"));
      })
      .catch((error: unknown) => error);

    expect(errorMessages(failure)).toMatch(
      /duplicate key value violates unique constraint "modules_course_id_position_key"/,
    );
  });

  it("reorders modules without violating unique (course_id, position)", async () => {
    await db.transaction(async (tx) => {
      await applyModuleOrder(tx, ["m3", "m1", "m2"]);
    });

    const rows = await db
      .select({ id: modules.id, position: modules.position })
      .from(modules)
      .orderBy(modules.position);
    expect(rows.map((row) => row.id)).toEqual(["m3", "m1", "m2"]);
    expect(positionsOf(rows)).toEqual({ m3: 0, m1: 1, m2: 2 });
  });

  it("moves a lesson between modules without violating unique (module_id, position)", async () => {
    await db.transaction(async (tx) => {
      await applyLessonOrder(tx, [
        { moduleId: "m1", lessonIds: ["l1"] },
        { moduleId: "m2", lessonIds: ["l3", "l2"] },
      ]);
    });

    const rows = await db
      .select({ id: lessons.id, moduleId: lessons.moduleId, position: lessons.position })
      .from(lessons)
      .orderBy(lessons.moduleId, lessons.position);

    expect(rows).toEqual([
      { id: "l1", moduleId: "m1", position: 0 },
      { id: "l3", moduleId: "m2", position: 0 },
      { id: "l2", moduleId: "m2", position: 1 },
    ]);
  });

  it("reverses a module order in place", async () => {
    await db.transaction(async (tx) => {
      await applyModuleOrder(tx, ["m3", "m2", "m1"]);
    });

    const rows = await db
      .select({ id: modules.id, position: modules.position })
      .from(modules)
      .orderBy(modules.position);
    expect(rows.map((row) => row.id)).toEqual(["m3", "m2", "m1"]);
  });
});
