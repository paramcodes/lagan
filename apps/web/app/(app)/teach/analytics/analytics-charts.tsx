"use client";

import {
  ChartCard,
  LessonDropoffBarChart,
  type LessonDropoffPoint,
  TrendLineChart,
  type TrendPoint,
} from "@lagan/ui";
import type { CourseSummaryItem } from "./types";

interface AnalyticsChartsProps {
  trendPoints: TrendPoint[];
  dropoffPoints: LessonDropoffPoint[];
  chartCourse: CourseSummaryItem | null;
  selectedCourseId: string | null;
}

export function AnalyticsCharts({
  trendPoints,
  dropoffPoints,
  chartCourse,
  selectedCourseId,
}: AnalyticsChartsProps) {
  const courseContextDescription =
    !selectedCourseId && chartCourse ? `Displaying metrics for: ${chartCourse.title}` : undefined;

  const totalWindowEnrolments = trendPoints.reduce((acc, pt) => acc + pt.value, 0);

  return (
    <section
      aria-label="Course analytics visualizations"
      className="grid grid-cols-1 gap-6 lg:grid-cols-2"
    >
      <ChartCard
        title="Enrolment Trend"
        description={courseContextDescription ?? "New learner enrolments over time"}
        metric={totalWindowEnrolments.toLocaleString()}
        metricLabel="period enrolments"
      >
        <div data-testid="trend-chart-container">
          <TrendLineChart
            data={trendPoints}
            title="Enrolments over time"
            description="Daily and period-aggregated learner enrolment volume"
            summary={`Trend chart showing ${trendPoints.length} data points with a total of ${totalWindowEnrolments} enrolments.`}
            tableCaption="Enrolment trend data table"
            showTableToggle={true}
            showDots={true}
            showArea={true}
            height={260}
            valueFormatter={(val) => `${val.toLocaleString()} enrolled`}
          />
        </div>
      </ChartCard>

      <ChartCard
        title="Lesson Drop-Off Progression"
        description={
          courseContextDescription ?? "Student progression and attrition across published lessons"
        }
      >
        <div data-testid="dropoff-chart-container">
          <LessonDropoffBarChart
            data={dropoffPoints}
            title="Curriculum Drop-Off"
            description="Learner completion counts and attrition rates per lesson"
            summary={`Lesson progression funnel across ${dropoffPoints.length} lessons.`}
            tableCaption="Lesson drop-off progression table"
            showTableToggle={true}
            orientation="horizontal"
            height={Math.max(260, dropoffPoints.length * 48)}
            valueFormatter={(val) => `${val.toLocaleString()} learners`}
            rateFormatter={(rate) => `${rate.toFixed(1)}%`}
          />
        </div>
      </ChartCard>
    </section>
  );
}
