import {
  type ComponentType,
  type HTMLAttributes,
  type ReactNode,
  isValidElement,
  useId,
} from "react";

export type EmptyStateVariant = "default" | "dashed" | "plain";
export type EmptyStateHeadingLevel = "h2" | "h3" | "h4" | "h5" | "h6" | "p";

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  /** Optional icon to render above the title. Accepts a ReactNode or an icon component. */
  icon?:
    | ReactNode
    | ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  /** Primary title stating what happened or the current empty state. */
  title: ReactNode;
  /** Secondary text providing context, explanation, or next steps. */
  description?: ReactNode;
  /** Optional action slot for call-to-action buttons or links. */
  action?: ReactNode;
  /** Semantic HTML heading tag for the title. Defaults to "h3". */
  headingLevel?: EmptyStateHeadingLevel;
  /** Container visual style variant. Defaults to "default". */
  variant?: EmptyStateVariant;
  /** Additional children rendered below the action slot. */
  children?: ReactNode;
}

const BASE_CONTAINER_CLASSES =
  "flex flex-col items-center justify-center px-6 py-12 text-center rounded-[var(--radius-panel)] transition-colors";

const VARIANT_CONTAINER_CLASSES: Record<EmptyStateVariant, string> = {
  default: "border border-[var(--color-line)] bg-[var(--color-surface)]",
  dashed: "border border-dashed border-[var(--color-line)] bg-[var(--color-surface)]",
  plain: "bg-transparent",
};

/**
 * EmptyState primitive for empty lists, search misses, zero-states, and dead-ends.
 * Uses accessible semantics (role="status", aria-labelledby, aria-describedby)
 * and DTCG token styling (`var(--radius-panel)`, `var(--color-*)`).
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  headingLevel: Heading = "h3",
  variant = "default",
  role,
  className,
  children,
  ...props
}: EmptyStateProps) {
  const generatedId = useId();
  const titleId = `${generatedId}-title`;
  const descriptionId = `${generatedId}-description`;

  const containerClasses = [BASE_CONTAINER_CLASSES, VARIANT_CONTAINER_CLASSES[variant], className]
    .filter(Boolean)
    .join(" ");

  let renderedIcon: ReactNode = null;
  if (isValidElement(icon)) {
    renderedIcon = icon;
  } else if (typeof icon === "function") {
    const IconComponent = icon as ComponentType<{
      className?: string;
      "aria-hidden"?: boolean | "true" | "false";
    }>;
    renderedIcon = <IconComponent className="h-8 w-8" aria-hidden="true" />;
  }

  return (
    <section
      role={role}
      aria-labelledby={role === "status" ? undefined : titleId}
      aria-describedby={description ? descriptionId : undefined}
      className={containerClasses}
      {...props}
    >
      {renderedIcon && (
        <div
          data-empty-state-icon=""
          aria-hidden="true"
          className="mb-3 flex items-center justify-center text-[var(--color-edge)]"
        >
          {renderedIcon}
        </div>
      )}

      <Heading id={titleId} className="text-base font-semibold text-[var(--color-ink)]">
        {title}
      </Heading>

      {description && (
        <p id={descriptionId} className="mt-1 max-w-md text-sm text-[var(--color-edge)]">
          {description}
        </p>
      )}

      {action && (
        <div
          data-empty-state-action=""
          className="mt-5 flex flex-wrap items-center justify-center gap-3"
        >
          {action}
        </div>
      )}

      {children}
    </section>
  );
}
