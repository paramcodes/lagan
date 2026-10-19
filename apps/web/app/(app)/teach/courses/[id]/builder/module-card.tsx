"use client";

import type { LessonStatus, LessonType } from "@lagan/db";
import {
  type SortableDragHandleProps,
  SortableHandle,
  SortableItem,
  SortableList,
} from "@lagan/ui";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { LessonItem } from "./lesson-item";
import type { BuilderModule } from "./query";

const LESSON_TYPES: readonly LessonType[] = ["video", "text", "quiz", "file", "external"];
const LESSON_TYPE_LABELS: Record<LessonType, string> = {
  video: "Video",
  text: "Text",
  quiz: "Quiz",
  file: "File",
  external: "External",
};

const CONTROL_CLASS =
  "rounded-[var(--radius-control)] border border-[var(--color-line)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs text-[var(--color-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]";
const BUTTON_PRIMARY =
  "inline-flex items-center gap-1 rounded-[var(--radius-control)] bg-[var(--color-brand)] px-3 py-1.5 text-xs font-medium text-[var(--color-surface)] transition-opacity hover:opacity-90 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]";
const BUTTON_SECONDARY =
  "inline-flex items-center gap-1 rounded-[var(--radius-control)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-edge)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]";
const BUTTON_ICON =
  "inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-chip)] text-[var(--color-edge)] transition-colors hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] disabled:opacity-30 disabled:pointer-events-none";
const BUTTON_DANGER =
  "inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-chip)] text-[var(--color-alert)] transition-colors hover:bg-[var(--color-canvas)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-alert)]";

export interface ModuleCardProps {
  module: BuilderModule;
  index: number;
  total: number;
  view: "cards" | "list";
  handleProps: SortableDragHandleProps;
  onUpdateTitle: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onMove: (id: string, direction: "up" | "down") => void;
  onAddLesson: (moduleId: string, data: { title: string; type: LessonType }) => Promise<void>;
  onUpdateLesson: (
    lessonId: string,
    data: { title: string; type: LessonType; status: LessonStatus },
  ) => Promise<void>;
  onDeleteLesson: (moduleId: string, lessonId: string) => Promise<void>;
  onReorderLessons: (moduleId: string, orderedIds: string[]) => Promise<void>;
  onMoveLesson: (moduleId: string, lessonId: string, direction: "up" | "down") => void;
}

