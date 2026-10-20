"use client";

import { AlertCircle, Home } from "lucide-react";
import Link from "next/link";

interface AppErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AppError({ error, reset }: AppErrorProps) {
  const rawMessage = error?.message?.trim() ?? "";
  const isFrameworkPlaceholder = rawMessage.startsWith("Minified React error");
  const message = isFrameworkPlaceholder ? "" : rawMessage;

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center justify-center p-6">
      <div
        role="alert"
        aria-live="assertive"
        className="flex w-full flex-col items-center rounded-[var(--radius-panel)] border border-[var(--color-alert)]/30 bg-[var(--color-surface)] p-6 text-center shadow-xs sm:p-10"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-alert)]/10 text-[var(--color-alert)]">
          <AlertCircle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-[var(--color-ink)]">
          This page couldn’t load
        </h1>
        <p className="mt-1 max-w-md text-sm text-[var(--color-edge)]">
          {message ||
            "Something went wrong while loading this part of Lagan. Retry, or head back to the home page."}
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-xs text-[var(--color-edge)]">
            Reference: {error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-[var(--radius-control)] bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-[var(--color-surface)] transition-opacity hover:opacity-90"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-line)] px-4 py-2 text-sm font-medium text-[var(--color-ink2)] transition-colors hover:bg-[var(--color-canvas)]"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
