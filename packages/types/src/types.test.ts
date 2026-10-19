import { describe, expect, it } from "vitest";
import {
  type AnalyticsEventType,
  type AuthSession,
  type AuthUser,
  COURSE_EVENT_TYPES,
  COURSE_STATUSES,
  type Course,
  type CourseEvent,
  type CourseEventType,
  type CourseMetrics,
  type CoursePrice,
  type CoursePriceInput,
  type CourseProgressSummary,
  type CourseStatus,
  type CourseTrendBucket,
  type CourseWithModules,
  ENROLLMENT_STATUSES,
  type Enrollment,
  type EnrollmentIntent,
  type EnrollmentStatus,
  LESSON_STATUSES,
  LESSON_TYPES,
  type Lesson,
  type LessonDropOffMetric,
  type LessonProgress,
  type LessonProgressInput,
  type LessonStatus,
  type LessonType,
  type Module,
  type ModuleProgressSummary,
  type ModuleWithLessons,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_DELIVERY_CHANNELS,
  NOTIFICATION_DELIVERY_STATUSES,
  NOTIFICATION_TYPES,
  type Notification,
  type NotificationChannel,
  type NotificationDeliveryChannel,
  type NotificationDeliveryStatus,
  type NotificationPayload,
  type NotificationType,
  PAYMENT_STATUSES,
  PROFILE_STATUSES,
  type PaymentStatus,
  type PriceComputation,
  type ProfileStatus,
  ROLES,
  type Role,
  type Session,
  type SessionData,
  type SocialLink,
  type StripeCheckoutSession,
  type StripeCheckoutSessionRequest,
  TREND_INTERVALS,
  type TrendInterval,
  USER_ROLES,
  type UserProfile,
  type UserRole,
} from "./index";

