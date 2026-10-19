import Link from "next/link";

export default function AuthorNotFound() {
  return (
    <main className="mx-auto max-w-2xl p-6 py-16 text-center">
      <div className="rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] p-8">
        <h1 className="text-xl font-semibold text-[var(--color-ink)]">Author not found</h1>
        <p className="mt-2 text-sm text-[var(--color-edge)]">
          The instructor profile you are looking for does not exist or may have been removed.
        </p>
        <div className="mt-6">
          <Link
            href="/courses"
            className="inline-flex items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-brand)] px-4 py-2 text-xs font-medium text-[var(--color-surface)] hover:opacity-90 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]"
          >
            Browse courses
          </Link>
        </div>
      </div>
    </main>
  );
}
