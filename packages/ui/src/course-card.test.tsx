import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { type CourseCardData, CourseCard, CourseLedgerRow } from "./course-card";

const BASE_COURSE: CourseCardData = {
  id: "course_123",
  title: "Intro to Modern TypeScript",
  authorName: "Jane Doe",
  priceCents: 4999,
  discountPercent: 0,
  isFree: false,
};

describe("CourseCard", () => {
  it("renders the course title, author name, and list price", () => {
    render(<CourseCard course={BASE_COURSE} />);

    expect(screen.getByText("Intro to Modern TypeScript")).toBeTruthy();
    expect(screen.getByText("Jane Doe")).toBeTruthy();
    expect(screen.getByText("$49.99")).toBeTruthy();

    const link = screen.getByRole("link", { name: /Intro to Modern TypeScript/i });
    expect(link.getAttribute("href")).toBe("/courses/course_123");
  });

  it("renders Free for a free course", () => {
    const freeCourse: CourseCardData = {
      ...BASE_COURSE,
      priceCents: 0,
      isFree: true,
    };
    render(<CourseCard course={freeCourse} />);

    expect(screen.getByText("Free")).toBeTruthy();
  });

  it("renders discounted price alongside strikethrough original price", () => {
    const discountedCourse: CourseCardData = {
      ...BASE_COURSE,
      priceCents: 10000,
      discountPercent: 20,
    };
    render(<CourseCard course={discountedCourse} />);

    expect(screen.getByText("$80.00")).toBeTruthy();
    expect(screen.getByText("$100.00")).toBeTruthy();
  });

  it("renders a badge when provided", () => {
    const badgedCourse: CourseCardData = {
      ...BASE_COURSE,
      badge: "Bestseller",
    };
    render(<CourseCard course={badgedCourse} />);

    expect(screen.getAllByText("Bestseller").length).toBeGreaterThan(0);
  });

  it("renders an image thumbnail when thumbnailUrl is provided", () => {
    const thumbCourse: CourseCardData = {
      ...BASE_COURSE,
      thumbnailUrl: "https://example.com/thumb.jpg",
    };
    render(<CourseCard course={thumbCourse} />);

    const img = screen.getByRole("img", { hidden: true });
    expect(img.getAttribute("src")).toBe("https://example.com/thumb.jpg");
  });
});

describe("CourseLedgerRow", () => {
  it("renders ledger row with link, title, author, and price", () => {
    render(<CourseLedgerRow course={BASE_COURSE} />);

    expect(screen.getByText("Intro to Modern TypeScript")).toBeTruthy();
    expect(screen.getByText("Jane Doe")).toBeTruthy();
    expect(screen.getByText("$49.99")).toBeTruthy();

    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/courses/course_123");
  });

  it("renders a badge in the ledger row when present", () => {
    const badgedCourse: CourseCardData = {
      ...BASE_COURSE,
      badge: "New",
    };
    render(<CourseLedgerRow course={badgedCourse} />);

    expect(screen.getByText("New")).toBeTruthy();
  });
});
