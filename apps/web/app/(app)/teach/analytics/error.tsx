"use client";

import { AlertCircle } from "lucide-react";

interface AnalyticsErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AnalyticsError({ error, reset }: AnalyticsErrorProps) {
  return (
    <main className="mx-auto max-w-4xl p-6">
      <div
        role="alert"
        aria-live="assertive"
        className="flex flex-col items-center justify-center rounded-[var(--radius-panel)] border border-[var(--color-alert)]/30 bg-[var(--color-surface)] p-10 text-center shadow-xs"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-alert)]/10 text-[var(--color-alert)]">
          <AlertCircle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-[var(--color-ink)]">
          Failed to load analytics
        </h1>
        <p className="mt-1 max-w-md text-sm text-[var(--color-edge)]">
          {error.message ||
            "An unexpected error occurred while loading your author analytics dashboard."}
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 rounded-[var(--radius-control)] bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
