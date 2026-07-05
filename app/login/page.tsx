"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import type { UserRole } from "../data/products";

type CurrentUser = {
  id?: string;
  email: string;
  full_name?: string | null;
  role: UserRole;
};

type LoginResponse = {
  user?: CurrentUser | null;
  profile?: CurrentUser | null;
  access_token?: string;
  refresh_token?: string;
  error?: string;
};

async function readLoginResponse(response: Response) {
  return (await response.json().catch(() => ({
    error: "Invalid server response.",
  }))) as LoginResponse;
}

export default function LoginPage() {
  const [email, setEmail] = useState("admin@aphrodite.com");
  const [password, setPassword] = useState("Admin123456");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      localStorage.removeItem("aphrodite_access_token");
      localStorage.removeItem("aphrodite_refresh_token");
      localStorage.removeItem("aphrodite_user");

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await readLoginResponse(response);

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to login.");
      }

      const user = data.user ?? data.profile;

      if (!user) {
        throw new Error(
          "Login success, but profile was not returned. Please check your profiles table."
        );
      }

      localStorage.setItem("aphrodite_user", JSON.stringify(user));

      if (data.access_token) {
        localStorage.setItem("aphrodite_access_token", data.access_token);
      }

      if (data.refresh_token) {
        localStorage.setItem("aphrodite_refresh_token", data.refresh_token);
      }

      window.location.assign(user.role === "admin" ? "/admin" : "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to login.");
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

          <h1 className="text-4xl font-bold">Login to your account</h1>

          <p className="mt-4 max-w-md text-zinc-500">
            Sign in to manage Aphrodite shop products, orders, customer prices
            and admin dashboard.
          </p>

          <form onSubmit={handleLogin} className="mt-10 max-w-md space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold">Email</label>
              <input
                type="email"
                required
                placeholder="admin@aphrodite.com"
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
                placeholder="Admin123456"
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
              {isSubmitting ? "Logging in..." : "Login"}
            </button>

            {error && (
              <p className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
                {error}
              </p>
            )}
          </form>

          <div className="mt-6 max-w-md rounded-2xl bg-zinc-100 p-4 text-sm text-zinc-600">
            <p className="font-semibold text-zinc-900">Demo admin:</p>
            <p>Email: admin@aphrodite.com</p>
            <p>Password: Admin123456</p>
            <p>Admin page: http://localhost:3000/admin</p>
          </div>
        </section>

        <section className="hidden items-center justify-center bg-red-600 p-10 text-white md:flex">
          <div className="max-w-md text-center">
            <p className="text-sm uppercase tracking-[0.3em]">
              Aphrodite Store
            </p>
            <h2 className="mt-5 text-5xl font-bold">
              Admin control for laptops and accessories.
            </h2>
            <p className="mt-5 text-white/80">
              Manage products, orders, wholesale prices and stock with an
              AdminLTE-style dashboard.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
