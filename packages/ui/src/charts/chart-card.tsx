"use client";

import type { CSSProperties } from "react";
import type { ChartCardProps } from "./types";
import { DEFAULT_CHART_TOKENS } from "./types";

export function ChartCard({
  title,
  description,
  metric,
  metricLabel,
  children,
  className,
  style,
  headerAction,
  themeTokens,
}: ChartCardProps) {
  const cardStyle: CSSProperties = {
    ...DEFAULT_CHART_TOKENS,
    ...themeTokens,
    ...style,
  };

  return (
    <div
      style={cardStyle}
      className={[
        "flex flex-col gap-4 rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-xs transition-colors",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-ink)]">{title}</h2>
          {description && (
            <p className="mt-0.5 text-xs text-[var(--color-muted,var(--color-edge))]">
              {description}
            </p>
          )}
        </div>
        {headerAction && <div className="shrink-0">{headerAction}</div>}
      </div>

      {metric !== undefined && (
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight text-[var(--color-ink)]">
            {metric}
          </span>
          {metricLabel && (
            <span className="text-xs text-[var(--color-muted,var(--color-edge))]">
              {metricLabel}
            </span>
          )}
        </div>
      )}

      <div className="w-full min-w-0 flex-1">{children}</div>
    </div>
  );
}
