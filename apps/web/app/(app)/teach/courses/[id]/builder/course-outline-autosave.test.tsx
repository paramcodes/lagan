import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actionsMock = vi.hoisted(() => ({
  createModule: vi.fn(),
  updateModule: vi.fn(),
  deleteModule: vi.fn(),
  reorderModules: vi.fn(),
  createLesson: vi.fn(),
  updateLesson: vi.fn(),
  deleteLesson: vi.fn(),
  reorderLessons: vi.fn(),
}));

vi.mock("../../builder/actions", () => ({
  createModule: actionsMock.createModule,
  updateModule: actionsMock.updateModule,
  deleteModule: actionsMock.deleteModule,
  reorderModules: actionsMock.reorderModules,
  createLesson: actionsMock.createLesson,
  updateLesson: actionsMock.updateLesson,
  deleteLesson: actionsMock.deleteLesson,
  reorderLessons: actionsMock.reorderLessons,
}));

import { CourseOutlineBuilder } from "./course-outline-builder";
import {
  getCourseDraft,
  getModuleDraft,
  saveCourseDraft,
  setDefaultStorage,
  type StorageInterface,
} from "./draft-storage";
import type { CourseBuilderData } from "./query";

function createMemoryStorage(): StorageInterface {
  const store = new Map<string, string>();
  return {
    getItem: (name: string) => store.get(name) ?? null,
    setItem: (name: string, value: string) => {
      store.set(name, value);
    },
    removeItem: (name: string) => {
      store.delete(name);
    },
  };
}

const sampleCourse: CourseBuilderData = {
  id: "course_1",
  title: "Building Distributed Systems",
  description: "Learn distributed systems from scratch",
  priceCents: 5000,
  discountPercent: 0,
  isFree: false,
  status: "draft",
  authorId: "user_1",
  modules: [
    {
      id: "mod_1",
      courseId: "course_1",
      title: "Foundations",
      position: 0,
      lessons: [
        {
          id: "les_1",
          moduleId: "mod_1",
          type: "video",
          title: "System Design 101",
          position: 0,
          status: "published",
          muxPlaybackId: "mux_1",
          externalUrl: null,
          fileKey: null,
          updatedAt: new Date("2026-01-01"),
        },
      ],
    },
  ],
};

