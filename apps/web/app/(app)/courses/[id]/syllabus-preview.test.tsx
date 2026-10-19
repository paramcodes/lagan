import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CourseDetailModule } from "./query";
import { SyllabusPreview } from "./syllabus-preview";

const sampleModules: CourseDetailModule[] = [
  {
    id: "mod_1",
    courseId: "course_1",
    title: "Module 1: Foundations",
    position: 0,
    lessons: [
      {
        id: "les_1",
        moduleId: "mod_1",
        title: "Introduction to the Course",
        type: "video",
        position: 0,
        duration: "10 min",
        isPreview: true,
      },
      {
        id: "les_2",
        moduleId: "mod_1",
        title: "Architecture Principles",
        type: "text",
        position: 1,
        duration: "5 min",
        isPreview: false,
      },
    ],
  },
  {
    id: "mod_2",
    courseId: "course_1",
    title: "Module 2: Advanced Concepts",
    position: 1,
    lessons: [
      {
        id: "les_3",
        moduleId: "mod_2",
        title: "Consensus Protocols",
        type: "video",
        position: 0,
        duration: "15 min",
        isPreview: false,
      },
    ],
  },
];

describe("SyllabusPreview", () => {
  it("renders empty state when no modules exist", () => {
    render(<SyllabusPreview courseId="course_1" modules={[]} isEnrolled={false} />);
    expect(screen.getByText("No curriculum modules published yet.")).toBeTruthy();
  });

  it("renders modules and lessons with durations and preview badges", () => {
    render(<SyllabusPreview courseId="course_1" modules={sampleModules} isEnrolled={false} />);

    expect(screen.getByText("Module 1: Foundations")).toBeTruthy();
    expect(screen.getByText("Module 2: Advanced Concepts")).toBeTruthy();
    expect(screen.getByText("Introduction to the Course")).toBeTruthy();
    expect(screen.getByText("Architecture Principles")).toBeTruthy();

    // Verify preview badge
    const previewBadges = screen.getAllByTestId("preview-badge");
    expect(previewBadges.length).toBe(1);
    expect(previewBadges[0]?.textContent).toContain("Preview");

    // Verify duration badges
    const durations = screen.getAllByTestId("lesson-duration");
    expect(durations[0]?.textContent).toContain("10 min");
    expect(durations[1]?.textContent).toContain("5 min");
    expect(durations[2]?.textContent).toContain("15 min");
  });

  it("toggles single module collapse on click", () => {
    render(<SyllabusPreview courseId="course_1" modules={sampleModules} isEnrolled={false} />);

    const moduleButton = screen.getByRole("button", { name: /module 1: foundations/i });
    expect(moduleButton.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Introduction to the Course")).toBeTruthy();

    // Click to collapse
    fireEvent.click(moduleButton);
    expect(moduleButton.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Introduction to the Course")).toBeNull();

    // Click to expand again
    fireEvent.click(moduleButton);
    expect(moduleButton.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Introduction to the Course")).toBeTruthy();
  });

  it("toggles all modules using Collapse all / Expand all button", () => {
    render(<SyllabusPreview courseId="course_1" modules={sampleModules} isEnrolled={false} />);

    const toggleAllBtn = screen.getByRole("button", { name: /collapse all/i });
    fireEvent.click(toggleAllBtn);

    expect(screen.getByRole("button", { name: /expand all/i })).toBeTruthy();
    expect(screen.queryByText("Introduction to the Course")).toBeNull();
    expect(screen.queryByText("Consensus Protocols")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /expand all/i }));
    expect(screen.getByText("Introduction to the Course")).toBeTruthy();
    expect(screen.getByText("Consensus Protocols")).toBeTruthy();
  });

  it("links preview lesson for unenrolled users, locks non-preview lesson", () => {
    render(<SyllabusPreview courseId="course_1" modules={sampleModules} isEnrolled={false} />);

    // Preview lesson is linked
    const previewLink = screen.getByRole("link", {
      name: /introduction to the course/i,
    });
    expect(previewLink).toBeTruthy();
    expect(previewLink.getAttribute("href")).toBe("/courses/course_1/lessons/les_1");

    // Locked lesson is not linked
    expect(screen.queryByRole("link", { name: /architecture principles/i })).toBeNull();
  });

  it("links all lessons when user is enrolled", () => {
    render(<SyllabusPreview courseId="course_1" modules={sampleModules} isEnrolled={true} />);

    expect(
      screen.getByRole("link", { name: /introduction to the course/i }).getAttribute("href"),
    ).toBe("/courses/course_1/lessons/les_1");

    expect(
      screen.getByRole("link", { name: /architecture principles/i }).getAttribute("href"),
    ).toBe("/courses/course_1/lessons/les_2");

    expect(screen.getByRole("link", { name: /consensus protocols/i }).getAttribute("href")).toBe(
      "/courses/course_1/lessons/les_3",
    );
  });
});
