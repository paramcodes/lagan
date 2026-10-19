import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge, type BadgeVariant } from "./badge";

describe("Badge", () => {
  it("renders text children correctly", () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("applies default variant and default size with DTCG tokens", () => {
    render(<Badge data-testid="badge">Default Badge</Badge>);
    const badge = screen.getByTestId("badge");

    expect(badge.className).toContain("rounded-[var(--radius-chip)]");
    expect(badge.className).toContain("border-[var(--color-line)]");
    expect(badge.className).toContain("bg-[var(--color-canvas)]");
    expect(badge.className).toContain("text-[var(--color-ink)]");
    expect(badge.className).toContain("text-xs");
  });

  const variants: { variant: BadgeVariant; expectedClass: string }[] = [
    { variant: "default", expectedClass: "text-[var(--color-ink)]" },
    { variant: "brand", expectedClass: "bg-[var(--color-brand)]" },
    { variant: "neutral", expectedClass: "text-[var(--color-edge)]" },
    { variant: "success", expectedClass: "text-[var(--color-success,#166534)]" },
    { variant: "alert", expectedClass: "text-[var(--color-alert)]" },
  ];

  for (const { variant, expectedClass } of variants) {
    it(`renders ${variant} variant with correct token classes`, () => {
      render(
        <Badge variant={variant} data-testid={`badge-${variant}`}>
          {variant}
        </Badge>,
      );
      const badge = screen.getByTestId(`badge-${variant}`);
      expect(badge.className).toContain(expectedClass);
      expect(badge.className).toContain("rounded-[var(--radius-chip)]");
    });
  }

  it("applies sm size classes", () => {
    render(
      <Badge size="sm" data-testid="badge-sm">
        Small
      </Badge>,
    );
    expect(screen.getByTestId("badge-sm").className).toContain("text-[10px]");
  });

  it("applies md size classes", () => {
    render(
      <Badge size="md" data-testid="badge-md">
        Medium
      </Badge>,
    );
    expect(screen.getByTestId("badge-md").className).toContain("text-xs");
  });

  it("applies lg size classes", () => {
    render(
      <Badge size="lg" data-testid="badge-lg">
        Large
      </Badge>,
    );
    expect(screen.getByTestId("badge-lg").className).toContain("px-2.5");
  });

  it("renders status dot with aria-hidden when dot is true", () => {
    const { container } = render(<Badge dot>With Dot</Badge>);
    const dot = container.querySelector("[data-badge-dot]");
    expect(dot).toBeInTheDocument();
    expect(dot?.getAttribute("aria-hidden")).toBe("true");
    expect(dot?.className).toContain("rounded-full");
  });

  it("does not render status dot when dot is false or omitted", () => {
    const { container } = render(<Badge>Without Dot</Badge>);
    expect(container.querySelector("[data-badge-dot]")).toBeNull();
  });

  it("renders smaller dot for sm size badge", () => {
    const { container } = render(
      <Badge dot size="sm">
        Small Dot
      </Badge>,
    );
    const dot = container.querySelector("[data-badge-dot]");
    expect(dot?.className).toContain("h-1 w-1");
  });

  it("renders standard dot for md size badge", () => {
    const { container } = render(
      <Badge dot size="md">
        Medium Dot
      </Badge>,
    );
    const dot = container.querySelector("[data-badge-dot]");
    expect(dot?.className).toContain("h-1.5 w-1.5");
  });

  it("renders custom icon slot with aria-hidden", () => {
    render(
      <Badge icon={<svg data-testid="custom-svg" />} data-testid="badge-with-icon">
        Icon Badge
      </Badge>,
    );

    const iconWrapper = screen.getByTestId("badge-with-icon").querySelector("[data-badge-icon]");
    expect(iconWrapper).toBeInTheDocument();
    expect(iconWrapper?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByTestId("custom-svg")).toBeInTheDocument();
  });

  it("merges custom className without dropping base token styles", () => {
    render(
      <Badge className="custom-class tracking-wider" data-testid="badge">
        Custom
      </Badge>,
    );
    const badge = screen.getByTestId("badge");
    expect(badge.className).toContain("custom-class");
    expect(badge.className).toContain("tracking-wider");
    expect(badge.className).toContain("rounded-[var(--radius-chip)]");
  });

  it("forwards arbitrary HTML span attributes", () => {
    render(
      <Badge
        id="badge-status-1"
        role="status"
        aria-label="System status online"
        data-custom="true"
        data-testid="badge"
      >
        Online
      </Badge>,
    );
    const badge = screen.getByTestId("badge");
    expect(badge.getAttribute("id")).toBe("badge-status-1");
    expect(badge.getAttribute("role")).toBe("status");
    expect(badge.getAttribute("aria-label")).toBe("System status online");
    expect(badge.getAttribute("data-custom")).toBe("true");
  });
});
