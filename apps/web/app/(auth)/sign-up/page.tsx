"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { authClient } from "../../../lib/auth-client";

const signUpSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Enter a valid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Confirm your password"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SignUpValues = z.infer<typeof signUpSchema>;

function SignUpForm() {
  const router = useRouter();

  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(values: SignUpValues) {
    setError(null);
    setLoading(true);
    try {
      const result = await authClient.signUp.email({
        name: values.name,
        email: values.email,
        password: values.password,
      });
      if (result?.error) {
        setError(result.error.message ?? "Failed to sign up");
        return;
      }
      router.push("/learn");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to sign up");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)] px-4">
      <div className="w-full max-w-sm rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-[var(--color-ink)]">Create account</h1>
        <p className="mt-1 text-sm text-[var(--color-ink2)]">Sign up to start learning.</p>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-ink)]" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              className="mt-1 w-full rounded-[var(--radius-control)] border border-[var(--color-edge)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="mt-1 text-sm text-[var(--color-alert)]">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

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
              autoComplete="new-password"
              className="mt-1 w-full rounded-[var(--radius-control)] border border-[var(--color-edge)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
              {...form.register("password")}
            />
            {form.formState.errors.password && (
              <p className="mt-1 text-sm text-[var(--color-alert)]">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>

          <div>
            <label
              className="block text-sm font-medium text-[var(--color-ink)]"
              htmlFor="confirmPassword"
            >
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              className="mt-1 w-full rounded-[var(--radius-control)] border border-[var(--color-edge)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
              {...form.register("confirmPassword")}
            />
            {form.formState.errors.confirmPassword && (
              <p className="mt-1 text-sm text-[var(--color-alert)]">
                {form.formState.errors.confirmPassword.message}
              </p>
            )}
          </div>

          {error && <p className="text-sm text-[var(--color-alert)]">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-[var(--radius-control)] bg-[var(--color-brand)] px-3 py-2 text-sm font-medium text-[var(--color-surface)] disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Sign up"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-[var(--color-ink2)]">
          Already have an account?{" "}
          <a href="/sign-in" className="text-[var(--color-accent)] underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpForm />
    </Suspense>
  );
}
