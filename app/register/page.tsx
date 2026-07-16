"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import type { CurrentUser } from "../lib/useCurrentUser";

type RegisterResponse = {
  user?: CurrentUser | null;
  profile?: CurrentUser | null;
  error?: string;
};

type LoginResponse = {
  user?: CurrentUser | null;
  profile?: CurrentUser | null;
  error?: string;
};

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const registerResponse = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          full_name: fullName.trim() || undefined,
        }),
      });

      const registerData = (await registerResponse
        .json()
        .catch(() => ({ error: "Invalid server response." }))) as RegisterResponse;

      if (!registerResponse.ok) {
        throw new Error(registerData.error ?? "Unable to create account.");
      }

      // Registration doesn't return a session by itself, so log in
      // immediately with the same credentials to get a working session.
      const loginResponse = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const loginData = (await loginResponse
        .json()
        .catch(() => ({ error: "Invalid server response." }))) as LoginResponse;

      if (!loginResponse.ok) {
        // Account was created but auto-login failed -- send them to log in
        // manually instead of leaving them stuck on this page.
        window.location.assign("/login");
        return;
      }

      const user = loginData.user ?? loginData.profile;

      if (!user) {
        window.location.assign("/login");
        return;
      }

      // Session cookie was set by the login route; nothing to store here.
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create account.");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-zinc-950">
      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 md:grid-cols-2">
        <section className="flex flex-col justify-center px-8 py-12">
          <Link href="/" className="mb-10 text-2xl font-bold text-red-600">
            Aphrodite
          </Link>

          <h1 className="text-4xl font-bold">Create your account</h1>

          <p className="mt-4 max-w-md text-zinc-500">
            Sign up to save your wishlist, track orders, and check out faster.
          </p>

          <form onSubmit={handleRegister} className="mt-10 max-w-md space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold">
                Full name
              </label>
              <input
                type="text"
                placeholder="Your name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="w-full rounded-2xl border px-5 py-4 outline-none focus:border-red-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">Email</label>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-2xl border px-5 py-4 outline-none focus:border-red-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">
                Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                placeholder="At least 8 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-2xl border px-5 py-4 outline-none focus:border-red-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full bg-red-600 px-5 py-4 font-semibold text-white disabled:bg-zinc-400"
            >
              {isSubmitting ? "Creating account..." : "Create account"}
            </button>

            {error && (
              <p className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
                {error}
              </p>
            )}
          </form>

          <p className="mt-6 text-sm text-zinc-500">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-red-600">
              Login
            </Link>
          </p>
        </section>

        <section className="hidden items-center justify-center bg-red-600 p-10 text-white md:flex">
          <div className="max-w-md text-center">
            <p className="text-sm uppercase tracking-[0.3em]">
              Aphrodite Store
            </p>
            <h2 className="mt-5 text-5xl font-bold">
              Join thousands shopping laptops and accessories.
            </h2>
            <p className="mt-5 text-white/80">
              Wishlist your favorites, track orders, and check out in seconds.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
