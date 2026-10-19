import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type NotificationDb,
  notifyEnrolledLearnersOfNewContent,
  prepareEmailJobsForNotificationResult,
  prepareNewContentEmailJobPayload,
  prepareNewContentEmailJobs,
  resetNotificationDb,
  setDefaultNotificationDb,
} from "./notifications";
import { courses } from "./schema/course";
import { enrollments } from "./schema/enrollment";
import { type Notification, notifications } from "./schema/notification";

describe("notifications unit tests with mocked db", () => {
  const TENANT_A = "tenant_alpha";
  const TENANT_B = "tenant_beta";
  const COURSE_1 = "crs_typescript_101";
  const COURSE_2 = "crs_react_patterns";
  const LESSON_1 = "lsn_generics_deep_dive";
  const EVENT_1 = "evt_pub_20261019_01";
  const EVENT_2 = "evt_pub_20261019_02";

  const USER_1 = "usr_alice";
  const USER_2 = "usr_bob";
  const USER_3 = "usr_charlie";
  const USER_UNENROLLED = "usr_outsider";

  const mockCourseA = {
    id: COURSE_1,
    tenantId: TENANT_A,
    title: "TypeScript 101",
  };

  const mockCourseB = {
    id: COURSE_2,
    tenantId: TENANT_B,
    title: "React Patterns",
  };

  const mockEnrollmentsCourse1 = [
    { userId: USER_1, courseId: COURSE_1 },
    { userId: USER_2, courseId: COURSE_1 },
    { userId: USER_3, courseId: COURSE_1 },
  ];

  beforeEach(() => {
    setDefaultNotificationDb(null);
    resetNotificationDb();
  });

  function createMockDb(config: {
    coursesList?: Array<{ id: string; tenantId: string; title: string }>;
    enrollmentsList?: Array<{ userId: string; courseId: string }>;
    existingNotifications?: Notification[];
  }) {
    const coursesList = config.coursesList ?? [mockCourseA];
    const enrollmentsList = config.enrollmentsList ?? mockEnrollmentsCourse1;
    const notificationsList = [...(config.existingNotifications ?? [])];
    const insertBatches: unknown[][] = [];

    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn((table: unknown) => ({
          where: vi.fn().mockImplementation(() => {
            if (table === courses) {
              return Promise.resolve(coursesList);
            }
            if (table === enrollments) {
              return Promise.resolve(enrollmentsList);
            }
            if (table === notifications) {
              return Promise.resolve([...notificationsList]);
            }
            return Promise.resolve([]);
          }),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn((chunk: unknown[]) => ({
          onConflictDoNothing: vi.fn(() => ({
            returning: vi.fn().mockImplementation(() => {
              insertBatches.push(chunk);
              const inserted: Notification[] = [];
              for (const item of chunk as Array<{
                id: string;
                tenantId: string;
                userId: string;
                type: string;
                payload: Record<string, unknown>;
                createdAt?: Date;
              }>) {
                const exists = notificationsList.some((n) => n.id === item.id);
                if (!exists) {
                  const record: Notification = {
                    id: item.id,
                    tenantId: item.tenantId,
                    userId: item.userId,
                    type: item.type,
                    payload: item.payload,
                    readAt: null,
                    createdAt: item.createdAt ?? new Date(),
                  };
                  notificationsList.push(record);
                  inserted.push(record);
                }
              }
              return Promise.resolve(inserted);
            }),
          })),
        })),
      })),
    } as unknown as NotificationDb;

    return { mockDb, insertBatches, notificationsList };
  }

  describe("fan-out to enrolled learners", () => {
    it("notifies all enrolled learners when new lesson content is published", async () => {
      const { mockDb, insertBatches, notificationsList } = createMockDb({});

      const result = await notifyEnrolledLearnersOfNewContent(mockDb, {
        courseId: COURSE_1,
        lessonId: LESSON_1,
        title: "Generics Deep Dive",
        summary: "Comprehensive guide to TypeScript generics.",
        tenantId: TENANT_A,
        eventId: EVENT_1,
      });
      expect(result.enrolledLearnerCount).toBe(3);
      expect(result.notifiedCount).toBe(3);
      expect(result.skippedCount).toBe(0);
      expect(result.notifications).toHaveLength(3);

      expect(notificationsList).toHaveLength(3);
      expect(insertBatches).toHaveLength(1);

      // Verify notification attributes and payload
      const aliceNotif = result.notifications.find((n) => n.userId === USER_1);
      expect(aliceNotif).toBeDefined();
      expect(aliceNotif?.id).toBe(`notif_${EVENT_1}_${USER_1}`);
      expect(aliceNotif?.tenantId).toBe(TENANT_A);
      expect(aliceNotif?.type).toBe("new_content");
      expect(aliceNotif?.readAt).toBeNull();
      expect(aliceNotif?.payload).toEqual({
        eventId: EVENT_1,
        courseId: COURSE_1,
        lessonId: LESSON_1,
        title: "Generics Deep Dive",
        summary: "Comprehensive guide to TypeScript generics.",
        url: `/courses/${COURSE_1}/lessons/${LESSON_1}`,
        contentType: "lesson",
        courseTitle: "TypeScript 101",
      });
    });

    it("notifies enrolled learners when entire course is published with computed url", async () => {
      const { mockDb } = createMockDb({});

      const result = await notifyEnrolledLearnersOfNewContent(mockDb, {
        courseId: COURSE_1,
        title: "Course Updated: TypeScript 101",
        tenantId: TENANT_A,
        eventId: EVENT_1,
      });

      expect(result.notifiedCount).toBe(3);
      const bobNotif = result.notifications.find((n) => n.userId === USER_2);
      expect(bobNotif?.payload).toMatchObject({
        contentType: "course",
        url: `/courses/${COURSE_1}`,
        title: "Course Updated: TypeScript 101",
      });
      expect((bobNotif?.payload as Record<string, unknown> | undefined)?.lessonId).toBeUndefined();
    });

    it("respects custom url option in notification payload", async () => {
      const { mockDb } = createMockDb({});

      const result = await notifyEnrolledLearnersOfNewContent(mockDb, {
        courseId: COURSE_1,
        lessonId: LESSON_1,
        title: "Lesson with Custom Link",
        tenantId: TENANT_A,
        eventId: EVENT_1,
        url: "/learn/custom-path-123",
      });

      expect(result.notifiedCount).toBe(3);
      expect(result.notifications[0]?.payload.url).toBe("/learn/custom-path-123");
    });

    it("chunks batch inserts according to batchSize option", async () => {
      const fiveEnrollments = [
        { userId: "usr_1", courseId: COURSE_1 },
        { userId: "usr_2", courseId: COURSE_1 },
        { userId: "usr_3", courseId: COURSE_1 },
        { userId: "usr_4", courseId: COURSE_1 },
        { userId: "usr_5", courseId: COURSE_1 },
      ];
      const { mockDb, insertBatches } = createMockDb({
        enrollmentsList: fiveEnrollments,
      });

      const result = await notifyEnrolledLearnersOfNewContent(mockDb, {
        courseId: COURSE_1,
        title: "Batch test",
        tenantId: TENANT_A,
        eventId: EVENT_1,
        batchSize: 2,
      });

      expect(result.enrolledLearnerCount).toBe(5);
      expect(result.notifiedCount).toBe(5);
      // 5 items with batchSize 2 -> 3 chunks: [2, 2, 1]
      expect(insertBatches).toHaveLength(3);
      expect(insertBatches[0]).toHaveLength(2);
      expect(insertBatches[1]).toHaveLength(2);
      expect(insertBatches[2]).toHaveLength(1);
    });
  });

  describe("deduplication per event", () => {
    it("skips already notified learners on full job retry", async () => {
      const { mockDb } = createMockDb({});

      // Run 1: initial dispatch
      const firstRun = await notifyEnrolledLearnersOfNewContent(mockDb, {
        courseId: COURSE_1,
        lessonId: LESSON_1,
        title: "Generics Deep Dive",
        tenantId: TENANT_A,
        eventId: EVENT_1,
      });
      expect(firstRun.notifiedCount).toBe(3);
      expect(firstRun.skippedCount).toBe(0);

      // Run 2: job retry with identical eventId
      const secondRun = await notifyEnrolledLearnersOfNewContent(mockDb, {
        courseId: COURSE_1,
        lessonId: LESSON_1,
        title: "Generics Deep Dive",
        tenantId: TENANT_A,
        eventId: EVENT_1,
      });

      expect(secondRun.enrolledLearnerCount).toBe(3);
      expect(secondRun.notifiedCount).toBe(0);
      expect(secondRun.skippedCount).toBe(3);
      expect(secondRun.notifications).toHaveLength(3);
    });

    it("handles partial failure retry: only notifies learners who have not yet received notification", async () => {
      // Alice already received notification for EVENT_1; Bob and Charlie did not
      const existingNotif: Notification = {
        id: `notif_${EVENT_1}_${USER_1}`,
        tenantId: TENANT_A,
        userId: USER_1,
        type: "new_content",
        payload: { eventId: EVENT_1, courseId: COURSE_1, title: "Partial" },
        readAt: null,
        createdAt: new Date(),
      };

      const { mockDb, notificationsList } = createMockDb({
        existingNotifications: [existingNotif],
      });

      const result = await notifyEnrolledLearnersOfNewContent(mockDb, {
        courseId: COURSE_1,
        lessonId: LESSON_1,
        title: "Generics Deep Dive",
        tenantId: TENANT_A,
        eventId: EVENT_1,
      });

      expect(result.enrolledLearnerCount).toBe(3);
      expect(result.notifiedCount).toBe(2);
      expect(result.skippedCount).toBe(1);
      expect(result.notifications).toHaveLength(3);
      expect(notificationsList).toHaveLength(3);
    });

    it("notifies learners again when a distinct eventId is dispatched", async () => {
      const { mockDb } = createMockDb({});

      const run1 = await notifyEnrolledLearnersOfNewContent(mockDb, {
        courseId: COURSE_1,
        title: "First Lesson",
        tenantId: TENANT_A,
        eventId: EVENT_1,
      });
      expect(run1.notifiedCount).toBe(3);

      const run2 = await notifyEnrolledLearnersOfNewContent(mockDb, {
        courseId: COURSE_1,
        title: "Second Lesson",
        tenantId: TENANT_A,
        eventId: EVENT_2,
      });
      expect(run2.notifiedCount).toBe(3);
    });
  });

  describe("unenrolled user exclusion", () => {
    it("never notifies users not present in course enrollments", async () => {
      const { mockDb } = createMockDb({
        enrollmentsList: [{ userId: USER_1, courseId: COURSE_1 }],
      });

      const result = await notifyEnrolledLearnersOfNewContent(mockDb, {
        courseId: COURSE_1,
        title: "Only Enrolled",
        tenantId: TENANT_A,
        eventId: EVENT_1,
      });

      expect(result.enrolledLearnerCount).toBe(1);
      expect(result.notifiedCount).toBe(1);
      expect(result.notifications[0]?.userId).toBe(USER_1);
      expect(result.notifications.some((n) => n.userId === USER_UNENROLLED)).toBe(false);
    });

    it("returns zero notifications when course has zero enrolled learners", async () => {
      const { mockDb, insertBatches } = createMockDb({
        enrollmentsList: [],
      });

      const result = await notifyEnrolledLearnersOfNewContent(mockDb, {
        courseId: COURSE_1,
        title: "Empty Course",
        tenantId: TENANT_A,
        eventId: EVENT_1,
      });

      expect(result.enrolledLearnerCount).toBe(0);
      expect(result.notifiedCount).toBe(0);
      expect(result.skippedCount).toBe(0);
      expect(result.notifications).toHaveLength(0);
      expect(insertBatches).toHaveLength(0);
    });
  });

  describe("multi-tenant scoping", () => {
    it("refuses to notify learners when course belongs to a different tenant", async () => {
      // Course belongs to TENANT_B, but call is made with TENANT_A
      const { mockDb, insertBatches } = createMockDb({
        coursesList: [], // Mocking tenant filter returning 0 courses for mismatched tenant
      });

      const result = await notifyEnrolledLearnersOfNewContent(mockDb, {
        courseId: COURSE_2,
        title: "Cross Tenant Attack",
        tenantId: TENANT_A,
        eventId: EVENT_1,
      });

      expect(result.enrolledLearnerCount).toBe(0);
      expect(result.notifiedCount).toBe(0);
      expect(result.skippedCount).toBe(0);
      expect(result.notifications).toHaveLength(0);
      expect(insertBatches).toHaveLength(0);
    });

    it("correctly scopes notifications to requested tenantId", async () => {
      const { mockDb } = createMockDb({
        coursesList: [mockCourseB],
        enrollmentsList: [{ userId: USER_2, courseId: COURSE_2 }],
      });

      const result = await notifyEnrolledLearnersOfNewContent(mockDb, {
        courseId: COURSE_2,
        title: "React Patterns",
        tenantId: TENANT_B,
        eventId: EVENT_1,
      });

      expect(result.tenantId).toBe(TENANT_B);
      expect(result.notifiedCount).toBe(1);
      expect(result.notifications[0]?.tenantId).toBe(TENANT_B);
    });
  });

  describe("input validation and database resolution seams", () => {
    it("returns zero result on missing courseId, tenantId, eventId, or title", async () => {
      const { mockDb } = createMockDb({});

      const noCourse = await notifyEnrolledLearnersOfNewContent(mockDb, {
        courseId: "",
        tenantId: TENANT_A,
        eventId: EVENT_1,
        title: "Test",
      });
      expect(noCourse.notifiedCount).toBe(0);

      const noTenant = await notifyEnrolledLearnersOfNewContent(mockDb, {
        courseId: COURSE_1,
        tenantId: "",
        eventId: EVENT_1,
        title: "Test",
      });
      expect(noTenant.notifiedCount).toBe(0);

      const noEvent = await notifyEnrolledLearnersOfNewContent(mockDb, {
        courseId: COURSE_1,
        tenantId: TENANT_A,
        eventId: "",
        title: "Test",
      });
      expect(noEvent.notifiedCount).toBe(0);

      const noTitle = await notifyEnrolledLearnersOfNewContent(mockDb, {
        courseId: COURSE_1,
        tenantId: TENANT_A,
        eventId: EVENT_1,
        title: "",
      });
      expect(noTitle.notifiedCount).toBe(0);
    });

    it("supports setDefaultNotificationDb and db inside options object", async () => {
      const { mockDb } = createMockDb({});

      setDefaultNotificationDb(mockDb);
      const res1 = await notifyEnrolledLearnersOfNewContent({
        courseId: COURSE_1,
        title: "Via Default Db",
        tenantId: TENANT_A,
        eventId: EVENT_1,
      });
      expect(res1.notifiedCount).toBe(3);

      setDefaultNotificationDb(null);
      const res2 = await notifyEnrolledLearnersOfNewContent({
        db: mockDb,
        courseId: COURSE_1,
        title: "Via Options Db",
        tenantId: TENANT_A,
        eventId: EVENT_2,
      });
      expect(res2.notifiedCount).toBe(3);
    });

    it("throws when no db is available and DATABASE_URL is undefined", async () => {
      const orig = process.env.DATABASE_URL;
      delete process.env.DATABASE_URL;
      try {
        await expect(
          notifyEnrolledLearnersOfNewContent({
            courseId: COURSE_1,
            title: "Test",
            tenantId: TENANT_A,
            eventId: EVENT_1,
          }),
        ).rejects.toThrow("Notification helper requires a database instance");
      } finally {
        if (orig !== undefined) {
          process.env.DATABASE_URL = orig;
        }
      }
    });
  });

  describe("email job payload integration helpers", () => {
    it("prepares a single email job payload with all required and optional properties", () => {
      const payload = prepareNewContentEmailJobPayload({
        recipient: { email: "alice@example.com", name: "Alice Wonderland" },
        courseTitle: "TypeScript 101",
        contentTitle: "Generics Deep Dive",
        contentType: "lesson",
        contentUrl: "https://lagan.dev/courses/ts-101/lessons/generics",
        summary: "Master generic constraints and variance.",
        publishedBy: "Professor Turing",
        appName: "Lagan Academy",
        appUrl: "https://lagan.dev",
        supportEmail: "help@lagan.dev",
        unsubscribeUrl: "https://lagan.dev/unsub?u=alice",
        eventId: "evt_12345",
      });

      expect(payload).toEqual({
        kind: "notification",
        to: { email: "alice@example.com", name: "Alice Wonderland" },
        type: "new_content_published",
        props: {
          recipientName: "Alice Wonderland",
          courseTitle: "TypeScript 101",
          contentTitle: "Generics Deep Dive",
          contentType: "lesson",
          contentUrl: "https://lagan.dev/courses/ts-101/lessons/generics",
          summary: "Master generic constraints and variance.",
          publishedBy: "Professor Turing",
          appName: "Lagan Academy",
          appUrl: "https://lagan.dev",
          supportEmail: "help@lagan.dev",
          unsubscribeUrl: "https://lagan.dev/unsub?u=alice",
        },
        options: {
          headers: {
            "X-Event-ID": "evt_12345",
          },
        },
      });
    });

    it("handles string recipient address in email job preparation", () => {
      const payload = prepareNewContentEmailJobPayload({
        recipient: "learner@example.com",
        courseTitle: "TypeScript 101",
        contentTitle: "Basic Types",
        contentUrl: "/courses/ts-101/lessons/types",
      });

      expect(payload.to).toBe("learner@example.com");
      expect(payload.props.recipientName).toBe("learner@example.com");
      expect(payload.props.contentType).toBe("lesson");
    });

    it("prepares batch email jobs for multiple recipients", () => {
      const recipients = [
        { email: "alice@example.com", name: "Alice" },
        { email: "bob@example.com", name: "Bob" },
      ];

      const jobs = prepareNewContentEmailJobs({
        recipients,
        courseTitle: "React Patterns",
        contentTitle: "Compound Components",
        contentUrl: "/courses/react/lessons/compound",
        eventId: "evt_batch_01",
      });

      expect(jobs).toHaveLength(2);
      expect(jobs[0]?.props.recipientName).toBe("Alice");
      expect(jobs[1]?.props.recipientName).toBe("Bob");
      expect(jobs[0]?.options?.headers?.["X-Event-ID"]).toBe("evt_batch_01");
    });

    it("bridges notification result into email jobs matching recipient lookup", () => {
      const mockResult = {
        eventId: EVENT_1,
        courseId: COURSE_1,
        lessonId: LESSON_1,
        tenantId: TENANT_A,
        enrolledLearnerCount: 2,
        notifiedCount: 2,
        skippedCount: 0,
        notifications: [
          {
            id: `notif_${EVENT_1}_${USER_1}`,
            tenantId: TENANT_A,
            userId: USER_1,
            type: "new_content",
            payload: {
              eventId: EVENT_1,
              courseId: COURSE_1,
              lessonId: LESSON_1,
              title: "Generics",
              url: `/courses/${COURSE_1}/lessons/${LESSON_1}`,
              contentType: "lesson" as const,
              courseTitle: "TypeScript 101",
            },
            readAt: null,
            createdAt: new Date(),
          },
          {
            id: `notif_${EVENT_1}_${USER_2}`,
            tenantId: TENANT_A,
            userId: USER_2,
            type: "new_content",
            payload: {
              eventId: EVENT_1,
              courseId: COURSE_1,
              lessonId: LESSON_1,
              title: "Generics",
              url: `/courses/${COURSE_1}/lessons/${LESSON_1}`,
              contentType: "lesson" as const,
              courseTitle: "TypeScript 101",
            },
            readAt: null,
            createdAt: new Date(),
          },
        ],
      };

      const recipientsMap = {
        [USER_1]: { email: "alice@example.com", name: "Alice" },
        // USER_2 has no email in map
      };

      const jobs = prepareEmailJobsForNotificationResult({
        result: mockResult,
        recipientsByUserId: recipientsMap,
      });

      expect(jobs).toHaveLength(1);
      expect(jobs[0]?.to).toEqual({
        email: "alice@example.com",
        name: "Alice",
      });
      expect(jobs[0]?.props.contentTitle).toBe("Generics");
      expect(jobs[0]?.props.courseTitle).toBe("TypeScript 101");
    });
  });
});

