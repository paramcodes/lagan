import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cleanDemoData, requireDatabaseUrl, seedDemoData } from "./seed-demo";
import { DEMO_ID_PREFIX } from "./seed-demo-data";

const DATABASE_URL = process.env.DATABASE_URL;
const TEST_SCHEMA = "p9_6_seed_demo_integration";
const FIXED_NOW = new Date("2026-05-01T09:00:00Z");

const TABLES = [
  "user",
  "account",
  "profiles",
  "courses",
  "modules",
  "lessons",
  "enrollments",
  "lesson_progress",
  "notifications",
  "course_event",
] as const;

const SHIPPED_COURSE_IDS = ["course_database", "course_distributed", "course_typescript"];

describe("requireDatabaseUrl", () => {
  it("fails with a clear message when DATABASE_URL is missing", () => {
    expect(() => requireDatabaseUrl({})).toThrow(/DATABASE_URL is not set/);
  });

  it("returns the trimmed connection string when it is set", () => {
    expect(requireDatabaseUrl({ DATABASE_URL: "  postgres://lagan@localhost/lagan  " })).toBe(
      "postgres://lagan@localhost/lagan",
    );
  });
});

describe.skipIf(!DATABASE_URL)("demo seed against a real Postgres", () => {
  let client: Client | null = null;
  let ready = false;

  async function snapshotIds(): Promise<Record<string, string[]>> {
    if (!client) throw new Error("client not connected");
    const ids: Record<string, string[]> = {};
    for (const table of TABLES) {
      const rows = await client.query<{ id: string }>(`select id from "${table}" order by id`);
      ids[table] = rows.rows.map((row) => row.id);
    }
    return ids;
  }

  beforeAll(async () => {
    if (!DATABASE_URL) return;
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();

    const probe = await client.query<{ found: number }>(
      `select count(distinct c.relname)::int as found
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relkind = 'r'
          and c.relname = any($1::text[])`,
      [[...TABLES]],
    );
    if (probe.rows[0]?.found !== TABLES.length) {
      await client.end();
      client = null;
      return;
    }

    await client.query(`drop schema if exists ${TEST_SCHEMA} cascade`);
    await client.query(`create schema ${TEST_SCHEMA}`);
    for (const table of TABLES) {
      await client.query(
        `create table ${TEST_SCHEMA}."${table}" (like public."${table}" including all)`,
      );
    }
    await client.query(`set search_path to ${TEST_SCHEMA}`);
    ready = true;
  });

  afterAll(async () => {
    if (!client) return;
    await client.query(`drop schema if exists ${TEST_SCHEMA} cascade`);
    await client.end();
    client = null;
  });

  beforeEach(async () => {
    if (!ready || !client) return;
    await cleanDemoData(client);
  });

  it("writes a demo row into every table, all of them prefixed", async (ctx) => {
    if (!ready || !client) return ctx.skip();

    const report = await seedDemoData(client, { now: FIXED_NOW });

    for (const [table, counts] of Object.entries(report)) {
      expect(counts.created, table).toBeGreaterThan(0);
    }

    const ids = await snapshotIds();
    for (const [table, tableIds] of Object.entries(ids)) {
      expect(tableIds.length, table).toBeGreaterThan(0);
      for (const id of tableIds) {
        expect(id.startsWith(DEMO_ID_PREFIX), `${table}:${id}`).toBe(true);
      }
    }
  });

  it("converges on the same rows when the seed runs twice", async (ctx) => {
    if (!ready || !client) return ctx.skip();

    await seedDemoData(client, { now: FIXED_NOW });
    const first = await snapshotIds();

    const secondReport = await seedDemoData(client, { now: FIXED_NOW });
    const second = await snapshotIds();

    expect(second).toEqual(first);
    for (const [table, counts] of Object.entries(secondReport)) {
      expect(counts.created, table).toBe(0);
      expect(counts.updated, table).toBeGreaterThan(0);
    }
  });

  it("removes the seeded rows and leaves every other row alone", async (ctx) => {
    if (!ready || !client) return ctx.skip();

    await seedDemoData(client, { now: FIXED_NOW });
    await client.query(
      `insert into "user" (id, name, email, email_verified, created_at, updated_at)
       values ('keep_user', 'Keep User', 'keep@example.com', true, now(), now())`,
    );
    await client.query(
      `insert into "courses" (id, tenant_id, author_id, title, created_at, updated_at)
       values ('keep_course', 'default', 'keep_user', 'Keep Course', now(), now())`,
    );

    const shippedBefore = await client.query<{ count: number }>(
      `select count(*)::int as count from public.courses where id = any($1::text[])`,
      [SHIPPED_COURSE_IDS],
    );

    const report = await cleanDemoData(client);
    expect(report.courses).toBeGreaterThan(0);
    expect(report.user).toBeGreaterThan(0);

    const ids = await snapshotIds();
    expect(ids.user).toEqual(["keep_user"]);
    expect(ids.courses).toEqual(["keep_course"]);
    expect(ids.lessons).toEqual([]);
    expect(ids.course_event).toEqual([]);

    const shippedAfter = await client.query<{ count: number }>(
      `select count(*)::int as count from public.courses where id = any($1::text[])`,
      [SHIPPED_COURSE_IDS],
    );
    expect(shippedAfter.rows[0]?.count).toBe(shippedBefore.rows[0]?.count);
  });

  it("is a no-op when there is nothing to clean", async (ctx) => {
    if (!ready || !client) return ctx.skip();

    const report = await cleanDemoData(client);

    for (const count of Object.values(report)) {
      expect(count).toBe(0);
    }
  });
});
