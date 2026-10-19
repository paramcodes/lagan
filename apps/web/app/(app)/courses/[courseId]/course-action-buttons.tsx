"use client";

import { AlertCircle, Loader2, Play, ShoppingBag, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { enrollFreeCourse } from "./actions";

export interface CourseActionButtonsProps {
  courseId: string;
  isEnrolled: boolean;
  resumeHref: string;
  isFree: boolean;
  priceCents: number;
  isAuthenticated: boolean;
}

export function CourseActionButtons({
  courseId,
  isEnrolled,
  resumeHref,
  isFree,
  priceCents,
  isAuthenticated,
}: CourseActionButtonsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const coursePath = `/courses/${courseId}`;
  const signInPath = `/sign-in?next=${encodeURIComponent(coursePath)}`;
  const isFreeCourse = isFree || priceCents === 0;

  // Enrolled learner: direct resume deep link
  if (isEnrolled) {
    return (
      <div className="space-y-3">
        <Link
          href={resumeHref}
          data-testid="continue-learning-button"
          className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-brand)] px-5 py-3.5 text-sm font-semibold text-[var(--color-surface)] shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]"
        >
          <Play className="h-4 w-4 fill-current" />
          Continue Learning
        </Link>
        <p className="text-center text-xs text-[var(--color-edge)]">
          You are enrolled in this course. Pick up where you left off.
        </p>
      </div>
    );
  }

  // Free course: enroll for free mutation
  if (isFreeCourse) {
    if (!isAuthenticated) {
      return (
        <div className="space-y-2">
          <Link
            href={signInPath}
            data-testid="enroll-free-button"
            className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-brand)] px-5 py-3.5 text-sm font-semibold text-[var(--color-surface)] shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]"
          >
            <Sparkles className="h-4 w-4" />
            Enroll for Free
          </Link>
          <p className="text-center text-xs text-[var(--color-edge)]">
            Already have an account?{" "}
            <Link
              href={signInPath}
              className="font-medium text-[var(--color-ink)] underline hover:opacity-80"
            >
              Sign in to enroll
            </Link>
          </p>
        </div>
      );
    }

    const handleFreeEnroll = () => {
      setErrorMessage(null);
      startTransition(async () => {
        try {
          await enrollFreeCourse(courseId);
          router.push(resumeHref);
          router.refresh();
        } catch (err) {
          setErrorMessage(err instanceof Error ? err.message : "Enrollment failed. Please retry.");
        }
      });
    };

    return (
      <div className="space-y-3">
        {errorMessage ? (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-[var(--radius-chip)] border border-[var(--color-alert)]/30 bg-[var(--color-alert)]/10 px-3 py-2 text-xs text-[var(--color-alert)]"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleFreeEnroll}
          disabled={isPending}
          data-testid="enroll-free-button"
          className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-brand)] px-5 py-3.5 text-sm font-semibold text-[var(--color-surface)] shadow-sm transition hover:opacity-90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Enroll for Free
        </button>
        <p className="text-center text-xs text-[var(--color-edge)]">
          Free course. Full lifetime access included.
        </p>
      </div>
    );
  }

  // Paid course: Stripe checkout flow
  if (!isAuthenticated) {
    return (
      <div className="space-y-2">
        <Link
          href={signInPath}
          data-testid="buy-now-button"
          className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-brand)] px-5 py-3.5 text-sm font-semibold text-[var(--color-surface)] shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]"
        >
          <ShoppingBag className="h-4 w-4" />
          Buy Now
        </Link>
        <p className="text-center text-xs text-[var(--color-edge)]">
          Please{" "}
          <Link
            href={signInPath}
            className="font-medium text-[var(--color-ink)] underline hover:opacity-80"
          >
            sign in to buy
          </Link>
        </p>
      </div>
    );
  }

  const handleCheckout = async () => {
    setIsCheckingOut(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });

      if (response.status === 401) {
        router.push(signInPath);
        return;
      }

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.url) {
        throw new Error(data?.error ?? "Unable to initiate Stripe checkout");
      }

      window.location.href = data.url;
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Checkout error occurred.");
      setIsCheckingOut(false);
    }
  };

  return (
    <div className="space-y-3">
      {errorMessage ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-[var(--radius-chip)] border border-[var(--color-alert)]/30 bg-[var(--color-alert)]/10 px-3 py-2 text-xs text-[var(--color-alert)]"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleCheckout}
        disabled={isCheckingOut}
        data-testid="buy-now-button"
        className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-brand)] px-5 py-3.5 text-sm font-semibold text-[var(--color-surface)] shadow-sm transition hover:opacity-90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]"
      >
        {isCheckingOut ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ShoppingBag className="h-4 w-4" />
        )}
        Buy Now
      </button>
      <p className="text-center text-xs text-[var(--color-edge)]">
        Secure checkout powered by Stripe. Instant access upon confirmation.
      </p>
    </div>
  );
}
