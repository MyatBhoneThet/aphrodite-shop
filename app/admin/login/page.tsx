"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useCurrentUser } from "../../lib/useCurrentUser";
import type { CurrentUser } from "../../lib/useCurrentUser";

type AdminLoginResponse = {
  user?: CurrentUser | null;
  error?: string;
};

export default function AdminLoginPage() {
  const { user, status } = useCurrentUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (status === "ready" && (user?.role === "admin" || user?.role === "staff")) {
      window.location.assign("/admin/dashboard");
    }
  }, [status, user]);

  function validate() {
    const nextErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!password) {
      nextErrors.password = "Password is required.";
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = (await response
        .json()
        .catch(() => ({ error: "Invalid server response." }))) as AdminLoginResponse;

      if (!response.ok || !data.user) {
        throw new Error(data.error ?? "Unable to login.");
      }

      // Back-office session lives in an httpOnly cookie set by the route.
      window.location.assign("/admin/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to login.");
      setIsSubmitting(false);
    }
  }

  if (status === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-zinc-700">
        Checking session...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-zinc-950">
      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 md:grid-cols-2">
        <section className="flex flex-col justify-center px-8 py-12">
          <Link href="/" className="mb-10 text-2xl font-bold text-red-600">
            Aphrodite
          </Link>

          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-red-600">
            Back office
          </p>
          <h1 className="mt-3 text-4xl font-bold">Admin & staff sign in</h1>

          <p className="mt-4 max-w-md text-zinc-500">
            Sign in with your admin or staff account. Your role controls which
            tools and customer information are available.
          </p>

          <form
            onSubmit={handleSubmit}
            noValidate
            className="mt-10 max-w-md space-y-5"
          >
            <div>
              <label htmlFor="admin-email" className="mb-2 block text-sm font-semibold">
                Email
              </label>
              <input
                id="admin-email"
                type="email"
                autoComplete="username"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? "admin-email-error" : undefined}
                className={`w-full rounded-2xl border px-5 py-4 outline-none focus:border-red-500 ${
                  fieldErrors.email ? "border-red-500" : ""
                }`}
              />
              {fieldErrors.email && (
                <p id="admin-email-error" className="mt-2 text-sm text-red-600">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="mb-2 block text-sm font-semibold"
              >
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={
                  fieldErrors.password ? "admin-password-error" : undefined
                }
                className={`w-full rounded-2xl border px-5 py-4 outline-none focus:border-red-500 ${
                  fieldErrors.password ? "border-red-500" : ""
                }`}
              />
              {fieldErrors.password && (
                <p id="admin-password-error" className="mt-2 text-sm text-red-600">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full bg-red-600 px-5 py-4 font-semibold text-white disabled:bg-zinc-400"
            >
              {isSubmitting ? "Signing in..." : "Sign in"}
            </button>

            {error && (
              <p
                role="alert"
                className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700"
              >
                {error}
              </p>
            )}
          </form>

          <p className="mt-6 text-sm text-zinc-500">
            <Link href="/" className="font-semibold text-red-600">
              Back to store
            </Link>
          </p>
        </section>

        <section className="hidden items-center justify-center bg-zinc-900 p-10 text-white md:flex">
          <div className="max-w-md text-center">
            <p className="text-sm uppercase tracking-[0.3em] text-white/60">
              Aphrodite Admin
            </p>
            <h2 className="mt-5 text-5xl font-bold">
              Business statistics, products, and orders in one place.
            </h2>
          </div>
        </section>
      </div>
    </main>
  );
}
