import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type AccessDb,
  canAccessLesson,
  enrollLearner,
  hasAccess,
  setDefaultAccessDb,
} from "./access";

describe("access unit tests with mocked db", () => {
  const TENANT_A = "tenant_alpha";
  const TENANT_B = "tenant_beta";
  const USER_AUTHOR = "usr_author_1";
  const USER_LEARNER = "usr_learner_1";
  const USER_OTHER = "usr_other_1";
  const COURSE_PAID = "crs_paid_1";
  const COURSE_FREE = "crs_free_1";
  const LESSON_1 = "lsn_lesson_1";

  const mockCourse = { id: COURSE_PAID, authorId: USER_AUTHOR, tenantId: TENANT_A, isFree: false, priceCents: 5000, version: 2 };
  const mockFreeCourse = { id: COURSE_FREE, authorId: USER_AUTHOR, tenantId: TENANT_A, isFree: true, priceCents: 0, version: 1 };

  beforeEach(() => {
    setDefaultAccessDb(null);
  });

  describe("hasAccess", () => {
    it("returns false immediately for signed-out users", async () => {
      expect(await hasAccess(null, COURSE_PAID, TENANT_A)).toBe(false);
      expect(await hasAccess(undefined, COURSE_PAID, TENANT_A)).toBe(false);
      expect(await hasAccess("", COURSE_PAID, TENANT_A)).toBe(false);
      expect(await hasAccess({ userId: null, courseId: COURSE_PAID, tenantId: TENANT_A })).toBe(false);
    });

    it("returns false for missing courseId or tenantId", async () => {
      expect(await hasAccess(USER_LEARNER, "", TENANT_A)).toBe(false);
      expect(await hasAccess(USER_LEARNER, COURSE_PAID, "")).toBe(false);
    });

    it("throws if no db instance is available", async () => {
      const origUrl = process.env.DATABASE_URL;
      delete process.env.DATABASE_URL;
      try {
        await expect(hasAccess(USER_LEARNER, COURSE_PAID, TENANT_A)).rejects.toThrow(
          "Access helper requires a database instance",
        );
      } finally {
        process.env.DATABASE_URL = origUrl;
      }
    });

    it("returns false if course is not found in specified tenant", async () => {
      const mockDb = {
        select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) })),
      } as unknown as AccessDb;

      expect(await hasAccess(mockDb, USER_LEARNER, COURSE_PAID, TENANT_A)).toBe(false);
    });

    it("returns true if user is the course author", async () => {
      const mockDb = {
        select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([mockCourse]) })) })),
      } as unknown as AccessDb;

      expect(await hasAccess(mockDb, USER_AUTHOR, COURSE_PAID, TENANT_A)).toBe(true);
      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });

    it("returns true if user has an active enrollment", async () => {
      let callCount = 0;
      const mockDb = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn().mockImplementation(() => {
              callCount++;
              return Promise.resolve(callCount === 1 ? [mockCourse] : [{ id: "enr_123" }]);
            }),
          })),
        })),
      } as unknown as AccessDb;

      expect(await hasAccess(mockDb, USER_LEARNER, COURSE_PAID, TENANT_A)).toBe(true);
      expect(callCount).toBe(2);
    });

    it("returns false for unenrolled users on paid courses", async () => {
      let callCount = 0;
      const mockDb = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn().mockImplementation(() => {
              callCount++;
              return Promise.resolve(callCount === 1 ? [mockCourse] : []);
            }),
          })),
        })),
      } as unknown as AccessDb;

      expect(await hasAccess(mockDb, USER_OTHER, COURSE_PAID, TENANT_A)).toBe(false);
    });

    it("returns false for unenrolled users on free courses by default", async () => {
      let callCount = 0;
      const mockDb = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn().mockImplementation(() => {
              callCount++;
              return Promise.resolve(callCount === 1 ? [mockFreeCourse] : []);
            }),
          })),
        })),
      } as unknown as AccessDb;

      expect(await hasAccess(mockDb, USER_OTHER, COURSE_FREE, TENANT_A)).toBe(false);
    });

    it("returns true for unenrolled users on free courses when allowFree option is enabled", async () => {
      let callCount = 0;
      const mockDb = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn().mockImplementation(() => {
              callCount++;
              return Promise.resolve(callCount === 1 ? [mockFreeCourse] : []);
            }),
          })),
        })),
      } as unknown as AccessDb;

      expect(await hasAccess(mockDb, USER_OTHER, COURSE_FREE, TENANT_A, { allowFree: true })).toBe(true);
    });

    it("supports setDefaultAccessDb and options object syntax", async () => {
      const mockDb = {
        select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([mockCourse]) })) })),
      } as unknown as AccessDb;

      setDefaultAccessDb(mockDb);
      expect(await hasAccess({ userId: USER_AUTHOR, courseId: COURSE_PAID, tenantId: TENANT_A })).toBe(true);
    });

    it("supports db passed as fourth argument", async () => {
      const mockDb = {
        select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([mockCourse]) })) })),
      } as unknown as AccessDb;

      expect(await hasAccess(USER_AUTHOR, COURSE_PAID, TENANT_A, mockDb)).toBe(true);
    });
  });

  describe("canAccessLesson", () => {
    it("returns false for signed-out users or missing parameters", async () => {
      expect(await canAccessLesson(null, LESSON_1, TENANT_A)).toBe(false);
      expect(await canAccessLesson(undefined, LESSON_1, TENANT_A)).toBe(false);
      expect(await canAccessLesson(USER_LEARNER, "", TENANT_A)).toBe(false);
      expect(await canAccessLesson(USER_LEARNER, LESSON_1, "")).toBe(false);
    });

    it("returns false if lesson or parent course is not found in tenant", async () => {
      const mockDb = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({ innerJoin: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) })),
          })),
        })),
      } as unknown as AccessDb;

      expect(await canAccessLesson(mockDb, USER_LEARNER, LESSON_1, TENANT_A)).toBe(false);
    });

    it("resolves parent course and delegates access verification", async () => {
      let callIndex = 0;
      const mockDb = {
        select: vi.fn(() => ({
          from: vi.fn(() => {
            callIndex++;
            if (callIndex === 1) {
              return {
                innerJoin: vi.fn(() => ({
                  innerJoin: vi.fn(() => ({ where: vi.fn().mockResolvedValue([{ courseId: COURSE_PAID }]) })),
                })),
              };
            }
            return { where: vi.fn().mockResolvedValue([mockCourse]) };
          }),
        })),
      } as unknown as AccessDb;

      expect(await canAccessLesson(mockDb, USER_AUTHOR, LESSON_1, TENANT_A)).toBe(true);
    });
  });

  describe("enrollLearner", () => {
    it("validates required parameters and throws descriptive errors", async () => {
      await expect(enrollLearner("", COURSE_PAID, TENANT_A)).rejects.toThrow("userId is required");
      await expect(enrollLearner(USER_LEARNER, "", TENANT_A)).rejects.toThrow("courseId is required");
      await expect(enrollLearner(USER_LEARNER, COURSE_PAID, "")).rejects.toThrow("tenantId is required");
    });

    it("throws if course is not found in tenant per ADR-0002", async () => {
      const mockDb = {
        select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) })),
      } as unknown as AccessDb;

      await expect(enrollLearner(mockDb, USER_LEARNER, COURSE_PAID, TENANT_B)).rejects.toThrow(
        `Course "${COURSE_PAID}" not found for tenant "${TENANT_B}"`,
      );
    });

    it("successfully creates paid enrollment with Stripe payment ID", async () => {
      const paymentId = "cs_test_abc123";
      const mockEnrollment = {
        id: "enr_test_1",
        userId: USER_LEARNER,
        courseId: COURSE_PAID,
        stripePaymentId: paymentId,
        enrolledAt: new Date(),
        courseVersionSeen: 2,
      };

      const mockDb = {
        select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([mockCourse]) })) })),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            onConflictDoNothing: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([mockEnrollment]) })),
          })),
        })),
      } as unknown as AccessDb;

      const result = await enrollLearner(mockDb, USER_LEARNER, COURSE_PAID, TENANT_A, { stripePaymentId: paymentId });
      expect(result.id).toBe("enr_test_1");
      expect(result.isNew).toBe(true);
      expect(result.stripePaymentId).toBe(paymentId);
      expect(result.courseVersionSeen).toBe(2);
    });

    it("automatically generates free payment ID for free course enrollments", async () => {
      let insertedValues: Record<string, unknown> = {};

      const mockDb = {
        select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([mockFreeCourse]) })) })),
        insert: vi.fn(() => ({
          values: vi.fn((vals: Record<string, unknown>) => {
            insertedValues = vals;
            return {
              onConflictDoNothing: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ ...vals, enrolledAt: new Date() }]) })),
            };
          }),
        })),
      } as unknown as AccessDb;

      const result = await enrollLearner(mockDb, USER_LEARNER, COURSE_FREE, TENANT_A);
      expect(result.isNew).toBe(true);
      expect((insertedValues.stripePaymentId as string).startsWith("free_")).toBe(true);
    });

    it("handles idempotent re-enrollment when learner is already enrolled", async () => {
      const existingEnrollment = {
        id: "enr_existing_456",
        userId: USER_LEARNER,
        courseId: COURSE_PAID,
        stripePaymentId: "cs_orig_999",
        enrolledAt: new Date("2026-01-01"),
        courseVersionSeen: 1,
      };

      let selectCall = 0;
      const mockDb = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn().mockImplementation(() => {
              selectCall++;
              return Promise.resolve(selectCall === 1 ? [mockCourse] : [existingEnrollment]);
            }),
          })),
        })),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            onConflictDoNothing: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
          })),
        })),
      } as unknown as AccessDb;

      const result = await enrollLearner(mockDb, USER_LEARNER, COURSE_PAID, TENANT_A, {
        stripePaymentId: "cs_duplicate_attempt",
      });

      expect(result.isNew).toBe(false);
      expect(result.id).toBe("enr_existing_456");
      expect(result.stripePaymentId).toBe("cs_orig_999");
    });

    it("supports string paymentId as fourth argument", async () => {
      const mockDb = {
        select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([mockCourse]) })) })),
        insert: vi.fn(() => ({
          values: vi.fn((vals: Record<string, unknown>) => ({
            onConflictDoNothing: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ ...vals, enrolledAt: new Date() }]) })),
          })),
        })),
      } as unknown as AccessDb;

      const result = await enrollLearner(mockDb, USER_LEARNER, COURSE_PAID, TENANT_A, "cs_quick_param");
      expect(result.isNew).toBe(true);
      expect(result.stripePaymentId).toBe("cs_quick_param");
    });
  });
});

