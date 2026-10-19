export type NotificationType =
  | "course_published"
  | "lesson_published"
  | "enrollment_confirmed"
  | "announcement_posted"
  | "welcome"
  | "lesson_complete";

export const NOTIFICATION_TYPES = [
  "course_published",
  "lesson_published",
  "enrollment_confirmed",
  "announcement_posted",
  "welcome",
  "lesson_complete",
] as const;

export type NotificationDeliveryChannel = "in_app" | "email" | "sse" | "push";
export const NOTIFICATION_DELIVERY_CHANNELS = ["in_app", "email", "sse", "push"] as const;

export type NotificationChannel = NotificationDeliveryChannel;
export const NOTIFICATION_CHANNELS = NOTIFICATION_DELIVERY_CHANNELS;

export type NotificationDeliveryStatus = "pending" | "sent" | "delivered" | "failed" | "suppressed";

export const NOTIFICATION_DELIVERY_STATUSES = [
  "pending",
  "sent",
  "delivered",
  "failed",
  "suppressed",
] as const;

export interface NotificationPayload {
  courseId?: string;
  courseTitle?: string;
  moduleId?: string;
  lessonId?: string;
  lessonTitle?: string;
  enrollmentId?: string;
  actorName?: string;
  url?: string;
  message?: string;
  [key: string]: unknown;
}

export interface Notification {
  id: string;
  tenantId: string;
  userId: string;
  type: NotificationType | string;
  payload: NotificationPayload;
  readAt: Date | null;
  createdAt: Date;
}
