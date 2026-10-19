export type CourseEventType = "view" | "progress" | "complete" | "drop";
export const COURSE_EVENT_TYPES = ["view", "progress", "complete", "drop"] as const;

export type AnalyticsEventType = CourseEventType;
export const ANALYTICS_EVENT_TYPES = COURSE_EVENT_TYPES;

export interface CourseEvent {
  id: string;
  tenantId: string;
  userId: string;
  courseId: string;
  lessonId: string | null;
  type: CourseEventType;
  positionSeconds: number;
  createdAt: Date;
}

export interface DateWindow {
  from?: Date | string | null;
  to?: Date | string | null;
}

export interface CourseMetricsOptions extends DateWindow {
  authorId: string;
  tenantId: string;
  courseId: string;
}

export interface CourseMetrics {
  courseId: string;
  enrolments: number;
  totalEnrolments: number;
  starts: number;
  completions: number;
  dropOffs: number;
  completionRate: number;
}

export interface AuthorCoursesMetricsOptions extends DateWindow {
  authorId: string;
  tenantId: string;
}

export interface LessonDropOffOptions extends DateWindow {
  authorId: string;
  tenantId: string;
  courseId: string;
}

export interface LessonDropOffMetric {
  lessonId: string;
  title: string;
  lessonTitle: string;
  moduleId: string;
  position: number;
  views: number;
  completions: number;
  dropOffs: number;
  drops: number;
  dropOffRate: number;
}

export type TrendInterval = "day" | "week" | "month";
export const TREND_INTERVALS = ["day", "week", "month"] as const;

export interface CourseTrendOptions extends DateWindow {
  authorId: string;
  tenantId: string;
  courseId: string;
  interval?: TrendInterval;
}

export interface CourseTrendBucket {
  period: string;
  date: Date;
  enrolments: number;
  totalEnrolments: number;
  starts: number;
  completions: number;
  dropOffs: number;
  completionRate: number;
}
