import type { CSSProperties, ReactNode } from "react";

export interface ChartBaseProps {
  title?: string | undefined;
  description?: string | undefined;
  summary?: string | undefined;
  tableCaption?: string | undefined;
  height?: number | string | undefined;
  className?: string | undefined;
  style?: CSSProperties | undefined;
  themeTokens?: Record<string, string> | undefined;
  emptyMessage?: string | undefined;
  showTableToggle?: boolean | undefined;
}

export interface TrendPoint {
  label: string;
  value: number;
  date?: string | undefined;
  secondaryValue?: number | undefined;
}

export interface TrendLineChartProps extends ChartBaseProps {
  data: TrendPoint[];
  lineColor?: string | undefined;
  fillColor?: string | undefined;
  gridColor?: string | undefined;
  textColor?: string | undefined;
  valueFormatter?: ((value: number) => string) | undefined;
  showDots?: boolean | undefined;
  showArea?: boolean | undefined;
  showGrid?: boolean | undefined;
  strokeWidth?: number | undefined;
}

export interface LessonDropoffPoint {
  lessonTitle: string;
  completedCount: number;
  startedCount?: number | undefined;
  droppedCount?: number | undefined;
  dropoffRate?: number | undefined;
  lessonId?: string | undefined;
  order?: number | undefined;
}

export interface LessonDropoffBarChartProps extends ChartBaseProps {
  data: LessonDropoffPoint[];
  orientation?: "horizontal" | "vertical" | undefined;
  completionColor?: string | undefined;
  dropoffColor?: string | undefined;
  trackColor?: string | undefined;
  valueFormatter?: ((value: number) => string) | undefined;
  rateFormatter?: ((rate: number) => string) | undefined;
}

export interface BarPoint {
  label: string;
  value: number;
  secondaryValue?: number | undefined;
  color?: string | undefined;
  description?: string | undefined;
}

export interface BarChartProps extends ChartBaseProps {
  data: BarPoint[];
  orientation?: "horizontal" | "vertical" | undefined;
  barColor?: string | undefined;
  gridColor?: string | undefined;
  textColor?: string | undefined;
  valueFormatter?: ((value: number) => string) | undefined;
  showGrid?: boolean | undefined;
}

export interface ChartCardProps {
  title: string;
  description?: string | undefined;
  metric?: string | number | undefined;
  metricLabel?: string | undefined;
  children: ReactNode;
  className?: string | undefined;
  style?: CSSProperties | undefined;
  headerAction?: ReactNode | undefined;
  themeTokens?: Record<string, string> | undefined;
}

export interface AccessibleTableColumn<T> {
  header: string;
  accessor: (item: T, index: number) => ReactNode;
  align?: "left" | "right" | "center" | undefined;
}

export const DEFAULT_CHART_TOKENS: Record<string, string> = {
  "--color-primary": "var(--color-brand, #111311)",
  "--color-accent": "var(--color-accent, #4F46E5)",
  "--color-muted": "var(--color-edge, #7C7E77)",
  "--color-line": "var(--color-line, #E0E1DE)",
  "--color-surface": "var(--color-surface, #FFFFFF)",
  "--color-canvas": "var(--color-canvas, #F4F4F2)",
  "--color-ink": "var(--color-ink, #0C0D0C)",
  "--color-ink2": "var(--color-ink2, #171817)",
  "--color-alert": "var(--color-alert, #A62B22)",
  "--color-due": "var(--color-due, #8A5200)",
  "--color-chalk": "var(--color-chalk, #F2E679)",
  "--radius-panel": "var(--radius-panel, 14px)",
  "--radius-control": "var(--radius-control, 10px)",
  "--radius-chip": "var(--radius-chip, 7px)",
  "--font-sans": "var(--font-sans, inherit)",
};
