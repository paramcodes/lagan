"use client";

import { AccessibleChartContainer } from "./accessible-chart";
import type { AccessibleTableColumn, BarChartProps, BarPoint } from "./types";

const DEFAULT_BAR_COLOR = "var(--color-accent, #4F46E5)";
const DEFAULT_GRID_COLOR = "var(--color-line, #E0E1DE)";
const DEFAULT_TEXT_COLOR = "var(--color-muted, var(--color-edge, #7C7E77))";

export function BarChart({
  data,
  title,
  description,
  summary,
  tableCaption,
  height = 240,
  className,
  style,
  themeTokens,
  emptyMessage = "No bar data available",
  showTableToggle,
  orientation = "vertical",
  barColor = DEFAULT_BAR_COLOR,
  gridColor = DEFAULT_GRID_COLOR,
  textColor = DEFAULT_TEXT_COLOR,
  valueFormatter = (val) => val.toLocaleString(),
  showGrid = true,
}: BarChartProps) {
  const hasData = data && data.length > 0;

  const values = hasData ? data.map((d) => d.value) : [];
  let maxVal = hasData ? Math.max(...values, 0) : 0;
  if (maxVal === 0) maxVal = 1;

  const svgWidth = 600;
  const isHorizontal = orientation === "horizontal";
  const defaultHeight = isHorizontal
    ? Math.max(180, data.length * 40 + 30)
    : 240;
  const computedHeight = height ?? defaultHeight;

  const highestItem = hasData
    ? [...data].sort((a, b) => b.value - a.value)[0]
    : null;

  const total = hasData ? values.reduce((sum, v) => sum + v, 0) : 0;

  const generatedSummary = hasData && highestItem
    ? `Bar chart with ${data.length} categories. Total: ${valueFormatter(
        total
      )}. Highest is ${highestItem.label} with ${valueFormatter(highestItem.value)}.`
    : emptyMessage;

  const columns: AccessibleTableColumn<BarPoint>[] = [
    {
      header: "Category",
      accessor: (item) => item.label,
    },
    {
      header: "Value",
      accessor: (item) => valueFormatter(item.value),
      align: "right",
    },
  ];

  if (data.some((d) => d.secondaryValue !== undefined)) {
    columns.push({
      header: "Secondary Value",
      accessor: (item) =>
        item.secondaryValue !== undefined ? valueFormatter(item.secondaryValue) : "—",
      align: "right",
    });
  }

  return (
    <AccessibleChartContainer
      title={title}
      description={description}
      summary={summary || generatedSummary}
      tableCaption={tableCaption}
      height={computedHeight}
      className={className}
      style={style}
      themeTokens={themeTokens}
      emptyMessage={emptyMessage}
      showTableToggle={showTableToggle}
      data={data}
      columns={columns}
      hasData={hasData}
    >
      {isHorizontal ? (
        <svg
          viewBox={`0 0 ${svgWidth} ${defaultHeight}`}
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={title || "Bar chart"}
          className="overflow-visible"
        >
          {data.map((pt, idx) => {
            const rowY = 16 + idx * 40;
            const leftMargin = 120;
            const rightMargin = 60;
            const barMaxWidth = svgWidth - leftMargin - rightMargin;
            const ratio = pt.value / maxVal;
            const barW = Math.max(2, ratio * barMaxWidth);

            return (
              <g key={pt.label}>
                <text
                  x={leftMargin - 10}
                  y={rowY + 14}
                  textAnchor="end"
                  fontSize={11}
                  fontWeight={500}
                  fill="var(--color-ink, #0C0D0C)"
                  fontFamily="var(--font-sans)"
                >
                  {pt.label}
                </text>
                <rect
                  x={leftMargin}
                  y={rowY}
                  width={barW}
                  height={18}
                  rx={4}
                  fill={pt.color || barColor}
                >
                  <title>{`${pt.label}: ${valueFormatter(pt.value)}`}</title>
                </rect>
                <text
                  x={leftMargin + barW + 8}
                  y={rowY + 14}
                  fontSize={11}
                  fill={textColor}
                  fontFamily="var(--font-sans)"
                >
                  {valueFormatter(pt.value)}
                </text>
              </g>
            );
          })}
        </svg>
      ) : (
        <svg
          viewBox={`0 0 ${svgWidth} 240`}
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={title || "Bar chart"}
          className="overflow-visible"
        >
          {(() => {
            const padLeft = 45;
            const padRight = 20;
            const padBottom = 35;
            const padTop = 20;
            const plotW = svgWidth - padLeft - padRight;
            const plotH = 240 - padTop - padBottom;
            const colWidth = plotW / data.length;
            const barW = Math.min(36, colWidth * 0.65);

            const gridSteps = 4;
            const yTicks = Array.from({ length: gridSteps + 1 }, (_, i) => {
              const ratio = i / gridSteps;
              const value = ratio * maxVal;
              const y = padTop + plotH - ratio * plotH;
              return { value, y };
            });

            return (
              <>
                {showGrid &&
                  yTicks.map((tick) => (
                    <g key={`tick-${tick.value}-${tick.y}`}>
                      <line
                        x1={padLeft}
                        y1={tick.y}
                        x2={padLeft + plotW}
                        y2={tick.y}
                        stroke={gridColor}
                        strokeDasharray="3 3"
                        strokeWidth={1}
                      />
                      <text
                        x={padLeft - 8}
                        y={tick.y + 4}
                        textAnchor="end"
                        fontSize={10}
                        fill={textColor}
                        fontFamily="var(--font-sans)"
                      >
                        {valueFormatter(tick.value)}
                      </text>
                    </g>
                  ))}

                {data.map((pt, idx) => {
                  const x = padLeft + idx * colWidth + (colWidth - barW) / 2;
                  const ratio = pt.value / maxVal;
                  const barH = ratio * plotH;
                  const y = padTop + plotH - barH;

                  return (
                    <g key={pt.label}>
                      <rect
                        x={x}
                        y={y}
                        width={barW}
                        height={barH}
                        rx={3}
                        fill={pt.color || barColor}
                      >
                        <title>{`${pt.label}: ${valueFormatter(pt.value)}`}</title>
                      </rect>
                      <text
                        x={x + barW / 2}
                        y={padTop + plotH + 18}
                        textAnchor="middle"
                        fontSize={10}
                        fill={textColor}
                        fontFamily="var(--font-sans)"
                      >
                        {pt.label}
                      </text>
                    </g>
                  );
                })}
              </>
            );
          })()}
        </svg>
      )}
    </AccessibleChartContainer>
  );
}
