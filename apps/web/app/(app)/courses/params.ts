/** Rows per page of the public catalogue. */
export const COURSE_PAGE_SIZE = 12;

export const COURSE_VIEWS = ["cards", "ledger"] as const;
export type CourseView = (typeof COURSE_VIEWS)[number];

/**
 * The shell's category select has carried these values since P1.9. They stay in the
 * URL for linkability, but `courses` has no category column to filter on — see
 * `filters.ts`.
 */
export const COURSE_CATEGORY_OPTIONS = [
  { value: "all", label: "All categories" },
  { value: "design", label: "Design" },
  { value: "development", label: "Development" },
  { value: "business", label: "Business" },
  { value: "marketing", label: "Marketing" },
] as const;

export type CourseCategory = (typeof COURSE_CATEGORY_OPTIONS)[number]["value"];

export const DEFAULT_COURSE_CATEGORY: CourseCategory = "all";
export const DEFAULT_COURSE_VIEW: CourseView = "cards";

export interface CourseListParams {
  search: string;
  category: CourseCategory;
  page: number;
  view: CourseView;
}

/** Longest search term accepted; keeps the ILIKE pattern bounded. */
const MAX_SEARCH_LENGTH = 200;

export type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function parseCategory(value: string): CourseCategory {
  const match = COURSE_CATEGORY_OPTIONS.find((option) => option.value === value);
  return match?.value ?? DEFAULT_COURSE_CATEGORY;
}

function parseView(value: string): CourseView {
  return COURSE_VIEWS.find((view) => view === value) ?? DEFAULT_COURSE_VIEW;
}

function parsePage(value: string): number {
  const page = Number.parseInt(value, 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

/** URL params to a validated, defaulted shape. Unknown values fall back, never throw. */
export function parseCourseListParams(raw: RawSearchParams): CourseListParams {
  return {
    search: firstValue(raw.q).trim().slice(0, MAX_SEARCH_LENGTH),
    category: parseCategory(firstValue(raw.category)),
    page: parsePage(firstValue(raw.page)),
    view: parseView(firstValue(raw.view)),
  };
}

export function coursePageCount(total: number, pageSize: number = COURSE_PAGE_SIZE): number {
  if (total <= 0) return 1;
  return Math.ceil(total / pageSize);
}

export function clampPage(page: number, pageCount: number): number {
  return Math.min(Math.max(page, 1), Math.max(pageCount, 1));
}

export function pageOffset(page: number, pageSize: number = COURSE_PAGE_SIZE): number {
  return (Math.max(page, 1) - 1) * pageSize;
}

/** Catalogue link with defaults omitted, so canonical URLs stay short and shareable. */
export function buildCourseListHref(params: Partial<CourseListParams>): string {
  const query = new URLSearchParams();
  if (params.search) query.set("q", params.search);
  if (params.category && params.category !== DEFAULT_COURSE_CATEGORY) {
    query.set("category", params.category);
  }
  if (params.view && params.view !== DEFAULT_COURSE_VIEW) query.set("view", params.view);
  if (params.page && params.page > 1) query.set("page", String(params.page));

  const search = query.toString();
  return search ? `/courses?${search}` : "/courses";
}
