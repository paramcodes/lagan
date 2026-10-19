import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getViewPreference, setViewPreference, useViewPreference, ViewToggle } from "./view-toggle";

describe("ViewToggle", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("renders with default options and accessible group name", () => {
    const handleChange = vi.fn();
    render(<ViewToggle value="cards" onChange={handleChange} label="Result layout" />);

    const group = screen.getByRole("group", { name: "Result layout" });
    expect(group).toBeTruthy();

    const cardsButton = screen.getByRole("button", { name: "Cards" });
    const listButton = screen.getByRole("button", { name: "List" });

    expect(cardsButton.getAttribute("aria-pressed")).toBe("true");
    expect(listButton.getAttribute("aria-pressed")).toBe("false");
  });

  it("supports custom options such as grid and list", () => {
    const customOptions = [
      { value: "grid", label: "Grid" },
      { value: "list", label: "List" },
    ];
    const handleChange = vi.fn();
    render(<ViewToggle value="list" onChange={handleChange} options={customOptions} />);

    expect(screen.getByRole("button", { name: "Grid" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "List" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("calls onChange when an inactive button is clicked", () => {
    const handleChange = vi.fn();
    render(<ViewToggle value="cards" onChange={handleChange} />);

    fireEvent.click(screen.getByRole("button", { name: "List" }));
    expect(handleChange).toHaveBeenCalledWith("ledger");
  });

  it("navigates forward and backward with arrow keys", () => {
    const handleChange = vi.fn();
    render(<ViewToggle value="cards" onChange={handleChange} />);

    const fieldset = screen.getByRole("group");
    fireEvent.keyDown(fieldset, { key: "ArrowRight" });
    expect(handleChange).toHaveBeenCalledWith("ledger");

    handleChange.mockClear();
    fireEvent.keyDown(fieldset, { key: "ArrowLeft" });
    expect(handleChange).toHaveBeenCalledWith("ledger");
  });

  it("navigates to first and last item with Home and End keys", () => {
    const options = [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
      { value: "c", label: "C" },
    ];
    const handleChange = vi.fn();
    render(<ViewToggle value="b" onChange={handleChange} options={options} />);

    const fieldset = screen.getByRole("group");
    fireEvent.keyDown(fieldset, { key: "Home" });
    expect(handleChange).toHaveBeenCalledWith("a");

    handleChange.mockClear();
    fireEvent.keyDown(fieldset, { key: "End" });
    expect(handleChange).toHaveBeenCalledWith("c");
  });

  it("persists chosen view to localStorage when storageKey is provided", () => {
    const handleChange = vi.fn();
    render(<ViewToggle value="cards" onChange={handleChange} storageKey="test.view.key" />);

    fireEvent.click(screen.getByRole("button", { name: "List" }));
    expect(window.localStorage.getItem("test.view.key")).toBe("ledger");
  });

  it("loads initial view from localStorage on mount if present", () => {
    window.localStorage.setItem("test.view.key", "ledger");
    const handleChange = vi.fn();

    render(<ViewToggle value="cards" onChange={handleChange} storageKey="test.view.key" />);

    expect(handleChange).toHaveBeenCalledWith("ledger");
  });
});

describe("getViewPreference and setViewPreference", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("safely writes and reads from localStorage", () => {
    setViewPreference("pref.key", "cards");
    expect(getViewPreference("pref.key")).toBe("cards");
  });

  it("handles storage exceptions gracefully", () => {
    const getSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });
    const setSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });

    expect(() => setViewPreference("fail.key", "val")).not.toThrow();
    expect(getViewPreference("fail.key")).toBeNull();

    getSpy.mockRestore();
    setSpy.mockRestore();
  });
});

describe("useViewPreference", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("initializes with defaultValue when storage is empty", () => {
    const { result } = renderHook(() => useViewPreference("hook.key", "cards"));
    expect(result.current[0]).toBe("cards");
  });

  it("updates state and localStorage on change", () => {
    const { result } = renderHook(() => useViewPreference("hook.key", "cards"));

    act(() => {
      result.current[1]("ledger");
    });

    expect(result.current[0]).toBe("ledger");
    expect(window.localStorage.getItem("hook.key")).toBe("ledger");
  });
});
