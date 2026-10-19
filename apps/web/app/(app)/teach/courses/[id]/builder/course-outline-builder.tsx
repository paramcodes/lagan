"use client";

import type { LessonStatus, LessonType } from "@lagan/db";
import { SortableItem, SortableList, useViewPreference, ViewToggle } from "@lagan/ui";
import { AlertCircle, ArrowLeft, Plus, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  createLesson,
  createModule,
  deleteLesson,
  deleteModule,
  reorderLessons,
  reorderModules,
  updateLesson,
  updateModule,
} from "../../builder/actions";
import { ModuleCard } from "./module-card";
import type { BuilderLesson, BuilderModule, CourseBuilderData } from "./query";

const VIEW_OPTIONS = [
  { value: "cards", label: "Cards" },
  { value: "list", label: "List" },
] as const;

const CONTROL_CLASS =
  "rounded-[var(--radius-control)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]";
const BUTTON_PRIMARY =
  "inline-flex items-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--color-brand)] px-3.5 py-2 text-xs font-medium text-[var(--color-surface)] transition-opacity hover:opacity-90 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] disabled:opacity-50";
const BUTTON_SECONDARY =
  "inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3.5 py-2 text-xs font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-edge)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]";

export function CourseOutlineBuilder({ initialCourse }: { initialCourse: CourseBuilderData }) {
  const [course] = useState<CourseBuilderData>(initialCourse);
  const [modules, setModules] = useState<BuilderModule[]>(initialCourse.modules);
  const [view, setView] = useViewPreference("lagan.builder.view", "cards");
  const [error, setError] = useState<string | null>(null);

  const [isAddingModule, setIsAddingModule] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [isSubmittingModule, setIsSubmittingModule] = useState(false);

  const activeView = view === "list" ? "list" : "cards";

  const totalLessons = modules.reduce((acc, mod) => acc + mod.lessons.length, 0);

  // Module actions
  const handleAddModule = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newModuleTitle.trim();
    if (!trimmed) return;
    try {
      setIsSubmittingModule(true);
      setError(null);
      const created = await createModule({ courseId: course.id, title: trimmed });
      setModules((prev) => [
        ...prev,
        {
          id: created.id,
          courseId: created.courseId,
          title: created.title,
          position: created.position,
          lessons: [],
        },
      ]);
      setNewModuleTitle("");
      setIsAddingModule(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create module");
    } finally {
      setIsSubmittingModule(false);
    }
  };

  const handleUpdateModuleTitle = async (id: string, title: string) => {
    try {
      setError(null);
      const updated = await updateModule({ id, title });
      setModules((prev) =>
        prev.map((mod) => (mod.id === id ? { ...mod, title: updated.title } : mod)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update module");
    }
  };

  const handleDeleteModule = async (id: string) => {
    try {
      setError(null);
      await deleteModule({ id });
      setModules((prev) => prev.filter((mod) => mod.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete module");
    }
  };

  const handleReorderModules = async (newOrderedIds: string[]) => {
    const previous = modules;
    const moduleMap = new Map(modules.map((m) => [m.id, m]));
    const reordered = newOrderedIds
      .map((id, index) => {
        const mod = moduleMap.get(id);
        return mod ? { ...mod, position: index } : null;
      })
      .filter((m): m is BuilderModule => m !== null);

    setModules(reordered);

    try {
      setError(null);
      await reorderModules({ courseId: course.id, orderedIds: newOrderedIds });
    } catch (err) {
      setModules(previous);
      setError(err instanceof Error ? err.message : "Failed to reorder modules");
    }
  };

  const handleMoveModule = (id: string, direction: "up" | "down") => {
    const currentIndex = modules.findIndex((m) => m.id === id);
    if (currentIndex === -1) return;
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= modules.length) return;

    const newOrderedIds = modules.map((m) => m.id);
    const [moved] = newOrderedIds.splice(currentIndex, 1);
    if (moved) {
      newOrderedIds.splice(targetIndex, 0, moved);
      handleReorderModules(newOrderedIds);
    }
  };

  // Lesson actions
  const handleAddLesson = async (moduleId: string, data: { title: string; type: LessonType }) => {
    try {
      setError(null);
      const created = await createLesson({
        moduleId,
        title: data.title,
        type: data.type,
      });

      const newLesson: BuilderLesson = {
        id: created.id,
        moduleId: created.moduleId,
        type: created.type,
        title: created.title,
        position: created.position,
        status: created.status,
        muxPlaybackId: created.muxPlaybackId,
        externalUrl: created.externalUrl,
        fileKey: created.fileKey,
        updatedAt: created.updatedAt,
      };

      setModules((prev) =>
        prev.map((mod) =>
          mod.id === moduleId ? { ...mod, lessons: [...mod.lessons, newLesson] } : mod,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create lesson");
    }
  };

  const handleUpdateLesson = async (
    lessonId: string,
    data: { title: string; type: LessonType; status: LessonStatus },
  ) => {
    try {
      setError(null);
      const updated = await updateLesson({
        id: lessonId,
        title: data.title,
        type: data.type,
        status: data.status,
      });

      setModules((prev) =>
        prev.map((mod) => ({
          ...mod,
          lessons: mod.lessons.map((les) =>
            les.id === lessonId
              ? {
                  ...les,
                  title: updated.title,
                  type: updated.type,
                  status: updated.status,
                  updatedAt: updated.updatedAt,
                }
              : les,
          ),
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update lesson");
    }
  };

  const handleDeleteLesson = async (moduleId: string, lessonId: string) => {
    try {
      setError(null);
      await deleteLesson({ id: lessonId });
      setModules((prev) =>
        prev.map((mod) =>
          mod.id === moduleId
            ? { ...mod, lessons: mod.lessons.filter((les) => les.id !== lessonId) }
            : mod,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete lesson");
    }
  };

  const handleReorderLessons = async (moduleId: string, newOrderedIds: string[]) => {
    const targetModule = modules.find((m) => m.id === moduleId);
    if (!targetModule) return;

    const previousLessons = targetModule.lessons;
    const lessonMap = new Map(targetModule.lessons.map((l) => [l.id, l]));
    const reorderedLessons = newOrderedIds
      .map((id, index) => {
        const les = lessonMap.get(id);
        return les ? { ...les, position: index } : null;
      })
      .filter((l): l is BuilderLesson => l !== null);

    setModules((prev) =>
      prev.map((mod) => (mod.id === moduleId ? { ...mod, lessons: reorderedLessons } : mod)),
    );

    try {
      setError(null);
      await reorderLessons({ moduleId, orderedIds: newOrderedIds });
    } catch (err) {
      setModules((prev) =>
        prev.map((mod) => (mod.id === moduleId ? { ...mod, lessons: previousLessons } : mod)),
      );
      setError(err instanceof Error ? err.message : "Failed to reorder lessons");
    }
  };

  const handleMoveLesson = (moduleId: string, lessonId: string, direction: "up" | "down") => {
    const targetModule = modules.find((m) => m.id === moduleId);
    if (!targetModule) return;

    const currentIndex = targetModule.lessons.findIndex((l) => l.id === lessonId);
    if (currentIndex === -1) return;
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= targetModule.lessons.length) return;

    const newOrderedIds = targetModule.lessons.map((l) => l.id);
    const [moved] = newOrderedIds.splice(currentIndex, 1);
    if (moved) {
      newOrderedIds.splice(targetIndex, 0, moved);
      handleReorderLessons(moduleId, newOrderedIds);
    }
  };

  const moduleIds = modules.map((m) => m.id);

  const moduleLabelGetter = (id: string) => {
    const found = modules.find((m) => m.id === id);
    return found ? found.title : id;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-line)] pb-6">
        <div>
          <Link
            href="/teach/courses"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-edge)] transition-colors hover:text-[var(--color-ink)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to courses
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--color-ink)]">
              {course.title}
            </h1>
            <span
              className={[
                "rounded-[var(--radius-chip)] px-2 py-0.5 text-xs font-semibold capitalize",
                course.status === "published"
                  ? "bg-[var(--color-brand)] text-[var(--color-surface)]"
                  : "border border-[var(--color-line)] bg-[var(--color-canvas)] text-[var(--color-edge)]",
              ].join(" ")}
            >
              {course.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-[var(--color-edge)]">
            {modules.length} {modules.length === 1 ? "module" : "modules"} • {totalLessons}{" "}
            {totalLessons === 1 ? "lesson" : "lessons"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ViewToggle
            value={activeView}
            onChange={setView}
            options={VIEW_OPTIONS}
            label="Outline view"
            storageKey="lagan.builder.view"
          />
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-[var(--radius-control)] border border-[var(--color-alert)]/30 bg-[var(--color-alert)]/10 px-4 py-3 text-sm text-[var(--color-alert)]"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
            className="rounded-[var(--radius-chip)] p-1 text-[var(--color-alert)] hover:bg-[var(--color-alert)]/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Outline Modules */}
      {modules.length === 0 ? (
        <div className="rounded-[var(--radius-panel)] border border-dashed border-[var(--color-line)] bg-[var(--color-surface)] p-12 text-center">
          <h2 className="text-base font-semibold text-[var(--color-ink)]">No modules yet</h2>
          <p className="mt-1 text-sm text-[var(--color-edge)]">
            Create your first module below to start structuring your course.
          </p>
        </div>
      ) : (
        <SortableList
          ids={moduleIds}
          getLabel={moduleLabelGetter}
          onReorder={(event) => handleReorderModules(event.ids)}
          className="flex flex-col gap-6"
        >
          {modules.map((mod, modIndex) => (
            <SortableItem key={mod.id} id={mod.id}>
              {({ handleProps }) => (
                <ModuleCard
                  module={mod}
                  index={modIndex}
                  total={modules.length}
                  view={activeView}
                  handleProps={handleProps}
                  onUpdateTitle={handleUpdateModuleTitle}
                  onDelete={handleDeleteModule}
                  onMove={handleMoveModule}
                  onAddLesson={handleAddLesson}
                  onUpdateLesson={handleUpdateLesson}
                  onDeleteLesson={handleDeleteLesson}
                  onReorderLessons={handleReorderLessons}
                  onMoveLesson={handleMoveLesson}
                />
              )}
            </SortableItem>
          ))}
        </SortableList>
      )}

      {/* Add Module Section */}
      <div className="pt-2">
        {isAddingModule ? (
          <form
            onSubmit={handleAddModule}
            className="rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4 shadow-xs"
          >
            <h2 className="mb-3 text-sm font-semibold text-[var(--color-ink)]">Add new module</h2>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="text"
                required
                placeholder="Module title (e.g. Introduction to TypeScript)..."
                value={newModuleTitle}
                onChange={(e) => setNewModuleTitle(e.target.value)}
                aria-label="New module title"
                className={[CONTROL_CLASS, "flex-1"].join(" ")}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingModule(false);
                    setNewModuleTitle("");
                  }}
                  disabled={isSubmittingModule}
                  className={BUTTON_SECONDARY}
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
                <button type="submit" disabled={isSubmittingModule} className={BUTTON_PRIMARY}>
                  <Plus className="h-4 w-4" />
                  Add module
                </button>
              </div>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setIsAddingModule(true)}
            aria-label="Add module"
            className="inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-2.5 text-sm font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-edge)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]"
          >
            <Plus className="h-4 w-4" />
            Add module
          </button>
        )}
      </div>
    </div>
  );
}
