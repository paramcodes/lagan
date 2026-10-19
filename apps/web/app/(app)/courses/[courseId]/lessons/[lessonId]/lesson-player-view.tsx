"use client";

import { useLessonProgress } from "@lagan/ui";
import { Check, CheckCircle2, ChevronLeft, ChevronRight, Menu } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AutoAdvanceBanner } from "./auto-advance-banner";
import { LessonContentRenderer } from "./lesson-content-renderer";
import { LessonNavigationSidebar } from "./lesson-navigation-sidebar";
import type { LessonPlayerData } from "./query";

export interface LessonPlayerViewProps {
  data: LessonPlayerData;
}

export function LessonPlayerView({ data }: LessonPlayerViewProps) {
  const router = useRouter();
  const { course, lesson, modules, currentProgress, prevLesson, nextLesson } = data;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [autoAdvanceActive, setAutoAdvanceActive] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(5);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  const [completedSet, setCompletedSet] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    for (const mod of modules) {
      for (const les of mod.lessons) {
        if (les.completed) {
          ids.add(les.id);
        }
      }
    }
    if (currentProgress.completed) {
      ids.add(lesson.id);
    }
    return ids;
  });

  const handleLessonCompleted = useCallback(() => {
    setCompletedSet((prev) => new Set([...prev, lesson.id]));
    if (nextLesson) {
      setAutoAdvanceActive(true);
      setSecondsRemaining(5);
      setLiveAnnouncement(
        `Lesson complete. Auto-advancing to ${nextLesson.title} in 5 seconds. Press cancel to stay on this lesson.`,
      );
    } else {
      setLiveAnnouncement("Course completed. You have finished all lessons in this course.");
    }
  }, [lesson.id, nextLesson]);

  const { positionSeconds, completed, handleProgress, handleComplete, markComplete } =
    useLessonProgress({
      lessonId: lesson.id,
      courseId: course.id,
      initialPositionSeconds: currentProgress.positionSeconds,
      initialCompleted: currentProgress.completed,
      onPersistProgress: async (payload) => {
        try {
          await fetch(`/api/courses/${course.id}/lessons/${lesson.id}/progress`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        } catch (err) {
          console.error("Failed to persist lesson progress:", err);
        }
      },
      onCompleted: handleLessonCompleted,
    });

  // Countdown timer for auto-advance
  useEffect(() => {
    if (!autoAdvanceActive) return;

    if (secondsRemaining <= 0) {
      setAutoAdvanceActive(false);
      if (nextLesson) {
        setLiveAnnouncement(`Navigating to ${nextLesson.title}`);
        router.push(nextLesson.href);
      }
      return;
    }

    const timer = setTimeout(() => {
      setSecondsRemaining((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [autoAdvanceActive, secondsRemaining, nextLesson, router]);

  const handleCancelAutoAdvance = () => {
    setAutoAdvanceActive(false);
    setLiveAnnouncement("Auto-advance cancelled.");
  };

  const handleAdvanceNow = () => {
    setAutoAdvanceActive(false);
    if (nextLesson) {
      setLiveAnnouncement(`Navigating to ${nextLesson.title}`);
      router.push(nextLesson.href);
    }
  };

  const handleManualCompleteToggle = () => {
    if (!completed) {
      markComplete(positionSeconds);
    }
  };

  // Compute updated modules with current completion status
  const updatedModules = useMemo(() => {
    return modules.map((mod) => ({
      ...mod,
      lessons: mod.lessons.map((les) => ({
        ...les,
        completed: completedSet.has(les.id) || (les.id === lesson.id && completed),
      })),
    }));
  }, [modules, completedSet, lesson.id, completed]);

  const totalLessonsCount = data.totalLessons;
  const completedLessonsCount = completedSet.size;

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-[calc(100vh-8rem)] w-full gap-6">
      {/* Screen Reader live announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="live-announcement"
      >
        {liveAnnouncement}
      </div>

      {/* Main Lesson View Area */}
      <div className="flex-1 flex flex-col min-w-0 space-y-6">
        {/* Navigation & Controls Topbar */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              aria-expanded={sidebarOpen}
              aria-label="Toggle syllabus sidebar"
              className="inline-flex lg:hidden items-center justify-center h-9 w-9 rounded-md border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Menu className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <nav aria-label="Breadcrumb">
                <ol className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  <li>
                    <Link
                      href={`/courses/${course.id}`}
                      className="hover:text-zinc-900 dark:hover:text-zinc-100 truncate"
                    >
                      {course.title}
                    </Link>
                  </li>
                  <li aria-hidden="true">/</li>
                  <li className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {lesson.title}
                  </li>
                </ol>
              </nav>
              <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mt-1">
                {lesson.title}
              </h1>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleManualCompleteToggle}
              aria-pressed={completed}
              className={`inline-flex items-center gap-1.5 rounded-[var(--radius-control)] px-3.5 py-1.5 text-xs font-medium transition-colors ${
                completed
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              }`}
            >
              {completed ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  Completed
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-zinc-400" />
                  Mark as Complete
                </>
              )}
            </button>

            {/* Prev / Next controls */}
            <div className="flex items-center gap-1">
              {prevLesson ? (
                <Link
                  href={prevLesson.href}
                  aria-label={`Previous lesson: ${prevLesson.title}`}
                  className="inline-flex items-center justify-center h-8 px-2.5 rounded-[var(--radius-control)] border border-zinc-200 bg-white text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <ChevronLeft className="h-4 w-4 mr-0.5" />
                  Prev
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center justify-center h-8 px-2.5 rounded-[var(--radius-control)] border border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-300 cursor-not-allowed dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-600"
                >
                  <ChevronLeft className="h-4 w-4 mr-0.5" />
                  Prev
                </button>
              )}

              {nextLesson ? (
                <Link
                  href={nextLesson.href}
                  aria-label={`Next lesson: ${nextLesson.title}`}
                  className="inline-flex items-center justify-center h-8 px-2.5 rounded-[var(--radius-control)] bg-zinc-900 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-0.5" />
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center justify-center h-8 px-2.5 rounded-[var(--radius-control)] border border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-300 cursor-not-allowed dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-600"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-0.5" />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Auto-Advance countdown banner when active */}
        {autoAdvanceActive && (
          <AutoAdvanceBanner
            nextLesson={nextLesson}
            courseHref={`/courses/${course.id}`}
            secondsRemaining={secondsRemaining}
            onAdvance={handleAdvanceNow}
            onCancel={handleCancelAutoAdvance}
          />
        )}

        {/* Render Lesson by Type */}
        <section aria-label="Lesson content" className="flex-1">
          <LessonContentRenderer
            lesson={lesson}
            currentProgress={currentProgress}
            onProgress={handleProgress}
            onComplete={handleComplete}
          />
        </section>

        {/* Bottom lesson navigation */}
        <footer className="flex items-center justify-between border-t border-zinc-200 pt-6 dark:border-zinc-800 text-xs">
          <div>
            {prevLesson && (
              <Link
                href={prevLesson.href}
                className="group flex flex-col items-start gap-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                <span className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-zinc-400">
                  <ChevronLeft className="h-3 w-3" />
                  Previous Lesson
                </span>
                <span className="font-medium group-hover:underline">{prevLesson.title}</span>
              </Link>
            )}
          </div>
          <div>
            {nextLesson && (
              <Link
                href={nextLesson.href}
                className="group flex flex-col items-end gap-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                <span className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-zinc-400">
                  Next Lesson
                  <ChevronRight className="h-3 w-3" />
                </span>
                <span className="font-medium group-hover:underline">{nextLesson.title}</span>
              </Link>
            )}
          </div>
        </footer>
      </div>

      {/* Lesson Navigation Sidebar / Drawer */}
      <LessonNavigationSidebar
        course={course}
        modules={updatedModules}
        currentLessonId={lesson.id}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        totalLessons={totalLessonsCount}
        completedLessonsCount={completedLessonsCount}
        className="w-full lg:w-80 shrink-0 rounded-[var(--radius-panel)] border"
      />
    </div>
  );
}
