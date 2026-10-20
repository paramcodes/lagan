import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Sidebar } from "./sidebar";

function sidebarState(container: HTMLElement): string | null {
  return container.querySelector("[data-sidebar]")?.getAttribute("data-state") ?? null;
}

describe("Sidebar", () => {
  it("keeps every nav item named when collapsed to the icon rail", () => {
    render(<Sidebar collapsed />);

    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Courses" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Users" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });

  it("names nav items from their label when they carry no icon", () => {
    render(<Sidebar collapsed items={[{ label: "Reports" }]} />);

    expect(screen.getByRole("button", { name: "Reports" })).toBeInTheDocument();
  });

  it("uses the visible label as the accessible name when expanded", () => {
    render(<Sidebar collapsed={false} />);

    expect(screen.getByRole("link", { name: "Courses" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Courses" }).getAttribute("aria-label")).toBeNull();
  });

  it("starts collapsed when the shell passes defaultCollapsed", () => {
    const { container } = render(<Sidebar defaultCollapsed />);

    expect(sidebarState(container)).toBe("collapsed");
  });

  it("toggles between the rail and the full panel", () => {
    const { container } = render(<Sidebar defaultCollapsed />);

    fireEvent.click(screen.getByRole("button", { name: "Toggle sidebar" }));

    expect(sidebarState(container)).toBe("expanded");
  });
});
