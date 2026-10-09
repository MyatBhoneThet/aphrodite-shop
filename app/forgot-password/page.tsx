"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useLanguage } from "../lib/language";
import AuthShell, {
  authButtonClass,
  authFieldClass,
  authLabelClass,
} from "../components/AuthShell";

/**
 * Step 1 of the reset: ask for the email address.
 *
 * The confirmation below is shown for every address, whether or not it has an
 * account -- matching what the API answers. A page that said "no such account"
 * would let anyone check which email addresses shop here.
 */
export default function ForgotPasswordPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to send the reset link.");
      }

      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to send the reset link."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      title={t("forgot.title")}
      subtitle={t("forgot.subtitle")}
      footer={
        <Link
          href="/login"
          className="font-semibold text-red-600 underline underline-offset-4 hover:text-red-700"
        >
          {t("forgot.backToLogin")}
        </Link>
      }
    >
      {sent ? (
        <p
          role="status"
          className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm leading-6 font-semibold text-green-800"
        >
          {t("forgot.checkInbox")}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="forgot-email" className={authLabelClass}>
              {t("forgot.email")}
            </label>
            <input
              id="forgot-email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={authFieldClass}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={authButtonClass}
          >
            {isSubmitting ? t("forgot.submitting") : t("forgot.submit")}
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
      )}
    </AuthShell>
  );
}
