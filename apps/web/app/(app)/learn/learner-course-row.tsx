import { BookOpen, CheckCircle2, Play } from "lucide-react";
import Link from "next/link";
import type { EnrolledCourseItem } from "./query";

export function LearnerCourseRow({ course }: { course: EnrolledCourseItem }) {
  const percent = course.progress.percent;
  const isCompleted = course.progress.isCompleted;

  return (
    <li className="border-b border-[var(--color-line)] last:border-b-0 transition-colors hover:bg-[var(--color-canvas)]">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Thumbnail & Course Metadata */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            aria-hidden="true"
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-chip)] border border-[var(--color-line)] bg-[var(--color-canvas)] text-[var(--color-edge)]"
          >
            <BookOpen className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-sm font-medium text-[var(--color-ink)]">
                {course.title}
              </h2>
              {isCompleted ? (
                <span className="shrink-0 inline-flex items-center gap-0.5 rounded-[var(--radius-chip)] bg-[var(--color-brand)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-surface)]">
                  <CheckCircle2 className="h-2.5 w-2.5" aria-hidden="true" />
                  Done
                </span>
              ) : null}
            </div>
            <p className="truncate text-xs text-[var(--color-edge)]">{course.authorName}</p>
          </div>
        </div>

        {/* Center: Progress Bar & Lesson Count */}
        <div className="w-full sm:w-56 shrink-0 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-[var(--color-ink)] tabular-nums">
              {percent}%
            </span>
            <span className="text-[var(--color-edge)] tabular-nums">{course.progress.formatted}</span>
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
        </div>

        {/* Right: Direct "Continue Learning" Action Button */}
        <div className="shrink-0">
          <Link
            href={course.resumeHref}
            aria-label={`Continue Learning: ${course.title}`}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--color-brand)] px-3.5 py-1.5 text-xs font-medium text-[var(--color-surface)] transition-opacity hover:opacity-90 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1"
          >
            <Play className="h-3 w-3 fill-current" aria-hidden="true" />
            <span>Continue Learning</span>
          </Link>
        </div>
      </div>
    </li>
  );
}
