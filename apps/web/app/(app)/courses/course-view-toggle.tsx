"use client";

import { ViewToggle } from "@lagan/ui";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { type CourseView, DEFAULT_COURSE_VIEW } from "./params";

/** Keeps the layout choice in `?view=` so a link to a ledger view stays a ledger view. */
export function CourseViewToggle({ value }: { value: CourseView }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const change = (next: string) => {
    if (next !== "cards" && next !== "ledger") return;

    const query = new URLSearchParams(window.location.search);
    if (next === DEFAULT_COURSE_VIEW) query.delete("view");
    else query.set("view", next);
    query.delete("page");

    const search = query.toString();
    startTransition(() => {
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
    });
  };

  return (
    <div aria-busy={isPending} className={isPending ? "opacity-60" : "opacity-100"}>
      <ViewToggle
        value={value}
        onChange={change}
        label="Course view"
        storageKey="lagan.courses.view"
      />
    </div>
  );
}
