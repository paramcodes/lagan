import { EmptyState } from "@lagan/ui";
import { BookOpen } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "../../../../lib/auth";
import { type Role, isInstructor } from "../../../../lib/roles";
import { AnalyticsCharts } from "./analytics-charts";
import { CourseSelector } from "./course-selector";
import { CoursesMetricsTable } from "./courses-metrics-table";
import { DateRangeFilter } from "./date-range-filter";
import { OverviewCards } from "./overview-cards";
import { loadAuthorAnalyticsData, parseAnalyticsParams } from "./query";

export const instant = false;

export const metadata = { title: "Author Analytics" };

interface AnalyticsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  await connection();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    redirect("/sign-in?callbackUrl=/teach/analytics");
    return;
  }

  const user = session.user;
  if (user && typeof user === "object" && "role" in user && typeof user.role === "string") {
    if (!isInstructor(user.role as Role)) {
      redirect("/learn");
      return;
    }
  }

  const rawParams = await searchParams;
  const { range, courseId } = parseAnalyticsParams(rawParams);

  const data = await loadAuthorAnalyticsData({
    authorId: session.user.id,
    range,
    courseId,
  });

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--color-line)] pb-5">
        <div>
          <p className="text-xs font-medium text-[var(--color-edge)]">Instructor Dashboard</p>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-ink)]">
            Course Analytics
          </h1>
          <p className="mt-1 text-xs text-[var(--color-edge)]">
            {data.courses.length === 0
              ? "No courses authored yet"
              : `Tracking performance across ${data.courses.length} ${
                  data.courses.length === 1 ? "course" : "courses"
                }`}
          </p>
        </div>

        {data.courses.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <CourseSelector
              courses={data.courses}
              selectedCourseId={data.selectedCourseId}
              currentRange={data.selectedRange}
            />
            <DateRangeFilter currentRange={data.selectedRange} courseId={data.selectedCourseId} />
          </div>
        )}
      </header>

      {data.courses.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-10 w-10 text-[var(--color-edge)]" aria-hidden="true" />}
          title="No courses created yet"
          description="You have not created any courses yet. Create and publish a course to start tracking student enrollment and curriculum retention."
          variant="dashed"
          action={
            <Link
              href="/teach/courses"
              className="inline-flex items-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Go to Courses
            </Link>
          }
        />
      ) : data.hasNoEvents ? (
        <div className="space-y-6">
          <OverviewCards overview={data.overview} />
          <EmptyState
            title="No analytics recorded"
            description="No student activity found for this timeframe. Try selecting a different date range or share your course to get learners enrolled."
            variant="dashed"
          />
          <CoursesMetricsTable
            courses={data.courses}
            selectedCourseId={data.selectedCourseId}
            currentRange={data.selectedRange}
          />
        </div>
      ) : (
        <div className="space-y-6">
          <OverviewCards overview={data.overview} />
          <AnalyticsCharts
            trendPoints={data.trendPoints}
            dropoffPoints={data.dropoffPoints}
            chartCourse={data.chartCourse}
            selectedCourseId={data.selectedCourseId}
          />
          <CoursesMetricsTable
            courses={data.courses}
            selectedCourseId={data.selectedCourseId}
            currentRange={data.selectedRange}
          />
        </div>
      )}
    </main>
  );
}