const DATABASE_URL = process.env.DATABASE_URL;
const TEST_SCHEMA = "p6_3_notifications_integration";

const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      options: `-c search_path=${TEST_SCHEMA}`,
    })
  : null;

describe.skipIf(!DATABASE_URL)("notifications fan-out verification against Postgres", () => {
  const db = drizzle(pool as Pool);

  const TENANT_A = "tenant_int_a";
  const TENANT_B = "tenant_int_b";
  const AUTHOR = "usr_int_author";
  const LEARNER_1 = "usr_int_learner_1";
  const LEARNER_2 = "usr_int_learner_2";
  const UNENROLLED = "usr_int_unenrolled";

  const COURSE_A = "crs_int_a";
  const COURSE_B = "crs_int_b";
  const LESSON_A1 = "lsn_int_a1";
  const EVENT_INT_1 = "evt_int_101";

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

      create table if not exists "enrollments" (
        id text primary key not null,
        user_id text not null references "user"(id) on delete cascade,
        course_id text not null references courses(id) on delete cascade,
        stripe_payment_id text not null unique,
        enrolled_at timestamp with time zone default now() not null,
        course_version_seen integer default 1 not null
      );
      create unique index if not exists enrollments_user_id_course_id_key on enrollments(user_id, course_id);

      create table if not exists "notifications" (
        id text primary key not null,
        tenant_id varchar(64) not null,
        user_id text not null references "user"(id) on delete cascade,
        type varchar(64) not null,
        payload jsonb default '{}'::jsonb not null,
        read_at timestamp with time zone,
        created_at timestamp with time zone default now() not null
      );
      create index if not exists notifications_user_id_read_at_created_at_idx on notifications(user_id, read_at, created_at);
      create index if not exists notifications_tenant_id_idx on notifications(tenant_id);

      insert into "user" (id) values ('${AUTHOR}'), ('${LEARNER_1}'), ('${LEARNER_2}'), ('${UNENROLLED}') on conflict do nothing;
      insert into courses (id, tenant_id, author_id, title) values
        ('${COURSE_A}', '${TENANT_A}', '${AUTHOR}', 'Course In Tenant A'),
        ('${COURSE_B}', '${TENANT_B}', '${AUTHOR}', 'Course In Tenant B')
      on conflict do nothing;

      insert into enrollments (id, user_id, course_id, stripe_payment_id) values
        ('enr_1', '${LEARNER_1}', '${COURSE_A}', 'pm_1'),
        ('enr_2', '${LEARNER_2}', '${COURSE_A}', 'pm_2')
      on conflict do nothing;
    `);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`drop schema if exists ${TEST_SCHEMA} cascade`);
    await pool.end();
  });

  it("performs idempotent fan-out and deduplication against real PostgreSQL", async () => {
    const res1 = await notifyEnrolledLearnersOfNewContent(db as unknown as NotificationDb, {
      courseId: COURSE_A,
      lessonId: LESSON_A1,
      title: "Postgres Fanout Lesson",
      tenantId: TENANT_A,
      eventId: EVENT_INT_1,
    });

    expect(res1.enrolledLearnerCount).toBe(2);
    expect(res1.notifiedCount).toBe(2);
    expect(res1.skippedCount).toBe(0);

    // Verify retry does not duplicate rows
    const res2 = await notifyEnrolledLearnersOfNewContent(db as unknown as NotificationDb, {
      courseId: COURSE_A,
      lessonId: LESSON_A1,
      title: "Postgres Fanout Lesson",
      tenantId: TENANT_A,
      eventId: EVENT_INT_1,
    });

    expect(res2.enrolledLearnerCount).toBe(2);
    expect(res2.notifiedCount).toBe(0);
    expect(res2.skippedCount).toBe(2);

    // Verify unenrolled user was never notified
    const unenrolledRows = await pool?.query(
      `select * from notifications where user_id = '${UNENROLLED}'`,
    );
    expect(unenrolledRows?.rows).toHaveLength(0);

    // Verify cross-tenant isolation
    const crossTenantRes = await notifyEnrolledLearnersOfNewContent(
      db as unknown as NotificationDb,
      {
        courseId: COURSE_A,
        title: "Cross Tenant",
        tenantId: TENANT_B,
        eventId: "evt_int_cross",
      },
    );
    expect(crossTenantRes.notifiedCount).toBe(0);
  });
});
