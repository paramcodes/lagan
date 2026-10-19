import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  getStandardContrastRules,
  loadColorTokens,
  relativeLuminance,
  verifyContrastRules,
} from "./contrast";

describe("Contrast calculations (WCAG 2.2 AA)", () => {
  it("calculates correct relative luminance for black and white", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 4);
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 4);
  });

  it("calculates expected extreme contrast ratios", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 1);
  });

  it("verifies all color tokens satisfy ADR-0010 contrast requirements", () => {
    const colors = loadColorTokens();
    const rules = getStandardContrastRules(colors);
    const { results, passed } = verifyContrastRules(rules);

    for (const r of results) {
      expect(
        r.passed,
        `Token rule "${r.rule.name}" failed: got ${r.ratio.toFixed(2)}:1, expected at least ${r.rule.minRatio}:1`,
      ).toBe(true);
    }

    expect(passed).toBe(true);
  });

  it("confirms edge token clears 3.0:1 non-text contrast on surface and canvas", () => {
    const colors = loadColorTokens();
    const { edge, surface, canvas } = colors;
    if (!edge || !surface || !canvas) {
      throw new Error("Missing edge, surface, or canvas color token");
    }
    const surfaceRatio = contrastRatio(edge, surface);
    const canvasRatio = contrastRatio(edge, canvas);

    expect(surfaceRatio).toBeGreaterThanOrEqual(3.0);
    expect(canvasRatio).toBeGreaterThanOrEqual(3.0);
  });

  it("confirms text tokens clear 4.5:1 body text contrast on surface and canvas", () => {
    const colors = loadColorTokens();
    const textKeys = ["ink", "ink2", "brand", "due", "alert", "accent"];
    const { surface, canvas } = colors;
    if (!surface || !canvas) {
      throw new Error("Missing surface or canvas token");
    }

    for (const key of textKeys) {
      const fg = colors[key];
      if (!fg) {
        throw new Error(`Missing token for ${key}`);
      }
      const surfaceRatio = contrastRatio(fg, surface);
      const canvasRatio = contrastRatio(fg, canvas);

      expect(surfaceRatio, `${key} on surface should be >= 4.5:1`).toBeGreaterThanOrEqual(4.5);
      expect(canvasRatio, `${key} on canvas should be >= 4.5:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("throws on invalid hex codes", () => {
    expect(() => relativeLuminance("#XYZ")).toThrow();
    expect(() => relativeLuminance("fff")).toThrow();
  });
});
