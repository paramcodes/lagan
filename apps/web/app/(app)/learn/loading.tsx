export default function LearnLoading() {
  const cards = [0, 1, 2];

  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="h-3 w-16 animate-pulse rounded bg-[var(--color-line)]" />
          <div className="mt-2 h-7 w-40 animate-pulse rounded bg-[var(--color-line)]" />
          <div className="mt-2 h-4 w-28 animate-pulse rounded bg-[var(--color-line)]" />
        </div>
      </header>

      <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((key) => (
          <li key={key}>
            <div className="flex animate-pulse flex-col overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)]">
              <div className="h-32 w-full border-b border-[var(--color-line)] bg-[var(--color-canvas)]" />
              <div className="flex flex-col gap-2 p-5">
                <div className="h-5 w-3/4 rounded bg-[var(--color-line)]" />
                <div className="h-3 w-1/3 rounded bg-[var(--color-line)]" />
                <div className="mt-4 h-2 w-full rounded-full bg-[var(--color-line)]" />
                <div className="mt-4 h-9 w-full rounded-[var(--radius-control)] bg-[var(--color-line)]" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
