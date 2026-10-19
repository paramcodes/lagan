import { describe, expect, it } from "vitest";
import { discountedCents, formatCents, formatCoursePrice, formatPrice } from "./format-price";

describe("formatCents", () => {
  it("renders whole cents with two decimals", () => {
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(1999)).toBe("$19.99");
    expect(formatCents(199999)).toBe("$1999.99");
  });
});

describe("discountedCents", () => {
  it("applies the discount and rounds to the nearest cent", () => {
    expect(discountedCents(5000, 25)).toBe(3750);
    expect(discountedCents(1999, 33)).toBe(1339);
  });

  it("clamps a discount outside 0-100", () => {
    expect(discountedCents(5000, -10)).toBe(5000);
    expect(discountedCents(5000, 150)).toBe(0);
  });
});

describe("formatCoursePrice", () => {
  it("says Free for a free course", () => {
    expect(formatCoursePrice({ priceCents: 0, discountPercent: 0, isFree: true })).toEqual({
      amount: "Free",
      originalAmount: null,
      isFree: true,
    });
  });

  it("says Free for a zero price that was not flagged free", () => {
    expect(formatCoursePrice({ priceCents: 0, discountPercent: 0, isFree: false })).toEqual({
      amount: "Free",
      originalAmount: null,
      isFree: true,
    });
  });

  it("shows the list price when there is no discount", () => {
    expect(formatCoursePrice({ priceCents: 4999, discountPercent: 0, isFree: false })).toEqual({
      amount: "$49.99",
      originalAmount: null,
      isFree: false,
    });
  });

  it("shows the discounted price next to the original", () => {
    expect(formatCoursePrice({ priceCents: 2000, discountPercent: 25, isFree: false })).toEqual({
      amount: "$15.00",
      originalAmount: "$20.00",
      isFree: false,
    });
  });

  it("ignores the discount for a free course", () => {
    expect(formatCoursePrice({ priceCents: 3000, discountPercent: 50, isFree: true })).toEqual({
      amount: "Free",
      originalAmount: null,
      isFree: true,
    });
  });
});

describe("formatPrice", () => {
  it("is an alias for formatCoursePrice", () => {
    expect(formatPrice).toBe(formatCoursePrice);
  });
});
