import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AppError from "./error";

describe("AppError", () => {
  it("shows the headline and the error message", () => {
    render(<AppError error={new Error('relation "courses" does not exist')} reset={vi.fn()} />);

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: /couldn.t load/i })).toBeTruthy();
    expect(screen.getByText(/does not exist/)).toBeTruthy();
  });

  it("shows the friendly copy instead of the framework placeholder", () => {
    render(
      <AppError
        error={
          new Error(
            "Minified React error #441; visit https://react.dev/errors/441 for the full message",
          )
        }
        reset={vi.fn()}
      />,
    );

    expect(screen.queryByText(/Minified React error/)).toBeNull();
    expect(screen.getByText(/Retry, or head back to the home page/)).toBeTruthy();
  });

  it("calls reset when the try again control is pressed", () => {
    const reset = vi.fn();
    render(<AppError error={new Error("boom")} reset={reset} />);

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("offers a way back to the landing page", () => {
    render(<AppError error={new Error("boom")} reset={vi.fn()} />);

    expect(screen.getByRole("link", { name: /back to home/i }).getAttribute("href")).toBe("/");
  });
});
