import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

describe("HomePage", () => {
  it("links the header to the landing sections in page", () => {
    render(<HomePage />);

    const nav = screen.getByRole("navigation", { name: "Main Navigation" });
    const hrefs = within(nav)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));

    expect(hrefs).toEqual(["#pillars-heading", "#curriculum-heading", "/courses"]);
  });

  it("anchors each landing section on a stable id", () => {
    render(<HomePage />);

    const pillars = screen.getByRole("region", { name: "Built for Rigorous Engineering" });
    const curriculum = screen.getByRole("region", {
      name: "No Toy Implementations. Real Systems Code.",
    });

    expect(pillars.id).toBe("pillars-heading");
    expect(curriculum.id).toBe("curriculum-heading");
  });

  it("reserves the sticky header height on the anchor targets", () => {
    render(<HomePage />);

    const pillars = document.querySelector("#pillars-heading");
    const curriculum = document.querySelector("#curriculum-heading");

    expect(pillars?.classList.contains("scroll-mt-16")).toBe(true);
    expect(curriculum?.classList.contains("scroll-mt-16")).toBe(true);
  });
});
