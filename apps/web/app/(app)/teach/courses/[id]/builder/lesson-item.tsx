"use client";

import type { LessonStatus, LessonType } from "@lagan/db";
import { type SortableDragHandleProps, SortableHandle } from "@lagan/ui";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ExternalLink,
  File,
  FileText,
  HelpCircle,
  Pencil,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { BuilderLesson } from "./query";

const LESSON_TYPES: readonly LessonType[] = ["video", "text", "quiz", "file", "external"];
const LESSON_STATUSES: readonly LessonStatus[] = ["draft", "published"];

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
  "inline-flex items-center gap-1 rounded-[var(--radius-control)] bg-[var(--color-brand)] px-2.5 py-1 text-xs font-medium text-[var(--color-surface)] transition-opacity hover:opacity-90 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]";
const BUTTON_SECONDARY =
  "inline-flex items-center gap-1 rounded-[var(--radius-control)] border border-[var(--color-line)] bg-[var(--color-surface)] px-2.5 py-1 text-xs font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-edge)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]";
const BUTTON_ICON =
  "inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-chip)] text-[var(--color-edge)] transition-colors hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] disabled:opacity-30 disabled:pointer-events-none";
const BUTTON_DANGER =
  "inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-chip)] text-[var(--color-alert)] transition-colors hover:bg-[var(--color-canvas)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-alert)]";

function LessonTypeIcon({ type }: { type: LessonType }) {
  if (type === "video") return <Video className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
  if (type === "text") return <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
  if (type === "quiz") return <HelpCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
  if (type === "file") return <File className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
  return <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
}

