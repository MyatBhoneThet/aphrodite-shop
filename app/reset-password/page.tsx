"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { useLanguage } from "../lib/language";
import AuthShell, {
  authButtonClass,
  authFieldClass,
  authLabelClass,
} from "../components/AuthShell";

/**
 * Step 2 of the reset: the page the emailed link opens.
 *
 * The `?token=` in the link is passed straight back to the server, which
 * redeems it and writes the new password. Nothing is signed in here: on
 * success the customer is sent to /login to use the password they just chose,
 * so a leaked link cannot act as a standing session.
 */
function ResetPasswordForm() {
  const { t } = useLanguage();
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    // Checked here rather than server-side: the server has nothing to compare
    // a typo against, it only ever receives one password.
    if (password !== confirmation) {
      setError(t("reset.mismatch"));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to change the password.");
      }

      router.replace("/login?reset=success");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to change the password."
      );
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      title={t("reset.title")}
      subtitle={t("reset.subtitle")}
      footer={
        <Link
          href="/login"
          className="font-semibold text-red-600 underline underline-offset-4 hover:text-red-700"
        >
          {t("forgot.backToLogin")}
        </Link>
      }
    >
      {token ? (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="reset-password" className={authLabelClass}>
              {t("reset.password")}
            </label>
            <input
              id="reset-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={authFieldClass}
            />
          </div>

          <div>
            <label htmlFor="reset-confirm" className={authLabelClass}>
              {t("reset.confirm")}
            </label>
            <input
              id="reset-confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className={authFieldClass}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={authButtonClass}
          >
            {isSubmitting ? t("reset.submitting") : t("reset.submit")}
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
      ) : (
        <p
          role="alert"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 font-semibold text-amber-900"
        >
          {t("reset.missingToken")}
        </p>
      )}
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  // useSearchParams needs a Suspense boundary above it.
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
