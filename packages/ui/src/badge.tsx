import type { HTMLAttributes, ReactNode } from "react";

export type BadgeVariant = "default" | "brand" | "success" | "alert" | "neutral";
export type BadgeSize = "sm" | "md" | "lg";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** The semantic style variant of the badge. Defaults to "default". */
  variant?: BadgeVariant;
  /** Size of the badge. Defaults to "md". */
  size?: BadgeSize;
  /** Whether to show a leading status dot indicator. */
  dot?: boolean;
  /** Optional icon to render before the badge text. */
  icon?: ReactNode;
  /** Content of the badge. */
  children?: ReactNode;
}

const BASE_CLASSES =
  "inline-flex items-center gap-1.5 font-medium leading-none whitespace-nowrap rounded-[var(--radius-chip)] transition-colors";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: "border border-[var(--color-line)] bg-[var(--color-canvas)] text-[var(--color-ink)]",
  brand: "border border-transparent bg-[var(--color-brand)] text-[var(--color-surface)]",
  neutral: "border border-[var(--color-line)] bg-[var(--color-canvas)] text-[var(--color-edge)]",
  success:
    "border border-[var(--color-line)] bg-[var(--color-canvas)] text-[var(--color-success,#166534)]",
  alert: "border border-[var(--color-line)] bg-[var(--color-canvas)] text-[var(--color-alert)]",
};

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: "px-1.5 py-0.5 text-[10px]",
  md: "px-2 py-0.5 text-xs",
  lg: "px-2.5 py-1 text-xs",
};

const DOT_SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: "h-1 w-1",
  md: "h-1.5 w-1.5",
  lg: "h-1.5 w-1.5",
};

/**
 * Badge primitive for status indicators, categories, and tags.
 * Styled using DTCG design tokens (`var(--color-*)`, `var(--radius-chip)`).
 */
export function Badge({
  variant = "default",
  size = "md",
  dot = false,
  icon,
  className,
  children,
  ...props
}: BadgeProps) {
  const classes = [BASE_CLASSES, VARIANT_CLASSES[variant], SIZE_CLASSES[size], className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} {...props}>
      {dot && (
        <span
          data-badge-dot=""
          aria-hidden="true"
          className={`shrink-0 rounded-full bg-current opacity-85 ${DOT_SIZE_CLASSES[size]}`}
        />
      )}
      {icon && (
        <span data-badge-icon="" aria-hidden="true" className="shrink-0 flex items-center">
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}
