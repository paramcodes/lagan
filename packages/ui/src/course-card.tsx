import { BookOpen } from "lucide-react";
import { formatPrice } from "./format-price";

/** The subset of a course the catalogue surfaces. Decoupled from the db row. */
export interface CourseCardData {
  id: string;
  title: string;
  authorName: string;
  priceCents: number;
  discountPercent: number;
  isFree: boolean;
  /** `"published"` in prod; carried for tests and future badges. */
  status?: string;
  /** Optional badge label (e.g. "Featured", "New", "Bestseller"). */
  badge?: string;
  /** Optional image thumbnail URL. */
  thumbnailUrl?: string | null;
}

const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-canvas)]";

const CARD_SHELL = [
  "group flex h-full flex-col overflow-hidden rounded-[var(--radius-panel)] border",
  "border-[var(--color-line)] bg-[var(--color-surface)] transition-colors",
  "hover:border-[var(--color-edge)]",
].join(" ");

function Thumbnail({
  size = "card",
  thumbnailUrl,
  title,
  badge,
}: {
  size?: "card" | "row" | undefined;
  thumbnailUrl?: string | null | undefined;
  title?: string | undefined;
  badge?: string | undefined;
}) {
  return (
    <div
      aria-hidden="true"
      className={[
        "relative flex shrink-0 items-center justify-center overflow-hidden border-[var(--color-line)] bg-[var(--color-canvas)] text-[var(--color-edge)]",
        size === "card" ? "h-32 w-full border-b" : "h-10 w-10 rounded-[var(--radius-chip)] border",
      ].join(" ")}
    >
      {thumbnailUrl ? (
        <img src={thumbnailUrl} alt={title ?? ""} className="h-full w-full object-cover" />
      ) : (
        <BookOpen className={size === "card" ? "h-6 w-6" : "h-5 w-5"} />
      )}
      {badge && size === "card" ? (
        <span className="absolute right-2 top-2 rounded-[var(--radius-chip)] bg-[var(--color-brand)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-surface)]">
          {badge}
        </span>
      ) : null}
    </div>
  );
}

function Price({ course, align = "left" }: { course: CourseCardData; align?: "left" | "right" }) {
  const price = formatPrice(course);

  return (
    <span
      className={[
        "flex items-baseline gap-2 tabular-nums",
        align === "right" ? "justify-end" : "justify-start",
      ].join(" ")}
    >
      <span className="text-sm font-semibold text-[var(--color-ink)]">{price.amount}</span>
      {price.originalAmount ? (
        <span className="text-xs text-[var(--color-ink2)] line-through">
          {price.originalAmount}
        </span>
      ) : null}
    </span>
  );
}

/** Catalogue card. The whole card is one link, so it is reachable and activatable by keyboard. */
export function CourseCard({ course, className }: { course: CourseCardData; className?: string }) {
  return (
    <article className={[CARD_SHELL, className].filter(Boolean).join(" ")}>
      <a href={`/courses/${course.id}`} className={["flex flex-1 flex-col", FOCUS_RING].join(" ")}>
        <Thumbnail thumbnailUrl={course.thumbnailUrl} title={course.title} badge={course.badge} />
        <div className="flex flex-1 flex-col gap-1 px-4 py-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-[var(--color-ink)]">{course.title}</h3>
            {course.badge ? (
              <span className="shrink-0 rounded-[var(--radius-chip)] border border-[var(--color-line)] bg-[var(--color-canvas)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-ink)] sm:hidden">
                {course.badge}
              </span>
            ) : null}
          </div>
          <p className="text-xs text-[var(--color-ink2)]">{course.authorName}</p>
          <span className="mt-auto pt-3">
            <Price course={course} />
          </span>
        </div>
      </a>
    </article>
  );
}

/** Ledger row: one hairline-separated line per course, numerals aligned right. */
export function CourseLedgerRow({
  course,
  className,
}: {
  course: CourseCardData;
  className?: string;
}) {
  return (
    <li
      className={["border-b border-[var(--color-line)] last:border-b-0", className]
        .filter(Boolean)
        .join(" ")}
    >
      <a
        href={`/courses/${course.id}`}
        className={[
          "grid grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-3 transition-colors",
          "hover:bg-[var(--color-canvas)]",
          FOCUS_RING,
        ].join(" ")}
      >
        <Thumbnail size="row" thumbnailUrl={course.thumbnailUrl} title={course.title} />
        <span className="flex min-w-0 flex-col">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-[var(--color-ink)]">
              {course.title}
            </span>
            {course.badge ? (
              <span className="shrink-0 rounded-[var(--radius-chip)] border border-[var(--color-line)] bg-[var(--color-canvas)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-edge)]">
                {course.badge}
              </span>
            ) : null}
          </span>
          <span className="truncate text-xs text-[var(--color-ink2)]">{course.authorName}</span>
        </span>
        <Price course={course} align="right" />
      </a>
    </li>
  );
}
