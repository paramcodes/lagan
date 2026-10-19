"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { authClient } from "../../../lib/auth-client";

const signInSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type SignInValues = z.infer<typeof signInSchema>;

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/learn";

  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(values: SignInValues) {
    setError(null);
    setLoading(true);
    try {
      const result = await authClient.signIn.email({
        email: values.email,
        password: values.password,
      });
      if (result?.error) {
        setError(result.error.message ?? "Failed to sign in");
        return;
      }
      router.push(next);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to sign in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)] px-4">
      <div className="w-full max-w-sm rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-[var(--color-ink)]">Sign in</h1>
        <p className="mt-1 text-sm text-[var(--color-ink2)]">
          Welcome back. Enter your credentials to continue.
        </p>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-ink)]" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="mt-1 w-full rounded-[var(--radius-control)] border border-[var(--color-edge)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
              {...form.register("email")}
            />
            {form.formState.errors.email && (
              <p className="mt-1 text-sm text-[var(--color-alert)]">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-ink)]" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="mt-1 w-full rounded-[var(--radius-control)] border border-[var(--color-edge)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
              {...form.register("password")}
            />
            {form.formState.errors.password && (
              <p className="mt-1 text-sm text-[var(--color-alert)]">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>

          {error && <p className="text-sm text-[var(--color-alert)]">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-[var(--radius-control)] bg-[var(--color-brand)] px-3 py-2 text-sm font-medium text-[var(--color-surface)] disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-[var(--color-ink2)]">
          No account?{" "}
          <a href="/sign-up" className="text-[var(--color-accent)] underline">
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
