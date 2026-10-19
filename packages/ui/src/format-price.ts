/** Price fields a course carries. Mirrors the four columns on `courses`. */
export interface CoursePriceInput {
  priceCents: number;
  discountPercent: number;
  isFree: boolean;
}

/** Display-ready price: what to charge now, and the pre-discount price when discounted. */
export interface CoursePrice {
  amount: string;
  originalAmount: string | null;
  isFree: boolean;
}

const FREE_AMOUNT = "Free";

function clampPercent(percent: number): number {
  return Math.min(Math.max(percent, 0), 100);
}

/** Cents to `$1,234.50`, fixed to 2 decimals so every row aligns. */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, "0");
  return `${sign}$${whole}.${fraction}`;
}

/** Price after the discount, rounded to the nearest cent. */
export function discountedCents(priceCents: number, discountPercent: number): number {
  return Math.round((priceCents * (100 - clampPercent(discountPercent))) / 100);
}

/**
 * A course priced at zero, or flagged free, reads as "Free" — never "$0.00".
 * A discount shows both the new price and the original it came from.
 */
export function formatCoursePrice(input: CoursePriceInput): CoursePrice {
  if (input.isFree || input.priceCents <= 0) {
    return { amount: FREE_AMOUNT, originalAmount: null, isFree: true };
  }

  const discount = clampPercent(input.discountPercent);
  if (discount === 0) {
    return { amount: formatCents(input.priceCents), originalAmount: null, isFree: false };
  }

  return {
    amount: formatCents(discountedCents(input.priceCents, discount)),
    originalAmount: formatCents(input.priceCents),
    isFree: false,
  };
}

export const formatPrice = formatCoursePrice;
