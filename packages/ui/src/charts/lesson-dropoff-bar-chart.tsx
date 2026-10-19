"use client";

import { AccessibleChartContainer } from "./accessible-chart";
import type {
  AccessibleTableColumn,
  LessonDropoffBarChartProps,
  LessonDropoffPoint,
} from "./types";

const DEFAULT_COMPLETION_COLOR = "var(--color-accent, #4F46E5)";
const DEFAULT_DROPOFF_COLOR = "var(--color-alert, #A62B22)";
const DEFAULT_TRACK_COLOR = "var(--color-line, #E0E1DE)";

interface ResolvedLessonPoint extends LessonDropoffPoint {
  started: number;
  completed: number;
  dropped: number;
  rate: number;
}

export function LessonDropoffBarChart({
  data,
  title,
  description,
  summary,
  tableCaption,
  height,
  className,
  style,
  themeTokens,
  emptyMessage = "No lesson drop-off data available",
  showTableToggle,
  orientation = "horizontal",
  completionColor = DEFAULT_COMPLETION_COLOR,
  dropoffColor = DEFAULT_DROPOFF_COLOR,
  trackColor = DEFAULT_TRACK_COLOR,
  valueFormatter = (val) => val.toLocaleString(),
  rateFormatter = (rate) => `${rate.toFixed(1)}%`,
}: LessonDropoffBarChartProps) {
  const hasData = data && data.length > 0;

  const resolvedPoints: ResolvedLessonPoint[] = hasData
    ? data.map((pt) => {
        const completed = pt.completedCount;
        const started =
          pt.startedCount !== undefined ? pt.startedCount : completed + (pt.droppedCount ?? 0);
        const dropped =
          pt.droppedCount !== undefined ? pt.droppedCount : Math.max(0, started - completed);

        let rate = 0;
        if (pt.dropoffRate !== undefined) {
          rate = pt.dropoffRate <= 1 && pt.dropoffRate > 0 ? pt.dropoffRate * 100 : pt.dropoffRate;
        } else if (started > 0) {
          rate = (dropped / started) * 100;
        }

        return {
          ...pt,
          started,
          completed,
          dropped,
          rate,
        };
      })
    : [];

  const maxStarted = hasData ? Math.max(...resolvedPoints.map((p) => p.started), 1) : 1;

  const highestDropLesson = hasData ? [...resolvedPoints].sort((a, b) => b.rate - a.rate)[0] : null;

  const generatedSummary =
    hasData && highestDropLesson
      ? `Per-lesson drop-off chart covering ${
          data.length
        } lessons. Highest drop-off is at ${highestDropLesson.lessonTitle} (${rateFormatter(
          highestDropLesson.rate,
        )} drop-off, ${valueFormatter(highestDropLesson.dropped)} dropped).`
      : emptyMessage;

  const columns: AccessibleTableColumn<ResolvedLessonPoint>[] = [
    {
      header: "Lesson",
      accessor: (item) => item.lessonTitle,
    },
    {
      header: "Started",
      accessor: (item) => valueFormatter(item.started),
      align: "right",
    },
    {
      header: "Completed",
      accessor: (item) => valueFormatter(item.completed),
      align: "right",
    },
    {
      header: "Drop-offs",
      accessor: (item) => valueFormatter(item.dropped),
      align: "right",
    },
    {
      header: "Drop-off Rate",
      accessor: (item) => rateFormatter(item.rate),
      align: "right",
    },
  ];

  const svgWidth = 600;
  const isHorizontal = orientation === "horizontal";
  const defaultHeight = isHorizontal ? Math.max(200, resolvedPoints.length * 44 + 30) : 240;
  const computedHeight = height ?? defaultHeight;

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
      data={resolvedPoints}
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
          aria-label={title || "Lesson drop-off chart"}
          className="overflow-visible"
        >
          {resolvedPoints.map((pt, idx) => {
            const rowY = 16 + idx * 44;
            const leftMargin = 160;
            const rightMargin = 95;
            const barMaxWidth = svgWidth - leftMargin - rightMargin;
            const startedRatio = pt.started / maxStarted;
            const completedRatio = pt.completed / maxStarted;
            const barTrackWidth = Math.max(2, startedRatio * barMaxWidth);
            const completedBarWidth = Math.max(0, completedRatio * barMaxWidth);

            return (
              <g key={pt.lessonId || pt.lessonTitle}>
                <text
                  x={leftMargin - 12}
                  y={rowY + 14}
                  textAnchor="end"
                  fontSize={11}
                  fontWeight={500}
                  fill="var(--color-ink, #0C0D0C)"
                  fontFamily="var(--font-sans)"
                >
                  <title>{pt.lessonTitle}</title>
                  {pt.lessonTitle.length > 20 ? `${pt.lessonTitle.slice(0, 18)}…` : pt.lessonTitle}
                </text>

                {/* Track for total started */}
                <rect
                  x={leftMargin}
                  y={rowY}
                  width={barTrackWidth}
                  height={18}
                  rx={4}
                  fill={trackColor}
                />

                {/* Completed portion */}
                {completedBarWidth > 0 && (
                  <rect
                    x={leftMargin}
                    y={rowY}
                    width={completedBarWidth}
                    height={18}
                    rx={4}
                    fill={completionColor}
                  >
                    <title>{`${pt.lessonTitle}: ${valueFormatter(pt.completed)} completed`}</title>
                  </rect>
                )}

                {/* Rate label */}
                <text
                  x={leftMargin + barTrackWidth + 10}
                  y={rowY + 13}
                  fontSize={11}
                  fontWeight={500}
                  fill={
                    pt.rate > 30 ? dropoffColor : "var(--color-muted, var(--color-edge, #7C7E77))"
                  }
                  fontFamily="var(--font-sans)"
                >
                  {rateFormatter(pt.rate)}
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
          aria-label={title || "Lesson drop-off chart"}
          className="overflow-visible"
        >
          {(() => {
            const padLeft = 45;
            const padRight = 20;
            const padBottom = 45;
            const padTop = 20;
            const plotW = svgWidth - padLeft - padRight;
            const plotH = 240 - padTop - padBottom;
            const colWidth = plotW / resolvedPoints.length;
            const barW = Math.min(32, colWidth * 0.6);

            return (
              <>
                <line
                  x1={padLeft}
                  y1={padTop + plotH}
                  x2={padLeft + plotW}
                  y2={padTop + plotH}
                  stroke={trackColor}
                  strokeWidth={1}
                />
                {resolvedPoints.map((pt, idx) => {
                  const x = padLeft + idx * colWidth + (colWidth - barW) / 2;
                  const ratio = pt.completed / maxStarted;
                  const barH = ratio * plotH;
                  const y = padTop + plotH - barH;

                  return (
                    <g key={pt.lessonId || pt.lessonTitle}>
                      <rect x={x} y={y} width={barW} height={barH} rx={3} fill={completionColor}>
                        <title>{`${pt.lessonTitle}: ${valueFormatter(
                          pt.completed,
                        )} completed (${rateFormatter(pt.rate)} drop)`}</title>
                      </rect>
                      <text
                        x={x + barW / 2}
                        y={padTop + plotH + 16}
                        textAnchor="middle"
                        fontSize={10}
                        fill="var(--color-muted, var(--color-edge, #7C7E77))"
                        fontFamily="var(--font-sans)"
                      >
                        {pt.order !== undefined
                          ? `L${pt.order}`
                          : pt.lessonTitle.length > 8
                            ? `${pt.lessonTitle.slice(0, 6)}…`
                            : pt.lessonTitle}
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
