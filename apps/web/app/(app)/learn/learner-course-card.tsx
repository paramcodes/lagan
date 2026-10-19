import { BookOpen, CheckCircle2, Play } from "lucide-react";
import Link from "next/link";
import type { EnrolledCourseItem } from "./query";

export function LearnerCourseCard({ course }: { course: EnrolledCourseItem }) {
  const percent = course.progress.percent;
  const isCompleted = course.progress.isCompleted;

  return (
    <div className="group flex h-full flex-col justify-between overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] shadow-xs transition-colors hover:border-[var(--color-edge)]">
      <div>
        {/* Cover / Header Area */}
        <div className="relative flex h-32 w-full items-center justify-center border-b border-[var(--color-line)] bg-[var(--color-canvas)] text-[var(--color-edge)]">
          <BookOpen className="h-8 w-8 transition-transform group-hover:scale-105" aria-hidden="true" />
          {isCompleted ? (
            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-[var(--radius-chip)] bg-[var(--color-brand)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-surface)]">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              Completed
            </span>
          ) : percent > 0 ? (
            <span className="absolute right-3 top-3 rounded-[var(--radius-chip)] border border-[var(--color-line)] bg-[var(--color-surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-ink)]">
              In Progress
            </span>
          ) : null}
        </div>

        {/* Content Area */}
        <div className="p-5">
          <h2 className="text-base font-semibold text-[var(--color-ink)] line-clamp-2">
            {course.title}
          </h2>
          <p className="mt-1 text-xs text-[var(--color-edge)]">{course.authorName}</p>

          {/* Progress Section */}
          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[var(--color-ink)] tabular-nums">
                {percent}% completed
              </span>
              <span className="text-[var(--color-edge)]">{course.progress.formatted}</span>
            </div>

            <div
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Course progress: ${percent}%`}
              className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-canvas)] border border-[var(--color-line)]"
            >
              <div
                className="h-full rounded-full bg-[var(--color-brand)] transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>

            {course.resumeLessonTitle && !isCompleted ? (
              <p className="pt-1 text-[11px] text-[var(--color-edge)] truncate">
                <span className="font-medium text-[var(--color-ink)]">Next:</span>{" "}
                {course.resumeLessonTitle}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="border-t border-[var(--color-line)] p-4 bg-[var(--color-surface)]">
        <Link
          href={course.resumeHref}
          aria-label={`Continue Learning: ${course.title}`}
          className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-brand)] px-4 py-2.5 text-xs font-medium text-[var(--color-surface)] transition-opacity hover:opacity-90 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-2"
        >
          <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
          <span>Continue Learning</span>
        </Link>
      </div>
    </div>
  );
}
