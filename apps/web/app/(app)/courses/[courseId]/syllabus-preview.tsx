"use client";

import { Badge } from "@lagan/ui";
import {
  ChevronDown,
  Clock,
  ExternalLink,
  FileText,
  HelpCircle,
  Lock,
  Paperclip,
  PlayCircle,
  Video,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { CourseDetailModule, SyllabusLesson } from "./query";

export interface SyllabusPreviewProps {
  courseId: string;
  modules: CourseDetailModule[];
  isEnrolled: boolean;
}

const LESSON_ICON_MAP = {
  video: Video,
  text: FileText,
  quiz: HelpCircle,
  file: Paperclip,
  external: ExternalLink,
};

function LessonItem({
  lesson,
  courseId,
  isEnrolled,
}: {
  lesson: SyllabusLesson;
  courseId: string;
  isEnrolled: boolean;
}) {
  const Icon = LESSON_ICON_MAP[lesson.type] ?? FileText;
  const canAccess = isEnrolled || lesson.isPreview;
  const lessonHref = `/courses/${courseId}/lessons/${lesson.id}`;

  const inner = (
    <div className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-[var(--color-canvas)]">
      <div className="flex min-w-0 items-center gap-3">
        <Icon className="h-4 w-4 shrink-0 text-[var(--color-edge)]" aria-hidden="true" />
        <span className="truncate text-sm font-medium text-[var(--color-ink)]">{lesson.title}</span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {lesson.isPreview ? (
          <Badge variant="neutral" size="sm" data-testid="preview-badge">
            Preview
          </Badge>
        ) : null}

        <span
          className="flex items-center gap-1 text-xs text-[var(--color-edge)]"
          data-testid="lesson-duration"
        >
          <Clock className="h-3 w-3" aria-hidden="true" />
          {lesson.duration}
        </span>

        {canAccess ? (
          <PlayCircle
            className="h-4 w-4 text-[var(--color-ink)] opacity-70"
            aria-label="Play lesson"
          />
        ) : (
          <Lock
            className="h-3.5 w-3.5 text-[var(--color-edge)] opacity-60"
            aria-label="Locked lesson"
          />
        )}
      </div>
    </div>
  );

  return (
    <li className="border-t border-[var(--color-line)] first:border-t-0">
      {canAccess ? (
        <Link
          href={lessonHref}
          className="block outline-none focus-visible:bg-[var(--color-canvas)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-ink)]"
        >
          {inner}
        </Link>
      ) : (
        inner
      )}
    </li>
  );
}

export function SyllabusPreview({ courseId, modules, isEnrolled }: SyllabusPreviewProps) {
  // All modules open by default
  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const mod of modules) {
      initial[mod.id] = true;
    }
    return initial;
  });

  if (modules.length === 0) {
    return (
      <div className="rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] p-8 text-center">
        <p className="text-sm text-[var(--color-edge)]">No curriculum modules published yet.</p>
      </div>
    );
  }

  const allOpen = modules.every((m) => openMap[m.id]);

  const toggleAll = () => {
    const nextState = !allOpen;
    const next: Record<string, boolean> = {};
    for (const mod of modules) {
      next[mod.id] = nextState;
    }
    setOpenMap(next);
  };

  const toggleModule = (moduleId: string) => {
    setOpenMap((prev) => ({
      ...prev,
      [moduleId]: !prev[moduleId],
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-[var(--color-edge)]">
        <span>
          {modules.length} {modules.length === 1 ? "module" : "modules"} •{" "}
          {modules.reduce((sum, m) => sum + m.lessons.length, 0)} lessons
        </span>
        <button
          type="button"
          onClick={toggleAll}
          className="font-medium text-[var(--color-ink)] underline hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]"
        >
          {allOpen ? "Collapse all" : "Expand all"}
        </button>
      </div>

      <div className="space-y-3">
        {modules.map((mod, index) => {
          const isOpen = openMap[mod.id] ?? true;
          const lessonCount = mod.lessons.length;

          return (
            <div
              key={mod.id}
              className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)]"
            >
              <button
                type="button"
                onClick={() => toggleModule(mod.id)}
                aria-expanded={isOpen}
                aria-controls={`module-content-${mod.id}`}
                className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-colors hover:bg-[var(--color-canvas)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-ink)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-edge)]">
                    Module {index + 1}
                  </div>
                  <h3 className="truncate text-sm font-semibold text-[var(--color-ink)]">
                    {mod.title}
                  </h3>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-[var(--color-edge)]">
                    {lessonCount} {lessonCount === 1 ? "lesson" : "lessons"}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-[var(--color-edge)] transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                    aria-hidden="true"
                  />
                </div>
              </button>

              {isOpen ? (
                <div id={`module-content-${mod.id}`}>
                  {lessonCount === 0 ? (
                    <p className="border-t border-[var(--color-line)] px-4 py-3 text-xs italic text-[var(--color-edge)]">
                      No published lessons in this module yet.
                    </p>
                  ) : (
                    <ul className="list-none p-0">
                      {mod.lessons.map((lesson) => (
                        <LessonItem
                          key={lesson.id}
                          lesson={lesson}
                          courseId={courseId}
                          isEnrolled={isEnrolled}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