describe("CourseOutlineBuilder Draft Autosave Integration", { timeout: 20000 }, () => {
  let storage: StorageInterface;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = createMemoryStorage();
    setDefaultStorage(storage);
    actionsMock.updateModule.mockResolvedValue({ id: "mod_1", title: "Updated Foundations" });
    actionsMock.updateLesson.mockResolvedValue({
      id: "les_1",
      title: "Updated Lesson",
      type: "video",
      status: "published",
    });
  });

  it("displays 'Saved' badge initially when in sync with server", () => {
    render(<CourseOutlineBuilder initialCourse={sampleCourse} />);

    const badge = screen.getByTestId("save-state-badge");
    expect(badge.textContent).toContain("Saved");
  });

  it("updates save badge and persists draft to IndexedDB when user edits module title", async () => {
    render(<CourseOutlineBuilder initialCourse={sampleCourse} />);

    // Click pencil to edit module title
    const editBtn = screen.getByRole("button", { name: 'Edit module "Foundations"' });
    fireEvent.click(editBtn);

    const input = screen.getByRole("textbox", { name: "Module title" });
    fireEvent.change(input, { target: { value: "Foundations Draft" } });

    // Badge changes to Unsaved draft
    const badge = screen.getByTestId("save-state-badge");
    expect(badge.textContent).toContain("Offline / Unsaved draft");

    // Wait for debounce to write to storage
    await waitFor(async () => {
      const draft = await getModuleDraft("mod_1", storage);
      expect(draft?.title).toBe("Foundations Draft");
    });
  });

  it("flushes module title to server on blur and clears draft on success", async () => {
    render(<CourseOutlineBuilder initialCourse={sampleCourse} />);

    const editBtn = screen.getByRole("button", { name: 'Edit module "Foundations"' });
    fireEvent.click(editBtn);

    const input = screen.getByRole("textbox", { name: "Module title" });
    fireEvent.change(input, { target: { value: "Updated Foundations" } });

    // Trigger blur
    fireEvent.blur(input);

    await waitFor(() => {
      expect(actionsMock.updateModule).toHaveBeenCalledWith({
        id: "mod_1",
        title: "Updated Foundations",
      });
    });

    await waitFor(async () => {
      const draft = await getModuleDraft("mod_1", storage);
      expect(draft).toBeNull();
      expect(screen.getByTestId("save-state-badge").textContent).toContain("Saved");
    });
  });

  it("flushes pending edits when clicking explicit Save button in header", async () => {
    render(<CourseOutlineBuilder initialCourse={sampleCourse} />);

    const editBtn = screen.getByRole("button", { name: 'Edit module "Foundations"' });
    fireEvent.click(editBtn);

    const input = screen.getByRole("textbox", { name: "Module title" });
    fireEvent.change(input, { target: { value: "Saved Via Header Button" } });

    actionsMock.updateModule.mockResolvedValueOnce({
      id: "mod_1",
      title: "Saved Via Header Button",
    });

    // Explicit Save button in header
    const saveButton = screen.getByRole("button", { name: "Save draft" });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(actionsMock.updateModule).toHaveBeenCalledWith({
        id: "mod_1",
        title: "Saved Via Header Button",
      });
    });

    await waitFor(async () => {
      const draft = await getCourseDraft("course_1", storage);
      expect(draft).toBeNull();
      expect(screen.getByTestId("save-state-badge").textContent).toContain("Saved");
    });
  });

  it("hydrates unsaved local draft on mount and displays restored draft banner", async () => {
    // Pre-populate storage with a draft
    await saveCourseDraft(
      {
        courseId: "course_1",
        modules: sampleCourse.modules,
        pendingModules: {
          mod_1: {
            moduleId: "mod_1",
            courseId: "course_1",
            title: "Hydrated Module Title",
            updatedAt: new Date().toISOString(),
          },
        },
        pendingLessons: {},
        updatedAt: new Date().toISOString(),
      },
      storage,
    );

    render(<CourseOutlineBuilder initialCourse={sampleCourse} />);

    // Hydrated draft title is displayed
    await waitFor(() => {
      expect(screen.getByText("Hydrated Module Title")).toBeTruthy();
    });

    // Restored draft notification banner is displayed
    const banner = screen.getByRole("status", { name: "Restored draft notification" });
    expect(banner.textContent).toContain("Restored draft:");
    expect(banner.textContent).toContain(
      "You have unsaved changes restored from a previous session.",
    );

    // Badge reflects unsaved draft
    expect(screen.getByTestId("save-state-badge").textContent).toContain("Offline / Unsaved draft");
  });

  it("discards restored draft and reverts to server state when clicking Discard draft", async () => {
    await saveCourseDraft(
      {
        courseId: "course_1",
        modules: sampleCourse.modules,
        pendingModules: {
          mod_1: {
            moduleId: "mod_1",
            courseId: "course_1",
            title: "Temporary Draft",
            updatedAt: new Date().toISOString(),
          },
        },
        pendingLessons: {},
        updatedAt: new Date().toISOString(),
      },
      storage,
    );

    render(<CourseOutlineBuilder initialCourse={sampleCourse} />);

    await waitFor(() => {
      expect(screen.getByText("Temporary Draft")).toBeTruthy();
    });

    const discardBtn = screen.getByRole("button", { name: "Discard draft" });
    fireEvent.click(discardBtn);

    // Reverts to original server state
    await waitFor(() => {
      expect(screen.getByText("Foundations")).toBeTruthy();
      expect(screen.queryByText("Temporary Draft")).toBeNull();
      expect(screen.queryByRole("status", { name: "Restored draft notification" })).toBeNull();
      expect(screen.getByTestId("save-state-badge").textContent).toContain("Saved");
    });

    expect(await getCourseDraft("course_1", storage)).toBeNull();
  });
});
