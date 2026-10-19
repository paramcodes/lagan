import { describe, expect, it } from "vitest";
import {
  buildCourseListHref,
  clampPage,
  coursePageCount,
  COURSE_PAGE_SIZE,
  pageOffset,
  parseCourseListParams,
} from "./params";

describe("parseCourseListParams", () => {
  it("defaults an empty query string", () => {
    expect(parseCourseListParams({})).toEqual({
      search: "",
      category: "all",
      page: 1,
      view: "cards",
    });
  });

  it("reads q, category, page and view", () => {
    expect(
      parseCourseListParams({ q: "  algebra ", category: "design", page: "3", view: "ledger" }),
    ).toEqual({
      search: "algebra",
      category: "design",
      page: 3,
      view: "ledger",
    });
  });

  it("takes the first value when a param repeats", () => {
    expect(parseCourseListParams({ q: ["first", "second"] }).search).toBe("first");
  });

  it("falls back for unknown category, unknown view and bad page", () => {
    expect(parseCourseListParams({ category: "astrology", view: "tiles", page: "-2" })).toEqual({
      search: "",
      category: "all",
      page: 1,
      view: "cards",
    });
  });

  it("truncates an over-long search term to 200 characters", () => {
    expect(parseCourseListParams({ q: "x".repeat(500) }).search).toHaveLength(200);
  });
});

describe("coursePageCount", () => {
  it("counts pages at the page-size boundary", () => {
    expect(coursePageCount(0)).toBe(1);
    expect(coursePageCount(1)).toBe(1);
    expect(coursePageCount(COURSE_PAGE_SIZE)).toBe(1);
    expect(coursePageCount(COURSE_PAGE_SIZE + 1)).toBe(2);
    expect(coursePageCount(COURSE_PAGE_SIZE * 5)).toBe(5);
  });

  it("honours an explicit page size", () => {
    expect(coursePageCount(10, 4)).toBe(3);
  });
});

describe("clampPage", () => {
  it("keeps an in-range page", () => {
    expect(clampPage(2, 3)).toBe(2);
  });

  it("pulls an out-of-range page back into range", () => {
    expect(clampPage(9, 3)).toBe(3);
    expect(clampPage(0, 3)).toBe(1);
    expect(clampPage(-4, 3)).toBe(1);
  });

  it("returns page 1 for an empty catalogue", () => {
    expect(clampPage(7, 0)).toBe(1);
  });
});

describe("pageOffset", () => {
  it("is zero-based in units of one page", () => {
    expect(pageOffset(1)).toBe(0);
    expect(pageOffset(2)).toBe(COURSE_PAGE_SIZE);
    expect(pageOffset(3, 10)).toBe(20);
  });
});

describe("buildCourseListHref", () => {
  it("returns the bare route for defaults", () => {
    expect(buildCourseListHref({})).toBe("/courses");
    expect(buildCourseListHref({ search: "", category: "all", view: "cards", page: 1 })).toBe(
      "/courses",
    );
  });

  it("carries search, category and view", () => {
    expect(buildCourseListHref({ search: "algebra", category: "design", view: "ledger" })).toBe(
      "/courses?q=algebra&category=design&view=ledger",
    );
  });

  it("carries the page only when it is past the first", () => {
    expect(buildCourseListHref({ page: 2 })).toBe("/courses?page=2");
    expect(buildCourseListHref({ page: 1 })).toBe("/courses");
  });

  it("encodes a search term with reserved characters", () => {
    expect(buildCourseListHref({ search: "design & code" })).toBe("/courses?q=design+%26+code");
  });
});
