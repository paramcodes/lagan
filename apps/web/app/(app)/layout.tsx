import { Suspense, type ReactNode } from "react";
import { AppShell } from "./shell";

const SIDEBAR_SKELETON_ROWS = [0, 1, 2, 3, 4];
const CONTENT_SKELETON_CARDS = [0, 1, 2];

function AppShellSkeleton() {
  return (
    <div
      aria-busy="true"
      className="flex h-screen w-full overflow-hidden bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100"
    >
      <p role="status" className="sr-only">
        Loading Lagan
      </p>

      <div className="flex w-[260px] shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-2 px-3 py-3">
          <div className="h-4 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-8 w-8 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
        </div>
        <div className="flex flex-1 flex-col gap-1 px-2 py-2">
          {SIDEBAR_SKELETON_ROWS.map((row) => (
            <div
              key={`sidebar-skeleton-${row}`}
              className="h-9 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-900"
            />
          ))}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="h-10 max-w-xl flex-1 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-900" />
          <div className="h-10 w-32 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-900" />
          <div className="ml-auto h-10 w-10 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-900" />
        </header>

        <div className="flex-1 overflow-auto p-6">
          <div className="grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {CONTENT_SKELETON_CARDS.map((card) => (
              <div
                key={`content-skeleton-${card}`}
                className="flex animate-pulse flex-col overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)]"
              >
                <div className="h-32 w-full border-b border-[var(--color-line)] bg-[var(--color-canvas)]" />
                <div className="flex flex-col gap-2 px-4 py-4">
                  <div className="h-4 w-3/4 rounded-[var(--radius-chip)] bg-[var(--color-line)]" />
                  <div className="h-3 w-1/3 rounded-[var(--radius-chip)] bg-[var(--color-line)]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AppShellSkeleton />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
