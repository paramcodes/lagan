"use client";

import { usePathname, useRouter } from "next/navigation";
import type { ChangeEvent } from "react";
import type { CourseSummaryItem, DateRangeKey } from "./types";

interface CourseSelectorProps {
  courses: CourseSummaryItem[];
  selectedCourseId: string | null;
  currentRange: DateRangeKey;
}

export function CourseSelector({ courses, selectedCourseId, currentRange }: CourseSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();

  if (courses.length === 0) {
    return null;
  }

  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const nextCourseId = e.target.value;
    const params = new URLSearchParams();
    if (currentRange !== "30d") {
      params.set("range", currentRange);
    }
    if (nextCourseId && nextCourseId !== "all") {
      params.set("courseId", nextCourseId);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="course-filter-select" className="sr-only">
        Filter analytics by course
      </label>
      <select
        id="course-filter-select"
        aria-label="Filter analytics by course"
        value={selectedCourseId ?? "all"}
        onChange={handleChange}
        className="h-9 rounded-[var(--radius-control)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-xs font-medium text-[var(--color-ink)] shadow-2xs outline-none transition-colors hover:border-[var(--color-edge)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]"
      >
        <option value="all">All courses ({courses.length})</option>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>
    </div>
  );
}