export interface LessonItemProps {
  lesson: BuilderLesson;
  index: number;
  total: number;
  view: "cards" | "list";
  moduleIndex: number;
  handleProps: SortableDragHandleProps;
  onUpdate: (
    id: string,
    data: { title: string; type: LessonType; status: LessonStatus },
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onMove: (id: string, direction: "up" | "down") => void;
  onDraftChange?:
    | ((id: string, data: { title: string; type: LessonType; status: LessonStatus }) => void)
    | undefined;
  onBlur?:
    | ((id: string, data: { title: string; type: LessonType; status: LessonStatus }) => void)
    | undefined;
}

export function LessonItem({
  lesson,
  index,
  total,
  view,
  moduleIndex,
  handleProps,
  onUpdate,
  onDelete,
  onMove,
  onDraftChange,
  onBlur,
}: LessonItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(lesson.title);
  const [editType, setEditType] = useState<LessonType>(lesson.type);
  const [editStatus, setEditStatus] = useState<LessonStatus>(lesson.status);

  useEffect(() => {
    setEditTitle(lesson.title);
    setEditType(lesson.type);
    setEditStatus(lesson.status);
  }, [lesson.title, lesson.type, lesson.status]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = editTitle.trim();
    if (!trimmed) return;
    try {
      setIsSubmitting(true);
      await onUpdate(lesson.id, {
        title: trimmed,
        type: editType,
        status: editStatus,
      });
      setIsEditing(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setEditTitle(lesson.title);
    setEditType(lesson.type);
    setEditStatus(lesson.status);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <form
        onSubmit={handleSave}
        className="rounded-[var(--radius-control)] border border-[var(--color-line)] bg-[var(--color-surface)] p-3 shadow-xs"
      >
        <div className="flex flex-col gap-2.5">
          <div>
            <label
              htmlFor={`lesson-title-${lesson.id}`}
              className="mb-1 block text-[11px] font-medium text-[var(--color-edge)]"
            >
              Lesson Title
            </label>
            <input
              id={`lesson-title-${lesson.id}`}
              type="text"
              required
              value={editTitle}
              onChange={(e) => {
                setEditTitle(e.target.value);
                onDraftChange?.(lesson.id, {
                  title: e.target.value,
                  type: editType,
                  status: editStatus,
                });
              }}
              onBlur={() => {
                if (editTitle.trim()) {
                  onBlur?.(lesson.id, {
                    title: editTitle.trim(),
                    type: editType,
                    status: editStatus,
                  });
                }
              }}
              className={[CONTROL_CLASS, "w-full"].join(" ")}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex-1 min-w-[120px]">
              <label
                htmlFor={`lesson-type-${lesson.id}`}
                className="mb-1 block text-[11px] font-medium text-[var(--color-edge)]"
              >
                Type
              </label>
              <select
                id={`lesson-type-${lesson.id}`}
                value={editType}
                onChange={(e) => {
                  const newType = e.target.value as LessonType;
                  setEditType(newType);
                  onDraftChange?.(lesson.id, {
                    title: editTitle,
                    type: newType,
                    status: editStatus,
                  });
                }}
                onBlur={() => {
                  if (editTitle.trim()) {
                    onBlur?.(lesson.id, {
                      title: editTitle.trim(),
                      type: editType,
                      status: editStatus,
                    });
                  }
                }}
                className={[CONTROL_CLASS, "w-full"].join(" ")}
              >
                {LESSON_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {LESSON_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[120px]">
              <label
                htmlFor={`lesson-status-${lesson.id}`}
                className="mb-1 block text-[11px] font-medium text-[var(--color-edge)]"
              >
                Status
              </label>
              <select
                id={`lesson-status-${lesson.id}`}
                value={editStatus}
                onChange={(e) => {
                  const newStatus = e.target.value as LessonStatus;
                  setEditStatus(newStatus);
                  onDraftChange?.(lesson.id, {
                    title: editTitle,
                    type: editType,
                    status: newStatus,
                  });
                }}
                onBlur={() => {
                  if (editTitle.trim()) {
                    onBlur?.(lesson.id, {
                      title: editTitle.trim(),
                      type: editType,
                      status: editStatus,
                    });
                  }
                }}
                className={[CONTROL_CLASS, "w-full"].join(" ")}
              >
                {LESSON_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-end gap-1.5 pt-1">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSubmitting}
              className={BUTTON_SECONDARY}
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className={BUTTON_PRIMARY}>
              <Check className="h-3.5 w-3.5" />
              Save
            </button>
          </div>
        </div>
      </form>
    );
  }

  if (view === "cards") {
    return (
      <div className="flex h-full flex-col justify-between rounded-[var(--radius-control)] border border-[var(--color-line)] bg-[var(--color-surface)] p-3.5 shadow-xs transition-colors hover:border-[var(--color-edge)]">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <SortableHandle
                {...handleProps}
                label={`Reorder lesson ${lesson.title}`}
                className={BUTTON_ICON}
              />
              <span className="inline-flex items-center gap-1 rounded-[var(--radius-chip)] bg-[var(--color-canvas)] px-2 py-0.5 text-xs font-medium text-[var(--color-ink)]">
                <LessonTypeIcon type={lesson.type} />
                {LESSON_TYPE_LABELS[lesson.type]}
              </span>
            </div>
            <span
              className={[
                "rounded-[var(--radius-chip)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                lesson.status === "published"
                  ? "bg-[var(--color-brand)] text-[var(--color-surface)]"
                  : "border border-[var(--color-line)] bg-[var(--color-canvas)] text-[var(--color-edge)]",
              ].join(" ")}
            >
              {lesson.status}
            </span>
          </div>
          <p className="line-clamp-2 text-sm font-medium text-[var(--color-ink)]">{lesson.title}</p>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-[var(--color-line)] pt-2.5">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => onMove(lesson.id, "up")}
              disabled={index === 0}
              aria-label={`Move lesson "${lesson.title}" up`}
              title="Move up"
              className={BUTTON_ICON}
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onMove(lesson.id, "down")}
              disabled={index === total - 1}
              aria-label={`Move lesson "${lesson.title}" down`}
              title="Move down"
              className={BUTTON_ICON}
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              aria-label={`Edit lesson "${lesson.title}"`}
              title="Edit lesson"
              className={BUTTON_ICON}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(lesson.id)}
              aria-label={`Delete lesson "${lesson.title}"`}
              title="Delete lesson"
              className={BUTTON_DANGER}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--color-canvas)]/40">
      <div className="flex min-w-0 items-center gap-3">
        <SortableHandle
          {...handleProps}
          label={`Reorder lesson ${lesson.title}`}
          className={BUTTON_ICON}
        />
        <span className="w-7 shrink-0 font-mono text-xs text-[var(--color-edge)]">
          {moduleIndex + 1}.{index + 1}
        </span>
        <span className="text-[var(--color-edge)]">
          <LessonTypeIcon type={lesson.type} />
        </span>
        <span className="truncate text-sm font-medium text-[var(--color-ink)]">{lesson.title}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={[
            "rounded-[var(--radius-chip)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            lesson.status === "published"
              ? "bg-[var(--color-brand)] text-[var(--color-surface)]"
              : "border border-[var(--color-line)] bg-[var(--color-canvas)] text-[var(--color-edge)]",
          ].join(" ")}
        >
          {lesson.status}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onMove(lesson.id, "up")}
            disabled={index === 0}
            aria-label={`Move lesson "${lesson.title}" up`}
            title="Move up"
            className={BUTTON_ICON}
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMove(lesson.id, "down")}
            disabled={index === total - 1}
            aria-label={`Move lesson "${lesson.title}" down`}
            title="Move down"
            className={BUTTON_ICON}
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            aria-label={`Edit lesson "${lesson.title}"`}
            title="Edit lesson"
            className={BUTTON_ICON}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(lesson.id)}
            aria-label={`Delete lesson "${lesson.title}"`}
            title="Delete lesson"
            className={BUTTON_DANGER}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
