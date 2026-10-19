"use client";

import { ViewToggle } from "@lagan/ui";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { DEFAULT_LEARN_VIEW, type LearnView } from "./params";

/**
 * Segmented control switching between cards grid and ledger list layouts.
 * Persists user layout selection in localStorage ("lagan.learn.view") and synchronizes ?view= query string.
 */
export function LearnViewToggle({ value }: { value: LearnView }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const change = (next: string) => {
    startTransition(() => {
      const search = new URLSearchParams(window.location.search);
      if (next === DEFAULT_LEARN_VIEW) {
        search.delete("view");
      } else {
        search.set("view", next);
      }
      const query = search.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  };

  return (
    <div aria-busy={isPending} className={isPending ? "opacity-60" : "opacity-100"}>
      <ViewToggle
        value={value}
        onChange={change}
        label="Learning view"
        storageKey="lagan.learn.view"
      />
    </div>
  );
}
