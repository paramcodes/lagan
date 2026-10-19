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
import type { CourseBuilderData } from "./query";

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
        {
          id: "les_2",
          moduleId: "mod_1",
          type: "text",
          title: "Network Partitions",
          position: 1,
          status: "draft",
          muxPlaybackId: null,
          externalUrl: null,
          fileKey: null,
          updatedAt: new Date("2026-01-02"),
        },
      ],
    },
    {
      id: "mod_2",
      courseId: "course_1",
      title: "Consensus Algorithms",
      position: 1,
      lessons: [
        {
          id: "les_3",
          moduleId: "mod_2",
          type: "quiz",
          title: "Raft Quiz",
          position: 0,
          status: "draft",
          muxPlaybackId: null,
          externalUrl: null,
          fileKey: null,
          updatedAt: new Date("2026-01-03"),
        },
      ],
    },
  ],
};

describe("CourseOutlineBuilder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("renders course header, modules, lessons and stats", () => {
    render(<CourseOutlineBuilder initialCourse={sampleCourse} />);

    expect(screen.getByText("Building Distributed Systems")).toBeTruthy();
    expect(screen.getByText("2 modules • 3 lessons")).toBeTruthy();
    expect(screen.getByText("Foundations")).toBeTruthy();
    expect(screen.getByText("Consensus Algorithms")).toBeTruthy();
    expect(screen.getByText("System Design 101")).toBeTruthy();
    expect(screen.getByText("Network Partitions")).toBeTruthy();
    expect(screen.getByText("Raft Quiz")).toBeTruthy();
  });

  it("switches between cards and list view and persists preference", () => {
    render(<CourseOutlineBuilder initialCourse={sampleCourse} />);

    const listBtn = screen.getByRole("button", { name: "List" });
    const cardsBtn = screen.getByRole("button", { name: "Cards" });

    expect(cardsBtn.getAttribute("aria-pressed")).toBe("true");
    expect(listBtn.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(listBtn);
    expect(listBtn.getAttribute("aria-pressed")).toBe("true");
    expect(cardsBtn.getAttribute("aria-pressed")).toBe("false");
    expect(window.localStorage.getItem("lagan.builder.view")).toBe("list");

    // In list view, module header and lesson rows are present
    expect(screen.getByText("1.1")).toBeTruthy();
    expect(screen.getByText("1.2")).toBeTruthy();
    expect(screen.getByText("2.1")).toBeTruthy();

    fireEvent.click(cardsBtn);
    expect(cardsBtn.getAttribute("aria-pressed")).toBe("true");
    expect(window.localStorage.getItem("lagan.builder.view")).toBe("cards");
  }, 20000);

  it("loads view preference from localStorage if previously saved", () => {
    window.localStorage.setItem("lagan.builder.view", "list");
    render(<CourseOutlineBuilder initialCourse={sampleCourse} />);

    expect(screen.getByRole("button", { name: "List" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("adds a new module", async () => {
    actionsMock.createModule.mockResolvedValueOnce({
      id: "mod_3",
      courseId: "course_1",
      title: "Storage Engines",
      position: 2,
    });

    render(<CourseOutlineBuilder initialCourse={sampleCourse} />);

    fireEvent.click(screen.getByRole("button", { name: "Add module" }));

    const input = screen.getByLabelText("New module title");
    fireEvent.change(input, { target: { value: "Storage Engines" } });

    fireEvent.click(screen.getByRole("button", { name: /Add module/i }));

    await waitFor(() => {
      expect(actionsMock.createModule).toHaveBeenCalledWith({
        courseId: "course_1",
        title: "Storage Engines",
      });
      expect(screen.getByText("Storage Engines")).toBeTruthy();
    });
  });

  it("edits module title", async () => {
    actionsMock.updateModule.mockResolvedValueOnce({
      id: "mod_1",
      title: "Distributed Core Foundations",
    });

    render(<CourseOutlineBuilder initialCourse={sampleCourse} />);

    fireEvent.click(screen.getByLabelText('Edit module "Foundations"'));

    const input = screen.getByLabelText("Module title");
    fireEvent.change(input, { target: { value: "Distributed Core Foundations" } });

    fireEvent.click(screen.getByLabelText("Save module title"));

    await waitFor(() => {
      expect(actionsMock.updateModule).toHaveBeenCalledWith({
        id: "mod_1",
        title: "Distributed Core Foundations",
      });
      expect(screen.getByText("Distributed Core Foundations")).toBeTruthy();
    });
  });

  it("deletes a module", async () => {
    actionsMock.deleteModule.mockResolvedValueOnce({ id: "mod_2" });

    render(<CourseOutlineBuilder initialCourse={sampleCourse} />);

    expect(screen.getByText("Consensus Algorithms")).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Delete module "Consensus Algorithms"'));

    await waitFor(() => {
      expect(actionsMock.deleteModule).toHaveBeenCalledWith({ id: "mod_2" });
      expect(screen.queryByText("Consensus Algorithms")).toBeNull();
    });
  });

  it("reorders modules using Move Down and Move Up keyboard buttons", async () => {
    actionsMock.reorderModules.mockResolvedValueOnce({
      courseId: "course_1",
      orderedIds: ["mod_2", "mod_1"],
    });

    render(<CourseOutlineBuilder initialCourse={sampleCourse} />);

    const moveDownBtn = screen.getByLabelText('Move module "Foundations" down');
    fireEvent.click(moveDownBtn);

    await waitFor(() => {
      expect(actionsMock.reorderModules).toHaveBeenCalledWith({
        courseId: "course_1",
        orderedIds: ["mod_2", "mod_1"],
      });
    });
  });

  it("adds a new lesson to a module", async () => {
    actionsMock.createLesson.mockResolvedValueOnce({
      id: "les_4",
      moduleId: "mod_1",
      type: "quiz",
      title: "Foundations Checkpoint",
      position: 2,
      status: "draft",
      muxPlaybackId: null,
      externalUrl: null,
      fileKey: null,
      updatedAt: new Date("2026-01-04"),
    });

    render(<CourseOutlineBuilder initialCourse={sampleCourse} />);

    fireEvent.click(screen.getByLabelText('Add lesson to module "Foundations"'));

    const titleInput = screen.getByLabelText("New lesson title for module Foundations");
    fireEvent.change(titleInput, { target: { value: "Foundations Checkpoint" } });

    const typeSelect = screen.getByLabelText("New lesson type");
    fireEvent.change(typeSelect, { target: { value: "quiz" } });

    fireEvent.click(screen.getByRole("button", { name: "Add lesson" }));

    await waitFor(() => {
      expect(actionsMock.createLesson).toHaveBeenCalledWith({
        moduleId: "mod_1",
        title: "Foundations Checkpoint",
        type: "quiz",
      });
      expect(screen.getByText("Foundations Checkpoint")).toBeTruthy();
    });
  });

  it("edits a lesson title, type, and status", async () => {
    actionsMock.updateLesson.mockResolvedValueOnce({
      id: "les_1",
      title: "System Design Masterclass",
      type: "video",
      status: "draft",
      updatedAt: new Date("2026-01-05"),
    });

    render(<CourseOutlineBuilder initialCourse={sampleCourse} />);

    fireEvent.click(screen.getByLabelText('Edit lesson "System Design 101"'));

    const titleInput = screen.getByLabelText("Lesson Title");
    fireEvent.change(titleInput, { target: { value: "System Design Masterclass" } });

    const statusSelect = screen.getByLabelText("Status");
    fireEvent.change(statusSelect, { target: { value: "draft" } });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(actionsMock.updateLesson).toHaveBeenCalledWith({
        id: "les_1",
        title: "System Design Masterclass",
        type: "video",
        status: "draft",
      });
      expect(screen.getByText("System Design Masterclass")).toBeTruthy();
    });
  });

  it("deletes a lesson", async () => {
    actionsMock.deleteLesson.mockResolvedValueOnce({ id: "les_2" });

    render(<CourseOutlineBuilder initialCourse={sampleCourse} />);

    expect(screen.getByText("Network Partitions")).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Delete lesson "Network Partitions"'));

    await waitFor(() => {
      expect(actionsMock.deleteLesson).toHaveBeenCalledWith({ id: "les_2" });
      expect(screen.queryByText("Network Partitions")).toBeNull();
    });
  });

  it("reorders lessons using Move Down and Move Up keyboard buttons", async () => {
    actionsMock.reorderLessons.mockResolvedValueOnce({
      moduleId: "mod_1",
      orderedIds: ["les_2", "les_1"],
    });

    render(<CourseOutlineBuilder initialCourse={sampleCourse} />);

    const moveDownBtn = screen.getByLabelText('Move lesson "System Design 101" down');
    fireEvent.click(moveDownBtn);

    await waitFor(() => {
      expect(actionsMock.reorderLessons).toHaveBeenCalledWith({
        moduleId: "mod_1",
        orderedIds: ["les_2", "les_1"],
      });
    });
  });

  it("displays and dismisses error alert when action throws", async () => {
    actionsMock.createModule.mockRejectedValueOnce(new Error("Network connection failed"));

    render(<CourseOutlineBuilder initialCourse={sampleCourse} />);

    fireEvent.click(screen.getByRole("button", { name: "Add module" }));
    const input = screen.getByLabelText("New module title");
    fireEvent.change(input, { target: { value: "Fault Tolerance" } });
    fireEvent.click(screen.getByRole("button", { name: /Add module/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("Network connection failed");
    });

    fireEvent.click(screen.getByLabelText("Dismiss error"));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders empty state when there are no modules", () => {
    const emptyCourse: CourseBuilderData = {
      ...sampleCourse,
      modules: [],
    };

    render(<CourseOutlineBuilder initialCourse={emptyCourse} />);

    expect(screen.getByText("No modules yet")).toBeTruthy();
    expect(screen.getByText("0 modules • 0 lessons")).toBeTruthy();
  });
});
