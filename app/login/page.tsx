"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import type { CurrentUser } from "../lib/useCurrentUser";
import { useLanguage } from "../lib/language";
import DeliveryLocationWelcome from "../components/DeliveryLocationWelcome";
import AuthShell, {
  authButtonClass,
  authFieldClass,
  authLabelClass,
  glassCardClass,
} from "../components/AuthShell";

type LoginResponse = {
  user?: CurrentUser | null;
  profile?: CurrentUser | null;
  error?: string;
};

async function readLoginResponse(response: Response) {
  return (await response.json().catch(() => ({
    error: "Invalid server response.",
  }))) as LoginResponse;
}

export default function LoginPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeliveryWelcome, setShowDeliveryWelcome] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
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
          "Login succeeded, but no profile was returned. Please contact support."
        );
      }

      // The session travels in an httpOnly cookie set by the login route;
      // nothing to persist client-side. Admins land on their dashboard
      // (the login route also set the admin session cookie for them);
      // Customers see a consent explanation before any browser GPS request.
      if (user.role === "admin") window.location.assign("/admin/dashboard");
      else setShowDeliveryWelcome(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to login.");
      setIsSubmitting(false);
    }
  }

  if (showDeliveryWelcome) return <DeliveryLocationWelcome />;

  return (
    <AuthShell
      title={t("login.title")}
      subtitle={t("login.subtitle")}
      footer={
        <>
          {t("login.newHere")}{" "}
          <Link
            href="/register"
            className="font-semibold text-red-600 underline underline-offset-4 hover:text-red-700"
          >
            {t("login.createAccount")}
          </Link>
        </>
      }
      aside={
        <div className={`${glassCardClass} sm:p-8`}>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-red-600">
            Aphrodite Myanmar
          </p>
          <h2 className="mt-4 text-3xl font-bold leading-tight">
            {t("login.pitch")}
          </h2>
          <ul className="mt-6 space-y-3 text-sm text-zinc-600">
            <li>• {t("login.benefitTracking")}</li>
            <li>• {t("login.benefitBusiness")}</li>
            <li>• {t("login.benefitFavourites")}</li>
          </ul>
        </div>
      }
    >
      <form onSubmit={handleLogin} className="space-y-5">
        <div>
          <label htmlFor="login-email" className={authLabelClass}>
            {t("login.email")}
          </label>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={authFieldClass}
          />
        </div>

        <div>
          <label htmlFor="login-password" className={authLabelClass}>
            {t("login.password")}
          </label>
          <input
            id="login-password"
            type="password"
            required
            autoComplete="current-password"
            placeholder={t("login.passwordPlaceholder")}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={authFieldClass}
          />
        </div>

        <button type="submit" disabled={isSubmitting} className={authButtonClass}>
          {isSubmitting ? t("login.submitting") : t("login.submit")}
        </button>

        {error && (
          <p
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"
          >
            {error}
          </p>
        )}
      </form>
    </AuthShell>
  );
}