const DATABASE_URL = process.env.DATABASE_URL;
const TEST_SCHEMA = "p3_4_access_integration";

const pool = DATABASE_URL
  ? new Pool({ connectionString: DATABASE_URL, options: `-c search_path=${TEST_SCHEMA}` })
  : null;

describe.skipIf(!DATABASE_URL)("access verification against Postgres", () => {
  const db = drizzle(pool as Pool);

  const TENANT_A = "tenant_pg_a";
  const TENANT_B = "tenant_pg_b";
  const AUTHOR = "usr_pg_author";
  const ENROLLED_LEARNER = "usr_pg_enrolled";
  const UNENROLLED_LEARNER = "usr_pg_unenrolled";
  const COURSE_PAID = "crs_pg_paid";
  const COURSE_FREE = "crs_pg_free";
  const COURSE_TENANT_B = "crs_pg_other";
  const MODULE_PAID = "mod_pg_paid";
  const LESSON_PAID = "lsn_pg_paid";

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
        price_cents integer default 0 not null,
        is_free boolean default false not null,
        status text default 'draft' not null,
        version integer default 1 not null
      );
      create index if not exists courses_tenant_id_idx on courses(tenant_id);
      create table if not exists "modules" (
        id text primary key not null,
        course_id text not null references courses(id) on delete cascade,
        title text not null,
        position integer default 0 not null
      );
      create table if not exists "lessons" (
        id text primary key not null,
        module_id text not null references modules(id) on delete cascade,
        type text not null,
        title text not null,
        position integer default 0 not null,
        status text default 'draft' not null
      );
      create table if not exists "enrollments" (
        id text primary key not null,
        user_id text not null references "user"(id) on delete cascade,
        course_id text not null references courses(id) on delete cascade,
        stripe_payment_id text not null unique,
        enrolled_at timestamp with time zone default now() not null,
        course_version_seen integer default 1 not null
      );
      create unique index if not exists enrollments_user_id_course_id_key on enrollments(user_id, course_id);

      insert into "user" (id) values ('${AUTHOR}'), ('${ENROLLED_LEARNER}'), ('${UNENROLLED_LEARNER}') on conflict do nothing;
      insert into courses (id, tenant_id, author_id, title, price_cents, is_free, status, version) values
        ('${COURSE_PAID}', '${TENANT_A}', '${AUTHOR}', 'Paid Course', 9900, false, 'published', 1),
        ('${COURSE_FREE}', '${TENANT_A}', '${AUTHOR}', 'Free Course', 0, true, 'published', 1),
        ('${COURSE_TENANT_B}', '${TENANT_B}', '${AUTHOR}', 'Tenant B Course', 5000, false, 'published', 1)
      on conflict do nothing;
      insert into modules (id, course_id, title, position) values ('${MODULE_PAID}', '${COURSE_PAID}', 'M1', 0) on conflict do nothing;
      insert into lessons (id, module_id, type, title, position, status) values ('${LESSON_PAID}', '${MODULE_PAID}', 'video', 'L1', 0, 'published') on conflict do nothing;
      insert into enrollments (id, user_id, course_id, stripe_payment_id, course_version_seen) values
        ('enr_pg_1', '${ENROLLED_LEARNER}', '${COURSE_PAID}', 'cs_pg_existing_1', 1)
      on conflict do nothing;
    `);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`drop schema if exists ${TEST_SCHEMA} cascade`);
    await pool.end();
  });

  it("evaluates hasAccess accurately across roles and tenancy in Postgres", async () => {
    expect(await hasAccess(db as unknown as AccessDb, null, COURSE_PAID, TENANT_A)).toBe(false);
    expect(await hasAccess(db as unknown as AccessDb, undefined, COURSE_PAID, TENANT_A)).toBe(false);
    expect(await hasAccess(db as unknown as AccessDb, AUTHOR, COURSE_PAID, TENANT_A)).toBe(true);
    expect(await hasAccess(db as unknown as AccessDb, ENROLLED_LEARNER, COURSE_PAID, TENANT_A)).toBe(true);
    expect(await hasAccess(db as unknown as AccessDb, UNENROLLED_LEARNER, COURSE_PAID, TENANT_A)).toBe(false);
    expect(await hasAccess(db as unknown as AccessDb, UNENROLLED_LEARNER, COURSE_FREE, TENANT_A)).toBe(false);
    expect(await hasAccess(db as unknown as AccessDb, ENROLLED_LEARNER, COURSE_TENANT_B, TENANT_A)).toBe(false);
  });

  it("evaluates canAccessLesson accurately in Postgres", async () => {
    expect(await canAccessLesson(db as unknown as AccessDb, AUTHOR, LESSON_PAID, TENANT_A)).toBe(true);
    expect(await canAccessLesson(db as unknown as AccessDb, ENROLLED_LEARNER, LESSON_PAID, TENANT_A)).toBe(true);
    expect(await canAccessLesson(db as unknown as AccessDb, UNENROLLED_LEARNER, LESSON_PAID, TENANT_A)).toBe(false);
    expect(await canAccessLesson(db as unknown as AccessDb, null, LESSON_PAID, TENANT_A)).toBe(false);
    expect(await canAccessLesson(db as unknown as AccessDb, ENROLLED_LEARNER, LESSON_PAID, TENANT_B)).toBe(false);
  });

  it("handles enrollLearner and immediately unlocks hasAccess in Postgres", async () => {
    expect(await hasAccess(db as unknown as AccessDb, UNENROLLED_LEARNER, COURSE_FREE, TENANT_A)).toBe(false);

    const enrollment = await enrollLearner(db as unknown as AccessDb, UNENROLLED_LEARNER, COURSE_FREE, TENANT_A);
    expect(enrollment.isNew).toBe(true);
    expect(enrollment.userId).toBe(UNENROLLED_LEARNER);
    expect(enrollment.courseId).toBe(COURSE_FREE);
    expect(enrollment.stripePaymentId.startsWith("free_")).toBe(true);

    expect(await hasAccess(db as unknown as AccessDb, UNENROLLED_LEARNER, COURSE_FREE, TENANT_A)).toBe(true);

    const duplicate = await enrollLearner(db as unknown as AccessDb, UNENROLLED_LEARNER, COURSE_FREE, TENANT_A);
    expect(duplicate.isNew).toBe(false);
    expect(duplicate.id).toBe(enrollment.id);
  });
});
