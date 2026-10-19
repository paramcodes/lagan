import { Badge } from "@lagan/ui";
import Link from "next/link";
import type { CourseSummaryItem, DateRangeKey } from "./types";

interface CoursesMetricsTableProps {
  courses: CourseSummaryItem[];
  selectedCourseId: string | null;
  currentRange: DateRangeKey;
}

export function CoursesMetricsTable({
  courses,
  selectedCourseId,
  currentRange,
}: CoursesMetricsTableProps) {
  if (courses.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Author courses performance breakdown"
      className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-2xs"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-ink)]">
            Course Performance Breakdown
          </h2>
          <p className="mt-0.5 text-xs text-[var(--color-edge)]">
            Detailed engagement and completion statistics across your curriculum
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--color-line)] text-[var(--color-edge)]">
              <th scope="col" className="py-2.5 pr-4 font-medium">
                Course
              </th>
              <th scope="col" className="py-2.5 px-3 font-medium">
                Status
              </th>
              <th scope="col" className="py-2.5 px-3 text-right font-medium">
                Enrolments
              </th>
              <th scope="col" className="py-2.5 px-3 text-right font-medium">
                Starts
              </th>
              <th scope="col" className="py-2.5 px-3 text-right font-medium">
                Completions
              </th>
              <th scope="col" className="py-2.5 px-3 text-right font-medium">
                Completion Rate
              </th>
              <th scope="col" className="py-2.5 pl-3 text-right font-medium">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-line)] text-[var(--color-ink)]">
            {courses.map((c) => {
              const isSelected = c.id === selectedCourseId;
              const params = new URLSearchParams();
              if (currentRange !== "30d") {
                params.set("range", currentRange);
              }
              params.set("courseId", c.id);
              const filterHref = `/teach/analytics?${params.toString()}`;

              return (
                <tr
                  key={c.id}
                  className={[
                    "transition-colors hover:bg-[var(--color-canvas)]",
                    isSelected ? "bg-[var(--color-canvas)]/60 font-medium" : "",
                  ].join(" ")}
                >
                  <td className="py-3 pr-4">
                    <span className="font-medium text-[var(--color-ink)]">{c.title}</span>
                  </td>
                  <td className="py-3 px-3">
                    <Badge variant={c.status === "published" ? "success" : "neutral"}>
                      {c.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-3 text-right">
                    {c.metrics.totalEnrolments.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right">{c.metrics.starts.toLocaleString()}</td>
                  <td className="py-3 px-3 text-right">{c.metrics.completions.toLocaleString()}</td>
                  <td className="py-3 px-3 text-right">
                    {(c.metrics.completionRate * 100).toFixed(1)}%
                  </td>
                  <td className="py-3 pl-3 text-right">
                    <Link
                      href={filterHref}
                      className="inline-flex rounded-[var(--radius-chip)] border border-[var(--color-line)] bg-[var(--color-surface)] px-2.5 py-1 text-xs text-[var(--color-ink)] hover:border-[var(--color-edge)] hover:bg-[var(--color-canvas)]"
                    >
                      {isSelected ? "Selected" : "Filter"}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
