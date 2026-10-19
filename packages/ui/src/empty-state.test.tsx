import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState, type EmptyStateVariant } from "./empty-state";

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(
      <EmptyState
        title="No courses found"
        description="Try adjusting your filters or search keywords."
      />,
    );

    expect(screen.getByText("No courses found")).toBeInTheDocument();
    expect(screen.getByText("Try adjusting your filters or search keywords.")).toBeInTheDocument();
  });

  it("applies accessible semantics: semantic section with aria-labelledby and aria-describedby", () => {
    render(
      <EmptyState
        data-testid="empty-state"
        title="Nothing waiting on you"
        description="All submissions have been reviewed."
      />,
    );

    const container = screen.getByTestId("empty-state");
    expect(container.tagName.toLowerCase()).toBe("section");

    const titleId = container.getAttribute("aria-labelledby");
    const descId = container.getAttribute("aria-describedby");

    expect(titleId).toBeTruthy();
    expect(descId).toBeTruthy();

    const titleElement = screen.getByText("Nothing waiting on you");
    const descElement = screen.getByText("All submissions have been reviewed.");

    expect(titleElement.getAttribute("id")).toBe(titleId);
    expect(descElement.getAttribute("id")).toBe(descId);
  });

  it("omits aria-describedby when description is not provided", () => {
    render(<EmptyState data-testid="empty-state" title="Zero courses" />);
    const container = screen.getByTestId("empty-state");
    expect(container.hasAttribute("aria-describedby")).toBe(false);
  });

  it("renders h2 heading level when headingLevel='h2'", () => {
    render(<EmptyState title="Heading 2" headingLevel="h2" />);
    expect(screen.getByRole("heading", { level: 2, name: "Heading 2" })).toBeInTheDocument();
  });

  it("renders h3 heading level by default", () => {
    render(<EmptyState title="Heading 3" />);
    expect(screen.getByRole("heading", { level: 3, name: "Heading 3" })).toBeInTheDocument();
  });

  it("renders paragraph element when headingLevel='p'", () => {
    render(<EmptyState title="Paragraph heading" headingLevel="p" />);
    const pElement = screen.getByText("Paragraph heading");
    expect(pElement.tagName.toLowerCase()).toBe("p");
  });

  it("renders icon passed as ReactNode with aria-hidden", () => {
    render(<EmptyState icon={<svg data-testid="icon-svg" />} title="With Icon" />);

    const iconWrapper = screen.getByTestId("icon-svg").parentElement;
    expect(iconWrapper?.getAttribute("aria-hidden")).toBe("true");
    expect(iconWrapper?.getAttribute("data-empty-state-icon")).toBe("");
  });

  it("renders icon passed as a component with aria-hidden", () => {
    const DummyIcon = ({ className }: { className?: string }) => (
      <span data-testid="component-icon" className={className}>
        Icon
      </span>
    );

    render(<EmptyState icon={DummyIcon} title="With Icon Component" />);

    const iconElement = screen.getByTestId("component-icon");
    expect(iconElement).toBeInTheDocument();
    expect(iconElement.parentElement?.getAttribute("aria-hidden")).toBe("true");
  });

  it("omits icon container when icon is not provided", () => {
    const { container } = render(<EmptyState title="No Icon" />);
    expect(container.querySelector("[data-empty-state-icon]")).toBeNull();
  });

  it("renders action slot with buttons or links", () => {
    render(
      <EmptyState
        title="No items"
        action={
          <button type="button" data-testid="action-btn">
            Create Item
          </button>
        }
      />,
    );

    expect(screen.getByTestId("action-btn")).toBeInTheDocument();
  });

  const variants: { variant: EmptyStateVariant; expectedClass: string }[] = [
    { variant: "default", expectedClass: "border-[var(--color-line)]" },
    { variant: "dashed", expectedClass: "border-dashed" },
    { variant: "plain", expectedClass: "bg-transparent" },
  ];

  for (const { variant, expectedClass } of variants) {
    it(`applies ${variant} container variant with token styles`, () => {
      render(
        <EmptyState
          variant={variant}
          data-testid={`empty-state-${variant}`}
          title={`${variant} empty state`}
        />,
      );
      const container = screen.getByTestId(`empty-state-${variant}`);
      expect(container.className).toContain(expectedClass);
      expect(container.className).toContain("rounded-[var(--radius-panel)]");
    });
  }

  it("merges custom className and renders extra children", () => {
    render(
      <EmptyState className="custom-empty-class" data-testid="empty-state" title="Custom State">
        <div data-testid="extra-child">Extra Content</div>
      </EmptyState>,
    );

    const container = screen.getByTestId("empty-state");
    expect(container.className).toContain("custom-empty-class");
    expect(screen.getByTestId("extra-child")).toBeInTheDocument();
  });

  it("allows custom role and forwards arbitrary HTML attributes", () => {
    render(
      <EmptyState
        role="region"
        aria-live="polite"
        data-custom-attr="hello"
        data-testid="empty-state"
        title="Custom Region"
      />,
    );

    const container = screen.getByTestId("empty-state");
    expect(container.getAttribute("role")).toBe("region");
    expect(container.getAttribute("aria-live")).toBe("polite");
    expect(container.getAttribute("data-custom-attr")).toBe("hello");
  });
});
