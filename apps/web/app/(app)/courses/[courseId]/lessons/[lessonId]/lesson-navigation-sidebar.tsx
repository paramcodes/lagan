"use client";

import type { LessonType } from "@lagan/db";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  ExternalLink,
  File,
  FileText,
  HelpCircle,
  Play,
  Video,
  X,
} from "lucide-react";
import Link from "next/link";
import type { NavigationModule } from "./query";

export interface LessonNavigationSidebarProps {
  course: {
    id: string;
    title: string;
  };
  modules: NavigationModule[];
  currentLessonId: string;
  isOpen: boolean;
  onClose?: () => void;
  totalLessons: number;
  completedLessonsCount: number;
  className?: string;
}

function getLessonTypeIcon(type: LessonType) {
  switch (type) {
    case "video":
      return <Video className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />;
    case "text":
      return <FileText className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />;
    case "quiz":
      return <HelpCircle className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />;
    case "file":
      return <File className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />;
    case "external":
      return <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />;
    default:
      return <Play className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />;
  }
}

export function LessonNavigationSidebar({
  course,
  modules,
  currentLessonId,
  isOpen,
  onClose,
  totalLessons,
  completedLessonsCount,
  className = "",
}: LessonNavigationSidebarProps) {
  const percent = totalLessons > 0 ? Math.round((completedLessonsCount / totalLessons) * 100) : 0;

  return (
    <aside
      aria-label="Course syllabus"
      className={`flex flex-col border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 ${
        isOpen ? "block" : "hidden lg:flex"
      } ${className}`}
    >
      {/* Header */}
      <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/courses/${course.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Course Overview
          </Link>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close sidebar"
              className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 lg:hidden dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <h2 className="mt-2 line-clamp-1 font-semibold text-sm text-zinc-900 dark:text-zinc-100">
          {course.title}
        </h2>

        {/* Course progress */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
            <span>Course Progress</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-200">{percent}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Course completion progress"
            className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
          >
            <div
              className="h-full bg-emerald-600 transition-all duration-300 dark:bg-emerald-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            {completedLessonsCount} of {totalLessons} lessons completed
          </p>
        </div>
      </div>

      {/* Modules & Lessons tree */}
      <nav aria-label="Course modules and lessons" className="flex-1 overflow-y-auto p-3 space-y-4">
        {modules.map((mod, moduleIndex) => {
          const modCompleted = mod.lessons.filter((l) => l.completed).length;

          return (
            <div key={mod.id} className="space-y-1">
              <div className="flex items-center justify-between px-2 py-1">
                <span className="font-semibold text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Module {moduleIndex + 1}: {mod.title}
                </span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                  {modCompleted}/{mod.lessons.length}
                </span>
              </div>

              <ul className="space-y-0.5 list-none p-0 m-0">
                {mod.lessons.map((lesson) => {
                  const isCurrent = lesson.id === currentLessonId;

                  return (
                    <li key={lesson.id}>
                      <Link
                        href={lesson.href}
                        aria-current={isCurrent ? "page" : undefined}
                        className={`group flex items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 py-2 text-xs transition-colors ${
                          isCurrent
                            ? "bg-indigo-50 font-medium text-indigo-950 dark:bg-indigo-950/40 dark:text-indigo-200"
                            : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                        }`}
                      >
                        {/* Status Icon */}
                        {lesson.completed ? (
                          <CheckCircle2
                            className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                            aria-label="Completed"
                          />
                        ) : isCurrent ? (
                          <Play
                            className="h-4 w-4 shrink-0 fill-indigo-600 text-indigo-600 dark:fill-indigo-400 dark:text-indigo-400"
                            aria-label="Current lesson"
                          />
                        ) : (
                          <Circle
                            className="h-4 w-4 shrink-0 text-zinc-300 dark:text-zinc-600"
                            aria-label="Not completed"
                          />
                        )}

                        {/* Lesson Type Icon */}
                        {getLessonTypeIcon(lesson.type)}

                        {/* Title */}
                        <span className="flex-1 truncate">{lesson.title}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
