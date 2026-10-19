"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Active,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
  type Modifiers,
  type Over,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  type SortableData,
  type SortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

/**
 * Sortable list primitives, wrapping `@dnd-kit/core` + `@dnd-kit/sortable` for
 * the course builder (module and lesson ordering).
 *
 * Three pieces compose:
 *
 * - `SortableList` owns the `DndContext` and `SortableContext`, installs the
 *   pointer and keyboard sensors, and reports a reordered id array through
 *   `onReorder`.
 * - `SortableItem` registers one row with dnd-kit and hands the drag binding to
 *   its render prop.
 * - `SortableHandle` renders that binding on a real `<button>`, so a drag is
 *   reachable by pointer, touch, and keyboard. The button carries an accessible
 *   name, and `SortableList` announces every step of a drag through the dnd-kit
 *   live region.
 *
 * Keyboard support is not optional: the space bar picks an item up, the arrow
 * keys move it, space drops it, and escape cancels.
 */

/* -------------------------------------------------------------------------- */
/* Accessibility copy                                                         */
/* -------------------------------------------------------------------------- */

/** Screen reader instructions, injected into the dnd-kit hidden description node. */
export const SORTABLE_INSTRUCTIONS =
  "To pick up an item, press the space bar. While dragging, use the arrow keys to move it. Press space again to drop it in its new position, or press escape to cancel.";

interface SortablePosition {
  index: number;
  total: number;
}

/** Reads the position dnd-kit records on the active or hovered sortable node. */
function sortablePosition(entity: Active | Over | null): SortablePosition | undefined {
  const current = entity?.data.current as SortableData | undefined;
  const sortable = current?.sortable;
  if (!sortable) return undefined;
  return { index: sortable.index, total: sortable.items.length };
}

/**
 * Builds drag announcements that name the item and its position, instead of the
 * raw ids dnd-kit uses by default.
 *
 * @param getLabel Maps an id to a human label. Ids without a label announce as-is.
 */
export function createSortableAnnouncements(
  getLabel?: ((id: string) => string | undefined) | undefined,
): Announcements {
  const name = (id: UniqueIdentifier) => getLabel?.(String(id)) ?? String(id);
  const at = (entity: Active | Over | null) => {
    const position = sortablePosition(entity);
    return position ? `position ${position.index + 1} of ${position.total}` : "a new position";
  };

  return {
    onDragStart: ({ active }) =>
      `Picked up ${name(active.id)} at ${at(active)}. Use the arrow keys to move it, or press escape to cancel.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${name(active.id)} moved to ${at(over)}.`
        : `${name(active.id)} is no longer over the list.`,
    onDragEnd: ({ active, over }) =>
      over ? `${name(active.id)} dropped at ${at(over)}.` : `${name(active.id)} was dropped.`,
    onDragCancel: ({ active }) => `Move cancelled. ${name(active.id)} returned to ${at(active)}.`,
  };
}

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

/** Reported once a drag finished on a different index. */
export interface SortableReorderEvent {
  /** Id that was dragged. */
  activeId: string;
  /** Id it was dropped on. */
  overId: string;
  /** Index in `ids` before the move. */
  from: number;
  /** Index in `ids` after the move. */
  to: number;
  /** Full id order after the move, ready to be applied. */
  ids: string[];
}

/** The dnd-kit drag binding, to spread onto the element that starts the drag. */
export interface SortableDragHandleProps {
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  setActivatorNodeRef: (element: HTMLElement | null) => void;
}

/** What `SortableItem` hands to its render prop. */
export interface SortableItemRenderProps {
  /** Spread onto `SortableHandle` so the handle starts the drag. */
  handleProps: SortableDragHandleProps;
  /** True while this row is the one being dragged. */
  isDragging: boolean;
  /** True while any row in the list is being dragged or settling. */
  isSorting: boolean;
  /** Current index of this row. */
  index: number;
}

export interface SortableListProps
  extends Omit<HTMLAttributes<HTMLUListElement>, "children" | "onDragEnd"> {
  /** Ordered ids. The rendered order must match this order. */
  ids: string[];
  /** Called after a completed drag, with the new id order. */
  onReorder: (event: SortableReorderEvent) => void;
  children: ReactNode;
  /** Human label for an id, used in the screen reader announcements. Defaults to the id. */
  getLabel?: (id: string) => string | undefined;
  /** Layout strategy. Defaults to a single vertical list. */
  strategy?: SortingStrategy;
  /** Collision detection. Defaults to `closestCenter`. */
  collisionDetection?: CollisionDetection;
  /** dnd-kit modifiers, for example `restrictToVerticalAxis`. */
  modifiers?: Modifiers;
  /** Disables dragging for the whole list. */
  disabled?: boolean;
  /** Screen reader instructions. Defaults to `SORTABLE_INSTRUCTIONS`. */
  instructions?: string;
}

export interface SortableItemProps extends Omit<HTMLAttributes<HTMLLIElement>, "children"> {
  /** Must match the id in the parent `SortableList`. */
  id: string;
  children: (props: SortableItemRenderProps) => ReactNode;
  /** Disables dragging for this row only. */
  disabled?: boolean;
}

export interface SortableHandleProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children" | "type">,
    SortableDragHandleProps {
  /** Accessible name. Say what moves, for example `Reorder Intro to Rust`. */
  label: string;
  /** Replaces the default grip icon. */
  icon?: ReactNode;
}

/* -------------------------------------------------------------------------- */
/* Components                                                                 */
/* -------------------------------------------------------------------------- */

const HANDLE_CLASS =
  "inline-flex h-6 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:cursor-grabbing dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200";

export function SortableList({
  ids,
  onReorder,
  children,
  getLabel,
  strategy = verticalListSortingStrategy,
  collisionDetection = closestCenter,
  modifiers = [],
  disabled = false,
  instructions = SORTABLE_INSTRUCTIONS,
  className,
  ...rest
}: SortableListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const announcements = createSortableAnnouncements(getLabel);
  const accessibility = { announcements, screenReaderInstructions: { draggable: instructions } };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return;

    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1 || from === to) return;

    onReorder({
      activeId: String(active.id),
      overId: String(over.id),
      from,
      to,
      ids: arrayMove(ids, from, to),
    });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      modifiers={modifiers}
      accessibility={accessibility}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={strategy} disabled={disabled}>
        <ul className={["list-none p-0", className].filter(Boolean).join(" ")} {...rest}>
          {children}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

export function SortableItem({
  id,
  children,
  disabled = false,
  className,
  style,
  ...rest
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isSorting,
    index,
  } = useSortable({ id, disabled });

  return (
    <li
      ref={setNodeRef}
      data-sortable-item={id}
      data-dragging={isDragging ? "true" : undefined}
      style={{ transform: CSS.Transform.toString(transform), transition, ...style }}
      className={className}
      {...rest}
    >
      {children({
        handleProps: { attributes, listeners, setActivatorNodeRef },
        isDragging,
        isSorting,
        index,
      })}
    </li>
  );
}

export function SortableHandle({
  attributes,
  listeners,
  setActivatorNodeRef,
  label,
  icon,
  className,
  ...rest
}: SortableHandleProps) {
  return (
    <button
      {...attributes}
      {...listeners}
      {...rest}
      ref={setActivatorNodeRef}
      type="button"
      aria-label={label}
      className={[HANDLE_CLASS, className].filter(Boolean).join(" ")}
    >
      {icon ?? <GripVertical aria-hidden="true" className="h-4 w-4" />}
    </button>
  );
}
