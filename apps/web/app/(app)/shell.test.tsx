vi.mock("@mux/mux-player-react", () => ({ default: () => null }));

vi.mock("../../components/notification-center", () => ({
  NotificationCenter: () => <button type="button" aria-label="Notifications" />,
}));

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./shell";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/courses",
  useSearchParams: () => new URLSearchParams(),
}));

function stubViewport(initialWidth: number) {
  let width = initialWidth;
  const listeners = new Set<() => void>();

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => {
      const max = /max-width:\s*([\d.]+)px/.exec(query);
      const min = /min-width:\s*([\d.]+)px/.exec(query);
      const matches =
        (max === null || width <= Number(max[1])) && (min === null || width >= Number(min[1]));
      return {
        matches,
        media: query,
        onchange: null,
        addEventListener: (_type: string, listener: () => void) => {
          listeners.add(listener);
        },
        removeEventListener: (_type: string, listener: () => void) => {
          listeners.delete(listener);
        },
        dispatchEvent: () => false,
      } as unknown as MediaQueryList;
    },
  });

  return {
    resize(next: number) {
      width = next;
      for (const listener of listeners) listener();
    },
  };
}

function sidebarState(container: HTMLElement): string | null {
  return container.querySelector("[data-sidebar]")?.getAttribute("data-state") ?? null;
}

describe("AppShell responsive sidebar", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts collapsed on a narrow viewport", () => {
    stubViewport(390);
    const { container } = render(<AppShell>catalogue</AppShell>);

    expect(sidebarState(container)).toBe("collapsed");
  });

  it("starts expanded on a roomy viewport", () => {
    stubViewport(1280);
    const { container } = render(<AppShell>catalogue</AppShell>);

    expect(sidebarState(container)).toBe("expanded");
  });

  it("keeps the manual toggle working on a narrow viewport", () => {
    stubViewport(390);
    const { container } = render(<AppShell>catalogue</AppShell>);

    fireEvent.click(screen.getByRole("button", { name: "Toggle sidebar" }));

    expect(sidebarState(container)).toBe("expanded");
  });

  it("collapses again when the viewport shrinks past the breakpoint", () => {
    const viewport = stubViewport(1280);
    const { container } = render(<AppShell>catalogue</AppShell>);

    act(() => viewport.resize(390));

    expect(sidebarState(container)).toBe("collapsed");
  });

  it("keeps the category filter and the search field in the header", () => {
    stubViewport(390);
    render(<AppShell>catalogue</AppShell>);

    expect(
      screen.getByRole("searchbox", { name: "Search courses, lessons, people" }),
    ).toBeDefined();
    expect(screen.getByRole("combobox", { name: "Category filter" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Account" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Notifications" })).toBeDefined();
  });
});
