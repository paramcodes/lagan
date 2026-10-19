"use client";

import type { CSSProperties, ReactNode } from "react";
import { useId, useState } from "react";
import type { AccessibleTableColumn, ChartBaseProps } from "./types";
import { DEFAULT_CHART_TOKENS } from "./types";

const SR_ONLY_STYLE: CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  borderWidth: 0,
};

export interface AccessibleChartContainerProps<T> extends ChartBaseProps {
  children: ReactNode;
  data: T[];
  columns: AccessibleTableColumn<T>[];
  hasData?: boolean | undefined;
  rowKey?: ((item: T, index: number) => string) | undefined;
}

function getRowIdentifier<T>(item: T, index: number): string {
  if (typeof item === "object" && item !== null) {
    if ("id" in item && typeof item.id === "string") return item.id;
    if ("lessonId" in item && typeof item.lessonId === "string") return item.lessonId;
    if ("lessonTitle" in item && typeof item.lessonTitle === "string") return item.lessonTitle;
    if ("label" in item && typeof item.label === "string") return item.label;
  }
  return `row-${index}`;
}

export function AccessibleChartContainer<T>({
  title,
  description,
  summary,
  tableCaption,
  height = 240,
  className,
  style,
  themeTokens,
  emptyMessage = "No data available",
  showTableToggle = false,
  children,
  data,
  columns,
  hasData = data.length > 0,
  rowKey,
}: AccessibleChartContainerProps<T>) {
  const [showVisibleTable, setShowVisibleTable] = useState(false);
  const id = useId();
  const titleId = `${id}-title`;
  const summaryId = `${id}-summary`;
  const tableId = `${id}-table`;

  const containerStyle: CSSProperties = {
    ...DEFAULT_CHART_TOKENS,
    ...themeTokens,
    ...style,
    position: "relative",
    width: "100%",
  };

  const captionText = tableCaption || (title ? `${title} data table` : "Chart data table");

  return (
    <section
      aria-label={title || "Chart"}
      aria-describedby={summary ? summaryId : undefined}
      className={["flex flex-col gap-2 w-full", className].filter(Boolean).join(" ")}
      style={containerStyle}
    >
      {title && (
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 id={titleId} className="text-sm font-medium text-[var(--color-ink)]">
              {title}
            </h3>
            {description && (
              <p className="text-xs text-[var(--color-muted,var(--color-edge))]">{description}</p>
            )}
          </div>
          {showTableToggle && (
            <button
              type="button"
              onClick={() => setShowVisibleTable((prev) => !prev)}
              aria-expanded={showVisibleTable}
              aria-controls={tableId}
              className="inline-flex items-center rounded-[var(--radius-control)] border border-[var(--color-line)] bg-[var(--color-surface)] px-2.5 py-1 text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            >
              {showVisibleTable ? "Hide data table" : "View data table"}
            </button>
          )}
        </div>
      )}

      {summary && (
        <p id={summaryId} className="sr-only" style={SR_ONLY_STYLE}>
          {summary}
        </p>
      )}

      <div
        className="w-full relative"
        style={{
          height: typeof height === "number" ? `${height}px` : height,
          minHeight: typeof height === "number" ? `${height}px` : height,
        }}
      >
        {hasData ? (
          children
        ) : (
          <div
            role="status"
            className="flex h-full w-full items-center justify-center rounded-[var(--radius-control)] border border-dashed border-[var(--color-line)] bg-[var(--color-surface)] p-6 text-center text-sm text-[var(--color-muted,var(--color-edge))]"
          >
            {emptyMessage}
          </div>
        )}
      </div>

      <div
        id={tableId}
        className={showVisibleTable ? "mt-3 overflow-x-auto" : "sr-only"}
        style={showVisibleTable ? undefined : SR_ONLY_STYLE}
      >
        <table className="w-full border-collapse text-left text-xs text-[var(--color-ink)]">
          <caption className={showVisibleTable ? "text-left font-medium mb-1" : "sr-only"}>
            {captionText}
          </caption>
          <thead>
            <tr className="border-b border-[var(--color-line)] bg-[var(--color-canvas)]">
              {columns.map((col) => (
                <th
                  key={col.header}
                  scope="col"
                  className={`px-3 py-2 font-semibold text-[var(--color-ink)] ${
                    col.align === "right"
                      ? "text-right"
                      : col.align === "center"
                        ? "text-center"
                        : "text-left"
                  }`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-4 text-center text-[var(--color-muted,var(--color-edge))]"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item, rowIdx) => {
                const key = rowKey ? rowKey(item, rowIdx) : getRowIdentifier(item, rowIdx);
                return (
                  <tr
                    key={key}
                    className="border-b border-[var(--color-line)] hover:bg-[var(--color-canvas)] transition-colors"
                  >
                    {columns.map((col) => (
                      <td
                        key={col.header}
                        className={`px-3 py-2 ${
                          col.align === "right"
                            ? "text-right"
                            : col.align === "center"
                              ? "text-center"
                              : "text-left"
                        }`}
                      >
                        {col.accessor(item, rowIdx)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
