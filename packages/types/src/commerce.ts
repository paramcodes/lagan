export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded" | "canceled";

export const PAYMENT_STATUSES = ["pending", "succeeded", "failed", "refunded", "canceled"] as const;

export type EnrollmentStatus = "active" | "canceled" | "refunded" | "pending";
export const ENROLLMENT_STATUSES = ["active", "canceled", "refunded", "pending"] as const;

export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  stripePaymentId: string;
  enrolledAt: Date;
  courseVersionSeen: number;
}

export interface EnrollmentIntent {
  userId: string;
  courseId: string;
  stripePaymentId: string;
}

export interface CoursePriceInput {
  priceCents: number;
  discountPercent: number;
  isFree: boolean;
}

export interface CoursePrice {
  amount: string;
  originalAmount: string | null;
  isFree: boolean;
}

export interface PriceComputation {
  rawPriceCents: number;
  discountPercent: number;
  finalPriceCents: number;
  isFree: boolean;
}

export interface StripeCheckoutSessionRequest {
  userId: string;
  courseId: string;
  courseTitle: string;
  priceCents: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
}

export interface StripeCheckoutSession {
  id: string;
  url: string;
}
