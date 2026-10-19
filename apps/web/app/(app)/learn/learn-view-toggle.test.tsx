import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LearnViewToggle } from "./learn-view-toggle";

const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
    push: vi.fn(),
  }),
  usePathname: () => "/learn",
}));

describe("LearnViewToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("renders with cards selected by default", () => {
    render(<LearnViewToggle value="cards" />);
    expect(screen.getByRole("button", { name: "Cards" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "List" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("navigates with ?view=ledger and saves to localStorage when clicking List", () => {
    render(<LearnViewToggle value="cards" />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "List" }));
    });

    expect(replaceMock).toHaveBeenCalledWith("/learn?view=ledger", { scroll: false });
    expect(window.localStorage.getItem("lagan.learn.view")).toBe("ledger");
  });

  it("omits default view from query string when switching back to cards", () => {
    render(<LearnViewToggle value="ledger" />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Cards" }));
    });

    expect(replaceMock).toHaveBeenCalledWith("/learn", { scroll: false });
    expect(window.localStorage.getItem("lagan.learn.view")).toBe("cards");
  });
});
