import type { AnalyticsOverviewMetrics } from "./types";

interface OverviewCardsProps {
  overview: AnalyticsOverviewMetrics;
}

export function OverviewCards({ overview }: OverviewCardsProps) {
  const cards = [
    {
      id: "total-enrolments",
      label: "Total Enrolments",
      value: overview.totalEnrolments.toLocaleString(),
      subtext: "Enrolled learners",
      testId: "metric-total-enrolments",
    },
    {
      id: "course-starts",
      label: "Course Starts",
      value: overview.starts.toLocaleString(),
      subtext: "Learners who began course",
      testId: "metric-course-starts",
    },
    {
      id: "completions",
      label: "Completions",
      value: overview.completions.toLocaleString(),
      subtext: "Finished entire curriculum",
      testId: "metric-completions",
    },
    {
      id: "completion-rate",
      label: "Overall Completion Rate",
      value: `${(overview.completionRate * 100).toFixed(1)}%`,
      subtext: "Completions per course start",
      testId: "metric-completion-rate",
    },
  ];

  return (
    <section
      aria-label="Key performance metrics"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      {cards.map((card) => (
        <div
          key={card.id}
          data-testid={card.testId}
          className="flex flex-col gap-1 rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-2xs transition-colors"
        >
          <span className="text-xs font-medium text-[var(--color-edge)]">{card.label}</span>
          <span className="text-3xl font-bold tracking-tight text-[var(--color-ink)]">
            {card.value}
          </span>
          <span className="text-xs text-[var(--color-edge)]">{card.subtext}</span>
        </div>
      ))}
    </section>
  );
}
