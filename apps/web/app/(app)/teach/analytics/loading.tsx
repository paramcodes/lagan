export default function AnalyticsLoading() {
  return (
    <main className="mx-auto max-w-6xl p-6" aria-busy="true">
      <p role="status" className="sr-only">
        Loading analytics dashboard
      </p>

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="animate-pulse">
          <div className="h-3 w-20 rounded-[var(--radius-chip)] bg-[var(--color-line)]" />
          <div className="mt-2 h-7 w-48 rounded-[var(--radius-chip)] bg-[var(--color-line)]" />
          <div className="mt-2 h-4 w-64 rounded-[var(--radius-chip)] bg-[var(--color-line)]" />
        </div>
        <div className="flex items-center gap-3 animate-pulse">
          <div className="h-9 w-36 rounded-[var(--radius-control)] bg-[var(--color-line)]" />
          <div className="h-9 w-60 rounded-[var(--radius-control)] bg-[var(--color-line)]" />
        </div>
      </header>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex animate-pulse flex-col gap-2 rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5"
          >
            <div className="h-3 w-24 rounded-[var(--radius-chip)] bg-[var(--color-line)]" />
            <div className="h-8 w-20 rounded-[var(--radius-chip)] bg-[var(--color-line)]" />
            <div className="h-3 w-32 rounded-[var(--radius-chip)] bg-[var(--color-line)]" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="flex animate-pulse flex-col gap-4 rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5"
          >
            <div className="h-4 w-36 rounded-[var(--radius-chip)] bg-[var(--color-line)]" />
            <div className="h-56 w-full rounded-[var(--radius-control)] bg-[var(--color-line)]" />
          </div>
        ))}
      </div>
    </main>
  );
}
