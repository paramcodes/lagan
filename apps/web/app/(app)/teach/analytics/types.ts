import type { CourseMetrics, CourseStatus } from "@lagan/db";
import type { LessonDropoffPoint, TrendPoint } from "@lagan/ui";

export type DateRangeKey = "7d" | "30d" | "90d" | "all";

export interface AnalyticsOverviewMetrics {
  totalEnrolments: number;
  starts: number;
  completions: number;
  dropOffs: number;
  completionRate: number;
}

export interface CourseSummaryItem {
  id: string;
  title: string;
  status: CourseStatus;
  metrics: CourseMetrics;
}

export interface AuthorAnalyticsData {
  courses: CourseSummaryItem[];
  selectedCourse: CourseSummaryItem | null;
  selectedCourseId: string | null;
  chartCourse: CourseSummaryItem | null;
  selectedRange: DateRangeKey;
  overview: AnalyticsOverviewMetrics;
  trendPoints: TrendPoint[];
  dropoffPoints: LessonDropoffPoint[];
  hasNoEvents: boolean;
  dateWindow: { from?: Date; to?: Date };
}
