import Link from "next/link";
import type { DateRangeKey } from "./types";

interface DateRangeFilterProps {
  currentRange: DateRangeKey;
  courseId?: string | null;
}

const RANGES: readonly { key: DateRangeKey; label: string }[] = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "all", label: "All time" },
];

export function DateRangeFilter({ currentRange, courseId }: DateRangeFilterProps) {
  return (
    <nav
      aria-label="Date range filter"
      className="inline-flex items-center rounded-[var(--radius-control)] border border-[var(--color-line)] bg-[var(--color-surface)] p-1 shadow-2xs"
    >
      {RANGES.map((item) => {
        const isActive = item.key === currentRange;
        const params = new URLSearchParams();
        params.set("range", item.key);
        if (courseId) {
          params.set("courseId", courseId);
        }
        const href = `/teach/analytics?${params.toString()}`;

        return (
          <Link
            key={item.key}
            href={href}
            aria-current={isActive ? "page" : undefined}
            aria-label={`Filter by ${item.label}`}
            className={[
              "rounded-[var(--radius-chip)] px-3 py-1.5 text-xs font-medium transition-colors",
              isActive
                ? "bg-[var(--color-brand)] text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-[var(--color-edge)] hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)]",
            ].join(" ")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
