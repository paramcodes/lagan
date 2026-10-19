export default function CourseDetailLoading() {
  return (
    <main className="mx-auto max-w-6xl p-6 lg:p-8" aria-busy="true">
      <p role="status" className="sr-only">
        Loading course details
      </p>

      {/* Breadcrumb skeleton */}
      <div className="mb-6 flex animate-pulse items-center gap-2">
        <div className="h-3 w-12 rounded-[var(--radius-chip)] bg-[var(--color-line)]" />
        <div className="h-3 w-3 rounded-full bg-[var(--color-line)]" />
        <div className="h-3 w-32 rounded-[var(--radius-chip)] bg-[var(--color-line)]" />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Main column */}
        <div className="animate-pulse space-y-8">
          <div className="space-y-3">
            <div className="h-5 w-20 rounded-[var(--radius-chip)] bg-[var(--color-line)]" />
            <div className="h-9 w-3/4 rounded-[var(--radius-chip)] bg-[var(--color-line)]" />
            <div className="h-4 w-full rounded-[var(--radius-chip)] bg-[var(--color-line)]" />
            <div className="h-4 w-2/3 rounded-[var(--radius-chip)] bg-[var(--color-line)]" />
          </div>

          <div className="aspect-video w-full rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-line)]/50" />

          {/* Instructor skeleton */}
          <div className="flex items-center gap-4 rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
            <div className="h-14 w-14 shrink-0 rounded-full bg-[var(--color-line)]" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-16 rounded-[var(--radius-chip)] bg-[var(--color-line)]" />
              <div className="h-4 w-36 rounded-[var(--radius-chip)] bg-[var(--color-line)]" />
              <div className="h-3 w-48 rounded-[var(--radius-chip)] bg-[var(--color-line)]" />
            </div>
          </div>

          {/* Syllabus skeleton */}
          <div className="space-y-3">
            <div className="h-6 w-44 rounded-[var(--radius-chip)] bg-[var(--color-line)]" />
            <div className="h-14 w-full rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)]" />
            <div className="h-14 w-full rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)]" />
          </div>
        </div>

        {/* Sidebar skeleton */}
        <aside className="h-fit lg:sticky lg:top-8">
          <div className="animate-pulse space-y-6 rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6">
            <div className="space-y-2 border-b border-[var(--color-line)] pb-5">
              <div className="h-3 w-12 rounded-[var(--radius-chip)] bg-[var(--color-line)]" />
              <div className="h-8 w-24 rounded-[var(--radius-chip)] bg-[var(--color-line)]" />
            </div>
            <div className="h-12 w-full rounded-[var(--radius-control)] bg-[var(--color-line)]" />
            <div className="space-y-2 border-t border-[var(--color-line)] pt-5">
              <div className="h-3 w-full rounded-[var(--radius-chip)] bg-[var(--color-line)]" />
              <div className="h-3 w-3/4 rounded-[var(--radius-chip)] bg-[var(--color-line)]" />
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
