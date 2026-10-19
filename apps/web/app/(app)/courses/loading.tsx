const SKELETON_KEYS = [
  "skeleton-0",
  "skeleton-1",
  "skeleton-2",
  "skeleton-3",
  "skeleton-4",
  "skeleton-5",
];

export default function CoursesLoading() {
  return (
    <main className="mx-auto max-w-5xl p-6" aria-busy="true">
      <p role="status" className="sr-only">
        Loading courses
      </p>

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="animate-pulse">
          <div className="h-3 w-16 rounded-[var(--radius-chip)] bg-[var(--color-line)]" />
          <div className="mt-2 h-7 w-32 rounded-[var(--radius-chip)] bg-[var(--color-line)]" />
          <div className="mt-2 h-4 w-40 rounded-[var(--radius-chip)] bg-[var(--color-line)]" />
        </div>
        <div className="h-9 w-32 animate-pulse rounded-[var(--radius-control)] bg-[var(--color-line)]" />
      </header>

      <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {SKELETON_KEYS.map((key) => (
          <li key={key}>
            <div className="flex animate-pulse flex-col overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)]">
              <div className="h-32 w-full border-b border-[var(--color-line)] bg-[var(--color-canvas)]" />
              <div className="flex flex-col gap-2 px-4 py-4">
                <div className="h-4 w-3/4 rounded-[var(--radius-chip)] bg-[var(--color-line)]" />
                <div className="h-3 w-1/3 rounded-[var(--radius-chip)] bg-[var(--color-line)]" />
                <div className="mt-3 h-4 w-16 rounded-[var(--radius-chip)] bg-[var(--color-line)]" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
