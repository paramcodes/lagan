vi.mock("@mux/mux-player-react", () => ({ default: () => null }));

import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CourseViewToggle } from "./course-view-toggle";

const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
    push: vi.fn(),
  }),
  usePathname: () => "/courses",
}));

describe("CourseViewToggle", () => {
  it("renders with cards selected", () => {
    render(<CourseViewToggle value="cards" />);
    expect(screen.getByRole("button", { name: "Cards" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("navigates with ?view=ledger when clicking List", () => {
    render(<CourseViewToggle value="cards" />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "List" }));
    });
    expect(replaceMock).toHaveBeenCalledWith("/courses?view=ledger", { scroll: false });
  });

  it("omits default view from query string when switching back to cards", () => {
    render(<CourseViewToggle value="ledger" />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Cards" }));
    });
    expect(replaceMock).toHaveBeenCalledWith("/courses", { scroll: false });
  });
});
