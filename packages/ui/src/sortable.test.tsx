import type { Active, Over } from "@dnd-kit/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  createSortableAnnouncements,
  SORTABLE_INSTRUCTIONS,
  SortableHandle,
  SortableItem,
  SortableList,
  type SortableReorderEvent,
} from "./sortable";

const LABELS: Record<string, string> = {
  alpha: "Alpha",
  beta: "Beta",
  gamma: "Gamma",
};

function label(id: string) {
  return LABELS[id] ?? id;
}

/** Builds the shape dnd-kit hands to the announcement callbacks. */
function makeEntity(id: string, index: number, total: number) {
  const items = Array.from({ length: total }, (_, i) => `item-${i}`);
  return {
    id,
    data: { current: { sortable: { containerId: "list", index, items } } },
  } as unknown as Active & Over;
}

describe("createSortableAnnouncements", () => {
  const announcements = createSortableAnnouncements(label);

  it("names the picked up item and its position", () => {
    const text = announcements.onDragStart({ active: makeEntity("alpha", 0, 3) });

    expect(text).toBe(
      "Picked up Alpha at position 1 of 3. Use the arrow keys to move it, or press escape to cancel.",
    );
  });

  it("announces the position reached while dragging over another item", () => {
    const text = announcements.onDragOver({
      active: makeEntity("alpha", 0, 3),
      over: makeEntity("gamma", 2, 3),
    });

    expect(text).toBe("Alpha moved to position 3 of 3.");
  });

  it("announces the dropped position", () => {
    const text = announcements.onDragEnd({
      active: makeEntity("alpha", 0, 3),
      over: makeEntity("beta", 1, 3),
    });

    expect(text).toBe("Alpha dropped at position 2 of 3.");
  });

  it("falls back to the raw id when no label is given", () => {
    const plain = createSortableAnnouncements();
    const text = plain.onDragEnd({
      active: makeEntity("lesson_9f2", 1, 2),
      over: makeEntity("lesson_9f2", 1, 2),
    });

    expect(text).toBe("lesson_9f2 dropped at position 2 of 2.");
  });
});

function Harness({ onReorder }: { onReorder: (event: SortableReorderEvent) => void }) {
  const [ids, setIds] = useState(["alpha", "beta", "gamma"]);

  return (
    <SortableList
      ids={ids}
      getLabel={label}
      onReorder={(event) => {
        setIds(event.ids);
        onReorder(event);
      }}
    >
      {ids.map((id) => (
        <SortableItem key={id} id={id}>
          {({ handleProps }) => (
            <div>
              <SortableHandle {...handleProps} label={`Reorder ${label(id)}`} />
              <span>{label(id)}</span>
            </div>
          )}
        </SortableItem>
      ))}
    </SortableList>
  );
}

/** jsdom has no layout, so the keyboard sensor needs the rows to have real rects. */
function layoutRows(height = 40) {
  const rows = document.querySelectorAll<HTMLElement>("[data-sortable-item]");
  rows.forEach((row, index) => {
    const top = index * height;
    const rect = {
      x: 0,
      y: top,
      top,
      left: 0,
      right: 240,
      bottom: top + height,
      width: 240,
      height,
    };
    row.getBoundingClientRect = () => ({ ...rect, toJSON: () => rect }) as DOMRect;
  });
}

/** The keyboard sensor attaches its document listener on a macrotask. */
function flushKeyboardSensor() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("SortableList", () => {
  it("renders every item as a list item with a labelled, described drag handle", () => {
    render(<Harness onReorder={vi.fn()} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(3);

    for (const name of ["Alpha", "Beta", "Gamma"]) {
      const handle = screen.getByRole("button", { name: `Reorder ${name}` });
      expect(handle).toHaveAttribute("type", "button");
      expect(handle).toHaveAttribute("aria-roledescription", "sortable");

      const descriptionId = handle.getAttribute("aria-describedby") as string;
      expect(document.getElementById(descriptionId)).toHaveTextContent(SORTABLE_INSTRUCTIONS);
    }
  });

  it("reorders with the keyboard: space to pick up, arrows to move, space to drop", async () => {
    const onReorder = vi.fn();
    render(<Harness onReorder={onReorder} />);
    layoutRows();

    const handle = screen.getByRole("button", { name: "Reorder Alpha" });
    handle.focus();
    fireEvent.keyDown(handle, { code: "Space", key: " " });
    await flushKeyboardSensor();
    fireEvent.keyDown(document, { code: "ArrowDown", key: "ArrowDown" });
    fireEvent.keyDown(document, { code: "Space", key: " " });

    await waitFor(() => expect(onReorder).toHaveBeenCalledTimes(1));
    expect(onReorder.mock.calls[0]?.[0]).toMatchObject({
      activeId: "alpha",
      overId: "beta",
      from: 0,
      to: 1,
      ids: ["beta", "alpha", "gamma"],
    });
    expect(screen.getByRole("status")).toHaveTextContent("Alpha dropped at position 2 of 3.");
  });

  it("cancels on escape without reordering", async () => {
    const onReorder = vi.fn();
    render(<Harness onReorder={onReorder} />);
    layoutRows();

    const handle = screen.getByRole("button", { name: "Reorder Beta" });
    handle.focus();
    fireEvent.keyDown(handle, { code: "Space", key: " " });
    await flushKeyboardSensor();
    fireEvent.keyDown(document, { code: "ArrowDown", key: "ArrowDown" });
    fireEvent.keyDown(document, { code: "Escape", key: "Escape" });

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Move cancelled. Beta returned to"),
    );
    expect(onReorder).not.toHaveBeenCalled();
  });
});
