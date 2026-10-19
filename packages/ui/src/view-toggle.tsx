"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ViewOption {
  value: string;
  label: string;
}

export interface ViewToggleProps {
  value: string;
  onChange: (value: string) => void;
  options?: readonly ViewOption[];
  /** Accessible name for the group. */
  label?: string;
  className?: string;
  /** Optional localStorage key to persist view preference. */
  storageKey?: string;
}

export const DEFAULT_VIEW_OPTIONS: readonly ViewOption[] = [
  { value: "cards", label: "Cards" },
  { value: "ledger", label: "List" },
];

/** Read view preference from localStorage safely. */
export function getViewPreference(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Write view preference to localStorage safely. */
export function setViewPreference(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Non-blocking fallback for quota or security exceptions
  }
}

/** Hook for managing view state synchronized with localStorage. */
export function useViewPreference(
  storageKey: string,
  defaultValue: string = "cards",
): [string, (value: string) => void] {
  const [view, setView] = useState<string>(() => {
    return getViewPreference(storageKey) ?? defaultValue;
  });

  const updateView = useCallback(
    (next: string) => {
      setView(next);
      setViewPreference(storageKey, next);
    },
    [storageKey],
  );

  return [view, updateView];
}

/**
 * Segmented control for switching between result layouts (e.g. cards/grid and list).
 * Accessible, keyboard operable, token-styled, and optionally persistent in localStorage.
 */
export function ViewToggle({
  value,
  onChange,
  options = DEFAULT_VIEW_OPTIONS,
  label = "View",
  className,
  storageKey,
}: ViewToggleProps) {
  const fieldsetRef = useRef<HTMLFieldSetElement>(null);
  const initializedRef = useRef(false);

  // Optional localStorage synchronization on mount
  useEffect(() => {
    if (!storageKey || initializedRef.current) return;
    initializedRef.current = true;
    const saved = getViewPreference(storageKey);
    if (saved && saved !== value && options.some((opt) => opt.value === saved)) {
      onChange(saved);
    }
  }, [storageKey, options, onChange, value]);

  const selectOption = (nextValue: string) => {
    onChange(nextValue);
    if (storageKey) {
      setViewPreference(storageKey, nextValue);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLFieldSetElement>) => {
    if (options.length === 0) return;
    const currentIndex = options.findIndex((opt) => opt.value === value);
    let nextIndex = -1;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      nextIndex = currentIndex >= 0 ? (currentIndex + 1) % options.length : 0;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      nextIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1;
    } else if (event.key === "Home") {
      event.preventDefault();
      nextIndex = 0;
    } else if (event.key === "End") {
      event.preventDefault();
      nextIndex = options.length - 1;
    }

    if (nextIndex >= 0 && nextIndex !== currentIndex) {
      const nextOption = options[nextIndex];
      if (nextOption) {
        selectOption(nextOption.value);
        const buttons = fieldsetRef.current?.querySelectorAll<HTMLButtonElement>("button");
        buttons?.[nextIndex]?.focus();
      }
    }
  };

  return (
    <fieldset
      ref={fieldsetRef}
      aria-label={label}
      onKeyDown={handleKeyDown}
      className={[
        "m-0 inline-flex shrink-0 gap-0.5 rounded-[var(--radius-control)] border border-[var(--color-line)] bg-[var(--color-surface)] p-0.5",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => selectOption(option.value)}
            className={[
              "rounded-[var(--radius-chip)] px-3 py-1.5 text-xs font-medium transition-colors",
              "outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]",
              active
                ? "bg-[var(--color-brand)] text-[var(--color-surface)]"
                : "text-[var(--color-ink2)] hover:text-[var(--color-ink)]",
            ].join(" ")}
          >
            {option.label}
          </button>
        );
      })}
    </fieldset>
  );
}
