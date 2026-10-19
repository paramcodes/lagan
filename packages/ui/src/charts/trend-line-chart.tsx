"use client";

import { useId } from "react";
import { AccessibleChartContainer } from "./accessible-chart";
import type { AccessibleTableColumn, TrendLineChartProps, TrendPoint } from "./types";

const DEFAULT_LINE_COLOR = "var(--color-accent, #4F46E5)";
const DEFAULT_GRID_COLOR = "var(--color-line, #E0E1DE)";
const DEFAULT_TEXT_COLOR = "var(--color-muted, var(--color-edge, #7C7E77))";

export function TrendLineChart({
  data,
  title,
  description,
  summary,
  tableCaption,
  height = 240,
  className,
  style,
  themeTokens,
  emptyMessage = "No trend data available",
  showTableToggle,
  lineColor = DEFAULT_LINE_COLOR,
  fillColor = DEFAULT_LINE_COLOR,
  gridColor = DEFAULT_GRID_COLOR,
  textColor = DEFAULT_TEXT_COLOR,
  valueFormatter = (val) => val.toLocaleString(),
  showDots = true,
  showArea = true,
  showGrid = true,
  strokeWidth = 2,
}: TrendLineChartProps) {
  const chartId = useId();
  const gradientId = `${chartId}-area-gradient`;

  const hasData = data && data.length > 0;

  const values = hasData ? data.map((d) => d.value) : [];
  let minVal = hasData ? Math.min(...values) : 0;
  let maxVal = hasData ? Math.max(...values) : 0;

  if (minVal === maxVal) {
    minVal = minVal > 0 ? 0 : minVal - 1;
    maxVal = maxVal === 0 ? 1 : maxVal;
  }
  const valRange = maxVal - minVal || 1;

  const svgWidth = 600;
  const svgHeight = 240;
  const padding = { top: 20, right: 30, bottom: 40, left: 50 };
  const chartWidth = svgWidth - padding.left - padding.right;
  const chartHeight = svgHeight - padding.top - padding.bottom;

  const points = hasData
    ? data.map((pt, idx) => {
        const x =
          padding.left +
          (data.length > 1 ? (idx / (data.length - 1)) * chartWidth : chartWidth / 2);
        const y = padding.top + chartHeight - ((pt.value - minVal) / valRange) * chartHeight;
        return { ...pt, x, y };
      })
    : [];

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  let linePath = "";
  let areaPath = "";

  if (points.length > 1 && firstPoint && lastPoint) {
    const middle = points
      .slice(1)
      .map((p) => `L ${p.x} ${p.y}`)
      .join(" ");
    linePath = `M ${firstPoint.x} ${firstPoint.y} ${middle}`;
    areaPath = `M ${firstPoint.x} ${padding.top + chartHeight} L ${firstPoint.x} ${firstPoint.y} ${middle} L ${lastPoint.x} ${padding.top + chartHeight} Z`;
  } else if (points.length === 1 && firstPoint) {
    linePath = `M ${padding.left} ${firstPoint.y} L ${padding.left + chartWidth} ${firstPoint.y}`;
  }

  const gridSteps = 4;
  const yTicks = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const ratio = i / gridSteps;
    const value = minVal + ratio * valRange;
    const y = padding.top + chartHeight - ratio * chartHeight;
    return { value, y };
  });

  const columns: AccessibleTableColumn<TrendPoint>[] = [
    {
      header: "Point / Date",
      accessor: (item) => item.label || item.date || "—",
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

  const lastDataPoint = data[data.length - 1];
  const generatedSummary =
    hasData && lastDataPoint
      ? `Trend chart with ${data.length} data points. Values range from ${valueFormatter(
          minVal,
        )} to ${valueFormatter(maxVal)}. Latest value is ${valueFormatter(
          lastDataPoint.value,
        )} at ${lastDataPoint.label}.`
      : emptyMessage;

  return (
    <AccessibleChartContainer
      title={title}
      description={description}
      summary={summary || generatedSummary}
      tableCaption={tableCaption}
      height={height}
      className={className}
      style={style}
      themeTokens={themeTokens}
      emptyMessage={emptyMessage}
      showTableToggle={showTableToggle}
      data={data}
      columns={columns}
      hasData={hasData}
    >
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={title || "Trend line chart"}
        className="overflow-visible"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fillColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={fillColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {showGrid &&
          yTicks.map((tick) => (
            <g key={`tick-${tick.value}-${tick.y}`}>
              <line
                x1={padding.left}
                y1={tick.y}
                x2={padding.left + chartWidth}
                y2={tick.y}
                stroke={gridColor}
                strokeDasharray="3 3"
                strokeWidth={1}
              />
              <text
                x={padding.left - 8}
                y={tick.y + 4}
                textAnchor="end"
                fontSize={11}
                fill={textColor}
                fontFamily="var(--font-sans)"
              >
                {valueFormatter(tick.value)}
              </text>
            </g>
          ))}

        {showArea && areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}

        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke={lineColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {showDots &&
          points.map((pt) => (
            <circle
              key={`dot-${pt.label}-${pt.value}`}
              cx={pt.x}
              cy={pt.y}
              r={3.5}
              fill="var(--color-surface, #FFFFFF)"
              stroke={lineColor}
              strokeWidth={2}
            >
              <title>{`${pt.label}: ${valueFormatter(pt.value)}`}</title>
            </circle>
          ))}

        {points.map((pt, idx) => {
          const step = Math.ceil(points.length / 7);
          const isKeyPoint = idx === 0 || idx === points.length - 1 || idx % step === 0;
          if (!isKeyPoint) return null;

          return (
            <text
              key={`label-${pt.label}-${pt.value}`}
              x={pt.x}
              y={padding.top + chartHeight + 20}
              textAnchor="middle"
              fontSize={11}
              fill={textColor}
              fontFamily="var(--font-sans)"
            >
              {pt.label}
            </text>
          );
        })}
      </svg>
    </AccessibleChartContainer>
  );
}
