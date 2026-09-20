"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import type { CurrentUser } from "../lib/useCurrentUser";
import type { SocialProvider } from "../lib/oauth";
import { useLanguage } from "../lib/language";
import DeliveryLocationWelcome from "../components/DeliveryLocationWelcome";
import SocialSignInButtons from "../components/SocialSignIn";
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

/**
 * `useSearchParams` makes the whole subtree client-rendered on demand, so it
 * has to sit inside a <Suspense> boundary; app/login/page.tsx provides one.
 *
 * `providers` is decided on the server (enabledSocialProviders) so the page
 * never offers a sign-in button the shop has not configured.
 */
export default function LoginForm({
  providers,
}: {
  providers: SocialProvider[];
}) {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  // Set by the social sign-in routes when they bounce back here, and by
  // /reset-password after a successful change.
  const redirectError = searchParams.get("error");
  const passwordWasReset = searchParams.get("reset") === "success";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeliveryWelcome, setShowDeliveryWelcome] = useState(false);
  // A message left in the URL by a failed social sign-in is stale as soon as
  // the customer tries the password form instead.
  const [redirectErrorDismissed, setRedirectErrorDismissed] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setRedirectErrorDismissed(true);
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
      {passwordWasReset && (
        <p
          role="status"
          className="mb-5 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800"
        >
          {t("login.resetDone")}
        </p>
      )}

      <SocialSignInButtons providers={providers} />

      <form
        onSubmit={handleLogin}
        className={providers.length > 0 ? "mt-5 space-y-5" : "space-y-5"}
      >
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
          <div className="mb-2 flex items-baseline justify-between gap-3">
            {/* Not authLabelClass: that carries a bottom margin, which this
                row supplies for the label and link together. */}
            <label
              htmlFor="login-password"
              className="block text-sm font-semibold text-zinc-800"
            >
              {t("login.password")}
            </label>
            <Link
              href="/forgot-password"
              className="text-sm font-semibold text-red-600 underline underline-offset-4 hover:text-red-700"
            >
              {t("login.forgotPassword")}
            </Link>
          </div>
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

        {(error || (!redirectErrorDismissed && redirectError)) && (
          <p
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"
          >
            {error || redirectError}
          </p>
        )}
      </form>

      {/* The commonest reason someone opens this page is to ask where their
          order is -- which needs no account at all. Offering that here saves
          them signing in, or worse, registering a second time because they
          cannot remember the first. */}
      <p className="mt-6 text-center text-sm text-zinc-600">
        {t("login.justTracking")}{" "}
        <Link
          href="/track"
          className="font-semibold text-red-600 underline underline-offset-4 hover:text-red-700"
        >
          {t("login.trackOrder")}
        </Link>
      </p>

      {/* Signing up is the other half of this page, not a footnote to it: a
          first-time customer should be able to see the way out of the login
          form without reading it first. */}
      <div className="mt-7 border-t border-zinc-200 pt-6 text-center">
        <p className="text-sm text-zinc-600">{t("login.noAccount")}</p>
        <Link
          href="/register"
          className="mt-3 flex w-full items-center justify-center rounded-full border-2 border-red-600 px-5 py-3 font-bold text-red-600 transition hover:bg-red-600 hover:text-white"
        >
          {t("login.registerNew")}
        </Link>
      </div>
    </AuthShell>
  );
}
