import { CourseCard, CourseLedgerRow } from "@lagan/ui";
import Link from "next/link";
import { connection } from "next/server";
import { CourseViewToggle } from "./course-view-toggle";
import {
  buildCourseListHref,
  pageOffset,
  parseCourseListParams,
  type RawSearchParams,
} from "./params";
import { listPublishedCourses } from "./query";

export const instant = false;

export const metadata = { title: "Browse courses" };

const PAGINATION_CONTROL =
  "rounded-[var(--radius-control)] border border-[var(--color-line)] px-3 py-1.5 font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-edge)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]";

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  await connection();

  const params = parseCourseListParams(await searchParams);
  const { rows, total, page, pageCount } = await listPublishedCourses(params);

  const hasFilters = params.search !== "" || params.category !== "all";
  const firstRow = pageOffset(page) + 1;
  const lastRow = pageOffset(page) + rows.length;

  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs text-[var(--color-ink2)]">Catalogue</p>
          <h1 className="text-2xl font-semibold text-[var(--color-ink)]">Courses</h1>
          <p className="mt-1 text-sm text-[var(--color-ink2)]">
            {total === 0
              ? "No published courses"
              : `${total} published ${total === 1 ? "course" : "courses"}${
                  pageCount > 1 ? `, showing ${firstRow}–${lastRow}` : ""
                }`}
          </p>
        </div>
        <CourseViewToggle value={params.view} />
      </header>

      {params.category !== "all" ? (
        <p
          role="status"
          className="mb-4 rounded-[var(--radius-control)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-edge)]"
        >
          Category filtering is not applied: courses have no category column yet, so every category
          is listed.
        </p>
      ) : null}

      {params.search !== "" ? (
        <p className="mb-4 text-sm text-[var(--color-ink2)]">
          Results for <span className="font-medium text-[var(--color-ink)]">{params.search}</span>
        </p>
      ) : null}

      {rows.length === 0 ? (
        <div className="rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] px-6 py-12 text-center">
          <h2 className="text-base font-semibold text-[var(--color-ink)]">
            {hasFilters ? "No courses match your search" : "No courses published yet"}
          </h2>
          <p className="mt-1 text-sm text-[var(--color-ink2)]">
            {hasFilters
              ? "Try a different term, or clear the filters to see everything."
              : "Published courses will appear here as authors release them."}
          </p>
          {hasFilters ? (
            <Link href="/courses" className={`${PAGINATION_CONTROL} mt-4 inline-flex`}>
              Clear filters
            </Link>
          ) : null}
        </div>
      ) : params.view === "ledger" ? (
        <ul className="rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)]">
          {rows.map((course) => (
            <CourseLedgerRow key={course.id} course={course} />
          ))}
        </ul>
      ) : (
        <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((course) => (
            <li key={course.id}>
              <CourseCard course={course} />
            </li>
          ))}
        </ul>
      )}

      {pageCount > 1 ? (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link
              className={PAGINATION_CONTROL}
              href={buildCourseListHref({ ...params, page: page - 1 })}
            >
              Previous
            </Link>
          ) : (
            <span aria-disabled="true" className="px-3 py-1.5 text-[var(--color-edge)]">
              Previous
            </span>
          )}

          <span className="text-[var(--color-edge)] tabular-nums">
            Page {page} of {pageCount}
          </span>

          {page < pageCount ? (
            <Link
              className={PAGINATION_CONTROL}
              href={buildCourseListHref({ ...params, page: page + 1 })}
            >
              Next
            </Link>
          ) : (
            <span aria-disabled="true" className="px-3 py-1.5 text-[var(--color-edge)]">
              Next
            </span>
          )}
        </nav>
      ) : null}
    </main>
  );
}
