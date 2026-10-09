"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import type { CurrentUser } from "../lib/useCurrentUser";
import { useLanguage } from "../lib/language";
import type { SocialProvider } from "../lib/oauth";
import SocialSignInButtons from "../components/SocialSignIn";
import AuthShell, {
  authButtonClass,
  authFieldClass,
  authLabelClass,
} from "../components/AuthShell";

type RegisterResponse = {
  user?: CurrentUser | null;
  profile?: CurrentUser | null;
  error?: string;
  requiresEmailVerification?: boolean;
};

type LoginResponse = {
  user?: CurrentUser | null;
  profile?: CurrentUser | null;
  error?: string;
};

type AccountKind = "retail" | "wholesale";

/**
 * `providers` is decided on the server (enabledSocialProviders) so the page
 * never offers a sign-in button the shop has not configured.
 */
export default function RegisterForm({
  providers,
}: {
  providers: SocialProvider[];
}) {
  const { t } = useLanguage();
  const [kind, setKind] = useState<AccountKind>("retail");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    const isWholesale = kind === "wholesale";

    try {
      const registerResponse = await fetch(
        isWholesale ? "/api/auth/register/wholesale" : "/api/auth/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isWholesale
              ? {
                  email: email.trim(),
                  password,
                  full_name: fullName.trim() || undefined,
                  invite_code: inviteCode.trim(),
                  business_name: businessName.trim(),
                  contact_person: contactPerson.trim() || undefined,
                  phone: phone.trim() || undefined,
                }
              : {
                  email: email.trim(),
                  password,
                  full_name: fullName.trim() || undefined,
                }
          ),
        }
      );

      const registerData = (await registerResponse
        .json()
        .catch(() => ({ error: "Invalid server response." }))) as RegisterResponse;

      if (!registerResponse.ok) {
        throw new Error(registerData.error ?? "Unable to create account.");
      }

      if (registerData.requiresEmailVerification) {
        setPassword("");
        setSuccess(
          isWholesale
            ? "Business account created. Check your email and verify the address, then sign in to see your wholesale prices."
            : "Account created. Check your email and verify the address before signing in."
        );
        setIsSubmitting(false);
        return;
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

      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create account.");
      setIsSubmitting(false);
    }
  }

  const isWholesale = kind === "wholesale";

  return (
    <AuthShell
      title={isWholesale ? "Create a business account" : "Create your account"}
      subtitle={
        isWholesale
          ? "For shops and resellers buying in bulk. You need a one-time registration code from Aphrodite."
          : "Sign up to save your wishlist, track orders, and check out faster."
      }
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-red-600 underline underline-offset-4 hover:text-red-700"
          >
            Login
          </Link>
        </>
      }
    >
      {/* Account type switch */}
      <div
        role="tablist"
        aria-label="Account type"
        className="mb-6 grid grid-cols-2 gap-1 rounded-full border border-zinc-200 bg-zinc-100/70 p-1 backdrop-blur"
      >
        {(["retail", "wholesale"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={kind === value}
            onClick={() => {
              setKind(value);
              setError("");
              setSuccess("");
            }}
            className={`rounded-full px-4 py-2.5 text-sm font-bold capitalize transition ${
              kind === value
                ? "bg-red-600 text-white shadow-sm"
                : "text-zinc-600 hover:text-zinc-950"
            }`}
          >
            {value === "retail" ? "Personal" : "Business"}
          </button>
        ))}
      </div>

      {/* Personal accounts only. A business account needs an invite code and
          the shop's details, which Google and LINE cannot supply -- a
          wholesale applicant has to fill the form. */}
      {!isWholesale && providers.length > 0 && (
        <div className="mb-5">
          <SocialSignInButtons providers={providers} />
        </div>
      )}

      <form onSubmit={handleRegister} className="space-y-5">
        {isWholesale && (
          <>
            <div>
              <label htmlFor="invite-code" className={authLabelClass}>
                Registration code
              </label>
              <input
                id="invite-code"
                required
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value)}
                placeholder={t("register.inviteCode")}
                autoComplete="off"
                spellCheck={false}
                className={`${authFieldClass} font-mono uppercase tracking-[0.2em]`}
              />
              <p className="mt-2 text-xs text-zinc-500">
                Ask Aphrodite for your one-time code. Each code works once.
              </p>
            </div>

            <div>
              <label htmlFor="business-name" className={authLabelClass}>
                Business / shop name
              </label>
              <input
                id="business-name"
                required
                minLength={2}
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                placeholder={t("register.shopName")}
                className={authFieldClass}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="contact-person" className={authLabelClass}>
                  Contact person
                </label>
                <input
                  id="contact-person"
                  value={contactPerson}
                  onChange={(event) => setContactPerson(event.target.value)}
                  placeholder={t("register.contactPerson")}
                  className={authFieldClass}
                />
              </div>

              <div>
                <label htmlFor="phone" className={authLabelClass}>
                  Phone
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="09..."
                  className={authFieldClass}
                />
              </div>
            </div>
          </>
        )}

        <div>
          <label htmlFor="full-name" className={authLabelClass}>
            Full name
          </label>
          <input
            id="full-name"
            type="text"
            autoComplete="name"
            placeholder={t("register.yourName")}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className={authFieldClass}
          />
        </div>

        <div>
          <label htmlFor="email" className={authLabelClass}>
            Email
          </label>
          <input
            id="email"
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
          <label htmlFor="password" className={authLabelClass}>
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder={t("register.passwordHint")}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={authFieldClass}
          />
        </div>

        <button type="submit" disabled={isSubmitting} className={authButtonClass}>
          {isSubmitting
            ? "Creating account..."
            : isWholesale
            ? "Create business account"
            : "Create account"}
        </button>

        {error && (
          <p
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"
          >
            {error}
          </p>
        )}

        {success && (
          <p
            role="status"
            className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700"
          >
            {success}
          </p>
        )}
      </form>
    </AuthShell>
  );
}
