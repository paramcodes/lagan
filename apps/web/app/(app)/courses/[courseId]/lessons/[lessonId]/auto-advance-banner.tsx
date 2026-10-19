"use client";

import { CheckCircle2, ChevronRight, Play, X } from "lucide-react";
import Link from "next/link";

export interface NextLessonInfo {
  id: string;
  title: string;
  href: string;
}

export interface AutoAdvanceBannerProps {
  nextLesson: NextLessonInfo | null;
  courseHref: string;
  secondsRemaining: number;
  totalSeconds?: number;
  onAdvance: () => void;
  onCancel: () => void;
  className?: string;
}

export function AutoAdvanceBanner({
  nextLesson,
  courseHref,
  secondsRemaining,
  totalSeconds = 5,
  onAdvance,
  onCancel,
  className = "",
}: AutoAdvanceBannerProps) {
  if (!nextLesson) {
    return (
      <aside
        aria-label="Course completion"
        className={`rounded-[var(--radius-panel)] border border-emerald-300 bg-emerald-50 p-4 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100 ${className}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white dark:bg-emerald-500">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold text-sm">Course Completed!</p>
              <p className="text-xs text-emerald-800 dark:text-emerald-200">
                You have completed all lessons in this course.
              </p>
            </div>
          </div>
          <Link
            href={courseHref}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] bg-emerald-700 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            Back to Course
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </aside>
    );
  }

  const percent = Math.max(0, Math.min(100, (secondsRemaining / totalSeconds) * 100));

  return (
    <aside
      aria-label="Auto-advance countdown"
      className={`relative overflow-hidden rounded-[var(--radius-panel)] border border-indigo-200 bg-indigo-50/90 p-4 text-indigo-950 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-100 ${className}`}
    >
      {/* Visual countdown progress track */}
      <div
        className="absolute top-0 left-0 h-1 bg-indigo-600 transition-all duration-1000 ease-linear dark:bg-indigo-400"
        style={{ width: `${percent}%` }}
        aria-hidden="true"
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm dark:bg-indigo-500">
            <Play className="h-5 w-5 fill-current" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">Auto-advancing in {secondsRemaining}s</span>
              <span className="rounded-full bg-indigo-200/80 px-2 py-0.5 text-[11px] font-medium text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                Up Next
              </span>
            </div>
            <p className="truncate text-xs text-indigo-800/90 dark:text-indigo-200/90">
              {nextLesson.title}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel auto-advance"
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-indigo-300 bg-white px-3 py-1.5 text-xs font-medium text-indigo-900 transition-colors hover:bg-indigo-100/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-indigo-800 dark:bg-zinc-900 dark:text-indigo-200 dark:hover:bg-indigo-950"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Cancel
          </button>
          <button
            type="button"
            onClick={onAdvance}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            Play Next
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}
