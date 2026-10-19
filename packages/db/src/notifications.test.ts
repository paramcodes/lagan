import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type NotificationDb,
  notifyEnrolledLearnersOfNewContent,
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
      expect(
        (bobNotif?.payload as Record<string, unknown> | undefined)?.lessonId,
      ).toBeUndefined();
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
      expect(result.notifications[0]?.payload.url).toBe(
        "/learn/custom-path-123",
      );
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
      expect(insertBatches).toHaveLength(3);
      expect(insertBatches[0]).toHaveLength(2);
      expect(insertBatches[1]).toHaveLength(2);
      expect(insertBatches[2]).toHaveLength(1);
    });
  });

  describe("deduplication per event", () => {
    it("skips already notified learners on full job retry", async () => {
      const { mockDb } = createMockDb({});

      const firstRun = await notifyEnrolledLearnersOfNewContent(mockDb, {
        courseId: COURSE_1,
        lessonId: LESSON_1,
        title: "Generics Deep Dive",
        tenantId: TENANT_A,
        eventId: EVENT_1,
      });
      expect(firstRun.notifiedCount).toBe(3);
      expect(firstRun.skippedCount).toBe(0);

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
      expect(
        result.notifications.some((n) => n.userId === USER_UNENROLLED),
      ).toBe(false);
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
});