export function ModuleCard({
  module,
  index,
  total,
  view,
  handleProps,
  onUpdateTitle,
  onDelete,
  onMove,
  onAddLesson,
  onUpdateLesson,
  onDeleteLesson,
  onReorderLessons,
  onMoveLesson,
}: ModuleCardProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(module.title);
  const [isAddingLesson, setIsAddingLesson] = useState(false);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [newLessonType, setNewLessonType] = useState<LessonType>("video");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSaveTitle = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = editTitle.trim();
    if (!trimmed) return;
    try {
      setIsSubmitting(true);
      await onUpdateTitle(module.id, trimmed);
      setIsEditingTitle(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelTitle = () => {
    setEditTitle(module.title);
    setIsEditingTitle(false);
  };

  const handleCreateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newLessonTitle.trim();
    if (!trimmed) return;
    try {
      setIsSubmitting(true);
      await onAddLesson(module.id, { title: trimmed, type: newLessonType });
      setNewLessonTitle("");
      setNewLessonType("video");
      setIsAddingLesson(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const lessonIds = module.lessons.map((l) => l.id);

  const lessonLabelGetter = (id: string) => {
    const found = module.lessons.find((l) => l.id === id);
    return found ? found.title : id;
  };

  return (
    <div
      className={[
        "rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] shadow-xs transition-shadow",
        view === "cards" ? "p-5" : "overflow-hidden",
      ].join(" ")}
    >
      {/* Module Header */}
      <div
        className={[
          "flex items-center justify-between gap-3",
          view === "cards"
            ? "mb-4 border-b border-[var(--color-line)] pb-3"
            : "border-b border-[var(--color-line)] bg-[var(--color-canvas)] px-4 py-3",
        ].join(" ")}
      >
        <div className="flex flex-1 items-center gap-2">
          <SortableHandle
            {...handleProps}
            label={`Reorder module ${module.title}`}
            className={BUTTON_ICON}
          />
          {isEditingTitle ? (
            <form onSubmit={handleSaveTitle} className="flex flex-1 items-center gap-1.5">
              <input
                type="text"
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                aria-label="Module title"
                className={[CONTROL_CLASS, "flex-1 max-w-sm"].join(" ")}
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className={BUTTON_PRIMARY}
                aria-label="Save module title"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleCancelTitle}
                disabled={isSubmitting}
                className={BUTTON_SECONDARY}
                aria-label="Cancel editing module title"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </form>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-[var(--color-ink)]">
                <span className="text-[var(--color-edge)] mr-1">Module {index + 1}:</span>
                {module.title}
              </h2>
              <span className="rounded-[var(--radius-chip)] bg-[var(--color-canvas)] px-2 py-0.5 text-xs text-[var(--color-edge)]">
                {module.lessons.length} {module.lessons.length === 1 ? "lesson" : "lessons"}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(module.id, "up")}
            disabled={index === 0}
            aria-label={`Move module "${module.title}" up`}
            title="Move module up"
            className={BUTTON_ICON}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onMove(module.id, "down")}
            disabled={index === total - 1}
            aria-label={`Move module "${module.title}" down`}
            title="Move module down"
            className={BUTTON_ICON}
          >
            <ArrowDown className="h-4 w-4" />
          </button>
          {!isEditingTitle && (
            <button
              type="button"
              onClick={() => setIsEditingTitle(true)}
              aria-label={`Edit module "${module.title}"`}
              title="Edit module title"
              className={BUTTON_ICON}
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(module.id)}
            aria-label={`Delete module "${module.title}"`}
            title="Delete module"
            className={BUTTON_DANGER}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Module Lessons Body */}
      {module.lessons.length === 0 ? (
        <div className="py-6 text-center text-xs text-[var(--color-edge)]">
          No lessons in this module yet. Click &ldquo;Add lesson&rdquo; to get started.
        </div>
      ) : (
        <SortableList
          ids={lessonIds}
          getLabel={lessonLabelGetter}
          onReorder={(event) => onReorderLessons(module.id, event.ids)}
          className={
            view === "cards"
              ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
              : "divide-y divide-[var(--color-line)]"
          }
        >
          {module.lessons.map((lesson, lessonIndex) => (
            <SortableItem
              key={lesson.id}
              id={lesson.id}
              className={view === "cards" ? "h-full" : undefined}
            >
              {({ handleProps: lessonHandleProps }) => (
                <LessonItem
                  lesson={lesson}
                  index={lessonIndex}
                  total={module.lessons.length}
                  view={view}
                  moduleIndex={index}
                  handleProps={lessonHandleProps}
                  onUpdate={(lessonId, data) => onUpdateLesson(lessonId, data)}
                  onDelete={(lessonId) => onDeleteLesson(module.id, lessonId)}
                  onMove={(lessonId, direction) => onMoveLesson(module.id, lessonId, direction)}
                />
              )}
            </SortableItem>
          ))}
        </SortableList>
      )}

      {/* Add Lesson Section */}
      <div
        className={[
          view === "cards"
            ? "mt-4 pt-2"
            : "border-t border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3",
        ].join(" ")}
      >
        {isAddingLesson ? (
          <form
            onSubmit={handleCreateLesson}
            className="rounded-[var(--radius-control)] border border-[var(--color-line)] bg-[var(--color-canvas)] p-3"
          >
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  required
                  placeholder="Lesson title..."
                  value={newLessonTitle}
                  onChange={(e) => setNewLessonTitle(e.target.value)}
                  aria-label={`New lesson title for module ${module.title}`}
                  className={[CONTROL_CLASS, "flex-1 min-w-[200px]"].join(" ")}
                />
                <select
                  value={newLessonType}
                  onChange={(e) => setNewLessonType(e.target.value as LessonType)}
                  aria-label="New lesson type"
                  className={CONTROL_CLASS}
                >
                  {LESSON_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {LESSON_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingLesson(false);
                    setNewLessonTitle("");
                  }}
                  disabled={isSubmitting}
                  className={BUTTON_SECONDARY}
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className={BUTTON_PRIMARY}>
                  <Plus className="h-3.5 w-3.5" />
                  Add lesson
                </button>
              </div>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setIsAddingLesson(true)}
            aria-label={`Add lesson to module "${module.title}"`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-edge)] transition-colors hover:text-[var(--color-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] rounded-[var(--radius-chip)] px-1 py-0.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Add lesson
          </button>
        )}
      </div>
    </div>
  );
}