describe("packages/types domain definitions", () => {
  describe("user domain", () => {
    it("exports user roles and profile statuses", () => {
      expect(USER_ROLES).toContain("student");
      expect(USER_ROLES).toContain("instructor");
      expect(USER_ROLES).toContain("ta");
      expect(USER_ROLES).toContain("admin");
      expect(ROLES).toEqual(USER_ROLES);

      expect(PROFILE_STATUSES).toContain("incomplete");
      expect(PROFILE_STATUSES).toContain("complete");
      expect(PROFILE_STATUSES).toContain("active");
      expect(PROFILE_STATUSES).toContain("suspended");
      expect(PROFILE_STATUSES).toContain("pending");
    });

    it("verifies user profile shape", () => {
      const now = new Date();
      const socialLink: SocialLink = { label: "GitHub", url: "https://github.com" };
      const status: ProfileStatus = "complete";

      const profile: UserProfile = {
        id: "p_1",
        userId: "u_1",
        bio: "Educator & engineer",
        websiteUrl: "https://example.com",
        socialLinksJson: JSON.stringify([socialLink]),
        socialLinks: [socialLink],
        avatarUrl: "https://example.com/avatar.png",
        status,
        createdAt: now,
        updatedAt: now,
      };

      expect(profile.id).toBe("p_1");
      expect(profile.socialLinks?.[0]?.label).toBe("GitHub");
      expect(profile.status).toBe("complete");
    });

    it("verifies auth session and user shape", () => {
      const now = new Date();
      const role: UserRole = "instructor";
      const user: AuthUser = {
        id: "u_1",
        email: "alice@example.com",
        emailVerified: true,
        name: "Alice Smith",
        role,
        createdAt: now,
        updatedAt: now,
      };

      const sessionData: SessionData = {
        id: "s_1",
        userId: "u_1",
        expiresAt: new Date(now.getTime() + 86400000),
        token: "tok_123",
        createdAt: now,
        updatedAt: now,
      };

      const session: AuthSession = {
        session: sessionData,
        user,
      };

      const aliasedSession: Session = session;

      expect(aliasedSession.user.email).toBe("alice@example.com");
      expect(aliasedSession.session.token).toBe("tok_123");
    });
  });

  describe("course domain", () => {
    it("exports course and lesson status lists", () => {
      expect(COURSE_STATUSES).toEqual(["draft", "published", "archived"]);
      expect(LESSON_STATUSES).toEqual(["draft", "published"]);
      expect(LESSON_TYPES).toEqual(["video", "text", "quiz", "file", "external"]);
    });

    it("verifies course hierarchy with modules and lessons", () => {
      const now = new Date();
      const lessonType: LessonType = "video";
      const lessonStatus: LessonStatus = "published";

      const lesson: Lesson = {
        id: "les_1",
        moduleId: "mod_1",
        type: lessonType,
        title: "Introduction",
        position: 0,
        status: lessonStatus,
        muxPlaybackId: "mux_abc123",
        contentJson: null,
        externalUrl: null,
        fileKey: null,
        updatedAt: now,
      };

      const moduleItem: Module = {
        id: "mod_1",
        courseId: "crs_1",
        title: "Module 1",
        position: 0,
      };

      const moduleWithLessons: ModuleWithLessons = {
        ...moduleItem,
        lessons: [lesson],
      };

      const courseStatus: CourseStatus = "published";
      const baseCourse: Course = {
        id: "crs_1",
        tenantId: "tenant_default",
        authorId: "u_auth",
        title: "TypeScript Mastery",
        description: "Deep dive into types",
        priceCents: 4900,
        discountPercent: 10,
        isFree: false,
        status: courseStatus,
        version: 1,
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
      };

      const course: CourseWithModules = {
        ...baseCourse,
        modules: [moduleWithLessons],
      };

      expect(course.modules).toHaveLength(1);
      expect(course.modules[0]?.lessons[0]?.type).toBe("video");
      expect(course.status).toBe("published");
    });
  });

  describe("commerce domain", () => {
    it("exports payment and enrollment statuses", () => {
      expect(PAYMENT_STATUSES).toContain("succeeded");
      expect(PAYMENT_STATUSES).toContain("pending");
      expect(PAYMENT_STATUSES).toContain("failed");
      expect(ENROLLMENT_STATUSES).toContain("active");
    });

    it("verifies enrollment entity and pricing structures", () => {
      const now = new Date();
      const enrollmentStatus: EnrollmentStatus = "active";
      const paymentStatus: PaymentStatus = "succeeded";

      const enrollment: Enrollment = {
        id: "enr_1",
        userId: "u_1",
        courseId: "crs_1",
        stripePaymentId: "pi_123",
        enrolledAt: now,
        courseVersionSeen: 1,
      };

      const intent: EnrollmentIntent = {
        userId: "u_1",
        courseId: "crs_1",
        stripePaymentId: "pi_123",
      };

      const priceInput: CoursePriceInput = {
        priceCents: 10000,
        discountPercent: 20,
        isFree: false,
      };

      const computation: PriceComputation = {
        rawPriceCents: 10000,
        discountPercent: 20,
        finalPriceCents: 8000,
        isFree: false,
      };

      const formattedPrice: CoursePrice = {
        amount: "$80.00",
        originalAmount: "$100.00",
        isFree: false,
      };

      const checkoutReq: StripeCheckoutSessionRequest = {
        userId: "u_1",
        courseId: "crs_1",
        courseTitle: "TypeScript Mastery",
        priceCents: 8000,
        currency: "usd",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      };

      const checkoutSession: StripeCheckoutSession = {
        id: "cs_123",
        url: "https://checkout.stripe.com/123",
      };

      expect(enrollmentStatus).toBe("active");
      expect(paymentStatus).toBe("succeeded");
      expect(enrollment.stripePaymentId).toBe(intent.stripePaymentId);
      expect(computation.finalPriceCents).toBe(8000);
      expect(priceInput.priceCents).toBe(10000);
      expect(formattedPrice.isFree).toBe(false);
      expect(checkoutReq.currency).toBe("usd");
      expect(checkoutSession.id).toBe("cs_123");
    });
  });

  describe("progress domain", () => {
    it("verifies lesson progress and course summary", () => {
      const now = new Date();
      const progress: LessonProgress = {
        id: "prog_1",
        tenantId: "tenant_default",
        userId: "u_1",
        lessonId: "les_1",
        courseId: "crs_1",
        completed: true,
        completedAt: now,
        positionSeconds: 120,
        lastSeenAt: now,
      };

      const input: LessonProgressInput = {
        lessonId: "les_1",
        courseId: "crs_1",
        positionSeconds: 120,
        completed: true,
      };

      const summary: CourseProgressSummary = {
        courseId: "crs_1",
        userId: "u_1",
        totalLessons: 10,
        completedLessons: 7,
        percent: 70,
        isCompleted: false,
        lastSeenLessonId: "les_1",
        lastSeenAt: now,
      };

      const moduleSummary: ModuleProgressSummary = {
        moduleId: "mod_1",
        totalLessons: 5,
        completedLessons: 5,
        percent: 100,
        isCompleted: true,
      };

      expect(progress.completed).toBe(true);
      expect(input.positionSeconds).toBe(120);
      expect(summary.percent).toBe(70);
      expect(moduleSummary.isCompleted).toBe(true);
    });
  });

  describe("analytics domain", () => {
    it("exports event types and interval options", () => {
      expect(COURSE_EVENT_TYPES).toEqual(["view", "progress", "complete", "drop"]);
      expect(TREND_INTERVALS).toEqual(["day", "week", "month"]);
    });

    it("verifies course event and metrics structures", () => {
      const now = new Date();
      const eventType: CourseEventType = "progress";
      const event: CourseEvent = {
        id: "evt_1",
        tenantId: "tenant_default",
        userId: "u_1",
        courseId: "crs_1",
        lessonId: "les_1",
        type: eventType,
        positionSeconds: 45,
        createdAt: now,
      };

      const metrics: CourseMetrics = {
        courseId: "crs_1",
        enrolments: 50,
        totalEnrolments: 120,
        starts: 40,
        completions: 25,
        dropOffs: 5,
        completionRate: 0.625,
      };

      const dropOff: LessonDropOffMetric = {
        lessonId: "les_1",
        title: "Setup",
        lessonTitle: "Setup",
        moduleId: "mod_1",
        position: 0,
        views: 40,
        completions: 38,
        dropOffs: 2,
        drops: 2,
        dropOffRate: 0.05,
      };

      const interval: TrendInterval = "day";
      const trend: CourseTrendBucket = {
        period: "2026-10-19",
        date: now,
        enrolments: 10,
        totalEnrolments: 120,
        starts: 8,
        completions: 5,
        dropOffs: 1,
        completionRate: 0.625,
      };

      expect(event.type).toBe("progress");
      expect(metrics.completionRate).toBe(0.625);
      expect(dropOff.views).toBe(40);
      expect(trend.starts).toBe(8);
      expect(interval).toBe("day");
    });
  });

  describe("notification domain", () => {
    it("exports notification types and channels", () => {
      expect(NOTIFICATION_TYPES).toContain("course_published");
      expect(NOTIFICATION_TYPES).toContain("lesson_published");
      expect(NOTIFICATION_TYPES).toContain("enrollment_confirmed");
      expect(NOTIFICATION_TYPES).toContain("announcement_posted");

      expect(NOTIFICATION_DELIVERY_CHANNELS).toContain("in_app");
      expect(NOTIFICATION_DELIVERY_CHANNELS).toContain("email");
      expect(NOTIFICATION_CHANNELS).toEqual(NOTIFICATION_DELIVERY_CHANNELS);
      expect(NOTIFICATION_DELIVERY_STATUSES).toContain("delivered");
    });

    it("verifies notification entity and payload", () => {
      const now = new Date();
      const notifType: NotificationType = "lesson_published";
      const channel: NotificationDeliveryChannel = "in_app";
      const aliasedChannel: NotificationChannel = channel;
      const deliveryStatus: NotificationDeliveryStatus = "delivered";

      const payload: NotificationPayload = {
        courseId: "crs_1",
        courseTitle: "TypeScript Mastery",
        lessonId: "les_1",
        lessonTitle: "Welcome",
        url: "/courses/crs_1/lessons/les_1",
      };

      const notification: Notification = {
        id: "notif_1",
        tenantId: "tenant_default",
        userId: "u_1",
        type: notifType,
        payload,
        readAt: null,
        createdAt: now,
      };

      expect(notification.type).toBe("lesson_published");
      expect(notification.payload.courseTitle).toBe("TypeScript Mastery");
      expect(notification.readAt).toBeNull();
      expect(aliasedChannel).toBe("in_app");
      expect(deliveryStatus).toBe("delivered");
    });
  });

  describe("type-level assertions", () => {
    it("maintains type compatibility invariants", () => {
      type Equals<T, S> = [T] extends [S] ? ([S] extends [T] ? true : false) : false;

      const userRoleMatches: Equals<UserRole, Role> = true;
      const analyticsTypeMatches: Equals<CourseEventType, AnalyticsEventType> = true;
      const channelMatches: Equals<
        NotificationDeliveryChannel,
        "in_app" | "email" | "sse" | "push"
      > = true;
      const courseStatusMatches: Equals<CourseStatus, "draft" | "published" | "archived"> = true;
      const lessonTypeMatches: Equals<LessonType, "video" | "text" | "quiz" | "file" | "external"> =
        true;
      const paymentStatusMatches: Equals<
        PaymentStatus,
        "pending" | "succeeded" | "failed" | "refunded" | "canceled"
      > = true;

      expect(userRoleMatches).toBe(true);
      expect(analyticsTypeMatches).toBe(true);
      expect(channelMatches).toBe(true);
      expect(courseStatusMatches).toBe(true);
      expect(lessonTypeMatches).toBe(true);
      expect(paymentStatusMatches).toBe(true);
    });
  });
});
