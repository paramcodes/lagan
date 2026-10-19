"use client";

import type { LessonProgressInput } from "@lagan/ui";
import { LessonPlayer } from "@lagan/ui";
import { Check, Download, ExternalLink, HelpCircle, Play } from "lucide-react";
import type { CurrentLesson, CurrentProgress } from "./query";
export interface LessonContentRendererProps {
  lesson: CurrentLesson;
  currentProgress: CurrentProgress;
  onProgress: (input: LessonProgressInput) => void;
  onComplete: () => void;
}

export function LessonContentRenderer({
  lesson,
  currentProgress,
  onProgress,
  onComplete,
}: LessonContentRendererProps) {
  if (lesson.type === "video") {
    if (lesson.muxPlaybackId) {
      return (
        <div className="w-full aspect-video rounded-[var(--radius-panel)] overflow-hidden shadow-sm bg-black">
          <LessonPlayer
            playbackId={lesson.muxPlaybackId}
            startTime={currentProgress.positionSeconds}
            title={lesson.title}
            onProgress={onProgress}
            onComplete={onComplete}
            className="w-full h-full"
          />
        </div>
      );
    }
    return (
      <div
        data-testid="video-placeholder"
        className="flex flex-col items-center justify-center aspect-video w-full rounded-[var(--radius-panel)] border-2 border-dashed border-zinc-300 bg-zinc-50 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/50"
      >
        <Play className="h-12 w-12 text-zinc-400 mb-3" />
        <p className="font-semibold text-zinc-900 dark:text-zinc-100">Video Ready Soon</p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">
          The video stream is currently being processed or waiting for Mux playback.
        </p>
        <button
          type="button"
          onClick={onComplete}
          className="mt-4 inline-flex items-center gap-1.5 rounded-[var(--radius-control)] bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Mark as Watched
        </button>
      </div>
    );
  }

  if (lesson.type === "text") {
    return (
      <div className="rounded-[var(--radius-panel)] border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="prose dark:prose-invert max-w-none text-zinc-800 dark:text-zinc-200 leading-relaxed space-y-4">
          {typeof lesson.contentJson === "string" ? (
            <p>{lesson.contentJson}</p>
          ) : lesson.contentJson && typeof lesson.contentJson === "object" ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Reading material for this lesson:
              </p>
              <p className="text-zinc-700 dark:text-zinc-300">
                {lesson.title} covers essential domain foundations and architecture guidelines.
                Follow along with the notes below to complete this section.
              </p>
            </div>
          ) : (
            <p className="text-zinc-500 italic">No text content provided for this lesson.</p>
          )}
        </div>
        <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
          <button
            type="button"
            onClick={onComplete}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] bg-indigo-600 px-4 py-2 text-xs font-medium text-white shadow hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            <Check className="h-4 w-4" />
            Finished Reading & Continue
          </button>
        </div>
      </div>
    );
  }

  if (lesson.type === "quiz") {
    return (
      <div className="rounded-[var(--radius-panel)] border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-3 mb-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            <HelpCircle className="h-6 w-6" />
          </span>
          <div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Knowledge Assessment
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Test your understanding of the concepts covered in this module.
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800/60 dark:bg-zinc-950/40 my-6">
          <p className="text-sm text-zinc-800 dark:text-zinc-200 font-medium">
            Review the questions and submit your answers to verify completion.
          </p>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onComplete}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] bg-indigo-600 px-4 py-2 text-xs font-medium text-white shadow hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            <Check className="h-4 w-4" />
            Complete Quiz
          </button>
        </div>
      </div>
    );
  }

  if (lesson.type === "file") {
    return (
      <div className="rounded-[var(--radius-panel)] border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            <Download className="h-6 w-6" />
          </span>
          <div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Downloadable Resource
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Attachment: {lesson.fileKey || "Course Resource File"}
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a
            href={`#download-${lesson.id}`}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-zinc-300 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <Download className="h-3.5 w-3.5" />
            Download File
          </a>
          <button
            type="button"
            onClick={onComplete}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <Check className="h-3.5 w-3.5" />
            Mark as Downloaded & Complete
          </button>
        </div>
      </div>
    );
  }

  if (lesson.type === "external") {
    return (
      <div className="rounded-[var(--radius-panel)] border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
            <ExternalLink className="h-6 w-6" />
          </span>
          <div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              External Link Resource
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              This lesson directs you to an external hands-on lab or reference.
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {lesson.externalUrl && (
            <a
              href={lesson.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-sky-300 bg-sky-50 px-3.5 py-1.5 text-xs font-medium text-sky-900 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200"
            >
              Open Resource
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <button
            type="button"
            onClick={onComplete}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <Check className="h-3.5 w-3.5" />
            Mark as Complete
          </button>
        </div>
      </div>
    );
  }

  return null;
}
