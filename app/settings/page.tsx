"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import BrandLogo from "../components/BrandLogo";
import {
  LiquidBackdrop,
  authButtonClass,
  authFieldClass,
  authLabelClass,
  glassCardClass,
} from "../components/AuthShell";
import { authHeaders } from "../lib/client-auth";
import { useCurrentUser } from "../lib/useCurrentUser";
import { useLanguage } from "../lib/language";

type SettingsData = {
  email: string;
  full_name: string;
  phone: string;
  shipping_address_line1: string;
  shipping_address_line2: string;
  shipping_city: string;
  shipping_state: string;
  shipping_postal_code: string;
  shipping_country: string;
  preferred_language: "en" | "my";
  order_updates_enabled: boolean;
  support_updates_enabled: boolean;
  marketing_emails_enabled: boolean;
};

const emptySettings: SettingsData = {
  email: "",
  full_name: "",
  phone: "",
  shipping_address_line1: "",
  shipping_address_line2: "",
  shipping_city: "",
  shipping_state: "",
  shipping_postal_code: "",
  shipping_country: "Myanmar",
  preferred_language: "en",
  order_updates_enabled: true,
  support_updates_enabled: true,
  marketing_emails_enabled: false,
};

/** Frosted panel, shared with the login and signup cards. */
const glassCard = `${glassCardClass} sm:p-8`;

/** Field styling is shared with the auth pages; only the disabled state
 *  (the read-only email) is added here. */
const settingsFieldClass = `${authFieldClass} disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-500`;

const glassTileClass =
  "flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white/70 p-4 font-semibold backdrop-blur transition hover:border-red-500 hover:bg-red-50";

async function errorMessage(response: Response) {
  const data = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  return data?.error ?? "Request failed.";
}

/** Centred message page, so every state keeps the same liquid look. */
function SettingsNotice({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { href: string; label: string };
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white px-5 text-center text-zinc-950">
      <LiquidBackdrop />
      <div className={`relative w-full max-w-md ${glassCard}`}>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600">
          {description}
        </p>
        {action && (
          <Link
            href={action.href}
            className={`mt-7 inline-block ${authButtonClass}`}
          >
            {action.label}
          </Link>
        )}
      </div>
    </main>
  );
}

export default function SettingsPage() {
  const { t } = useLanguage();
  const { user, status, refresh } = useCurrentUser();
  const [settings, setSettings] = useState<SettingsData>(emptySettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      if (status !== "ready") return;

      if (!user || user.role === "admin" || user.role === "staff") {
        if (!cancelled) setIsLoading(false);
        return;
      }

      const response = await fetch("/api/settings", {
        headers: authHeaders(),
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as
        | { settings?: SettingsData; error?: string }
        | null;

      if (cancelled) return;

      if (response.ok && data?.settings) {
        setSettings(data.settings);
      } else {
        setError(data?.error ?? "Unable to load account settings.");
      }

      setIsLoading(false);
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, [status, user]);

  function updateField<Key extends keyof SettingsData>(
    key: Key,
    value: SettingsData[Key]
  ) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: settings.full_name,
          phone: settings.phone,
          shipping_address_line1: settings.shipping_address_line1,
          shipping_address_line2: settings.shipping_address_line2,
          shipping_city: settings.shipping_city,
          shipping_state: settings.shipping_state,
          shipping_postal_code: settings.shipping_postal_code,
          shipping_country: settings.shipping_country,
          preferred_language: settings.preferred_language,
          order_updates_enabled: settings.order_updates_enabled,
          support_updates_enabled: settings.support_updates_enabled,
          marketing_emails_enabled: settings.marketing_emails_enabled,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { settings?: SettingsData; error?: string }
        | null;

      if (!response.ok || !data?.settings) {
        throw new Error(data?.error ?? "Unable to save account settings.");
      }

      setSettings(data.settings);
      await refresh();
      setMessage("Account settings saved successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save account settings."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setIsChangingPassword(true);

    try {
      const response = await fetch("/api/settings/password", {
        method: "PATCH",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      if (!response.ok) throw new Error(await errorMessage(response));

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password changed successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to change password."
      );
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function clearRecentlyViewed() {
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/recently-viewed", {
        method: "DELETE",
        headers: authHeaders(),
      });

      if (!response.ok) throw new Error(await errorMessage(response));
      setMessage("Recently viewed history cleared.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to clear recently viewed history."
      );
    }
  }

  if (status === "checking" || isLoading) {
    return (
      <SettingsNotice
        title="Loading your settings"
        description="One moment while we open your account."
      />
    );
  }

  if (!user) {
    return (
      <SettingsNotice
        title="Login to manage your account"
        description="Settings are private and connected to your customer account."
        action={{ href: "/login", label: "Login" }}
      />
    );
  }

  if (user.role === "admin" || user.role === "staff") {
    return (
      <SettingsNotice
        title="Customer settings"
        description="Administrators manage their work from the admin dashboard."
        action={{ href: "/admin", label: "Open admin dashboard" }}
      />
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-white text-zinc-950">
      <LiquidBackdrop />

      <div className="relative mx-auto max-w-3xl px-5 py-10 sm:py-14">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" aria-label="Aphrodite Myanmar home">
            <BrandLogo />
          </Link>

          <Link
            href="/"
            className="rounded-full border border-zinc-300 bg-white/70 px-5 py-2 text-sm font-semibold backdrop-blur transition hover:border-zinc-950"
          >
            ← Back to store
          </Link>
        </header>

        <div className="mt-10">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-red-600">
            My account
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
            Settings
          </h1>
          <p className="mt-3 text-zinc-600">
            Manage your profile, delivery details, preferences and security.
          </p>
        </div>

        {(message || error) && (
          <p
            role={error ? "alert" : "status"}
            className={`mt-7 rounded-2xl border p-4 text-sm font-semibold ${
              error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {error || message}
          </p>
        )}

        <form onSubmit={saveSettings} className="mt-7 space-y-5">
          <section className={glassCard}>
            <h2 className="text-xl font-bold">{t("settings.profile")}</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Used for orders and customer support.
            </p>

            <div className="mt-6 space-y-4">
              <SettingsInput
                label="Email"
                value={settings.email}
                disabled
                onChange={() => undefined}
              />
              <SettingsInput
                label={t("settings.fullName")}
                value={settings.full_name}
                required
                onChange={(value) => updateField("full_name", value)}
              />
              <SettingsInput
                label={t("settings.phone")}
                value={settings.phone}
                inputMode="tel"
                placeholder="+66 81 234 5678"
                onChange={(value) => updateField("phone", value)}
              />
            </div>
          </section>

          <section className={glassCard}>
            <h2 className="text-xl font-bold">{t("settings.deliveryAddress")}</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Automatically fills the cash-on-delivery checkout form.
            </p>

            <div className="mt-6 space-y-4">
              <SettingsInput
                label={t("settings.addressLine1")}
                value={settings.shipping_address_line1}
                placeholder="House number and street"
                onChange={(value) =>
                  updateField("shipping_address_line1", value)
                }
              />
              <SettingsInput
                label={t("settings.addressLine2")}
                value={settings.shipping_address_line2}
                placeholder="Apartment, unit or building"
                onChange={(value) =>
                  updateField("shipping_address_line2", value)
                }
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <SettingsInput
                  label={t("settings.city")}
                  value={settings.shipping_city}
                  onChange={(value) => updateField("shipping_city", value)}
                />
                <SettingsInput
                  label={t("settings.state")}
                  value={settings.shipping_state}
                  onChange={(value) => updateField("shipping_state", value)}
                />
                <SettingsInput
                  label={t("settings.postalCode")}
                  value={settings.shipping_postal_code}
                  onChange={(value) =>
                    updateField("shipping_postal_code", value)
                  }
                />
                <SettingsInput
                  label={t("settings.country")}
                  value={settings.shipping_country}
                  required
                  onChange={(value) => updateField("shipping_country", value)}
                />
              </div>
            </div>
          </section>

          <section className={glassCard}>
            <h2 className="text-xl font-bold">{t("settings.preferences")}</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Choose your language and which updates you receive.
            </p>

            <label className="mt-6 block">
              <span className={authLabelClass}>{t("settings.preferredLanguage")}</span>
              <select
                value={settings.preferred_language}
                onChange={(event) =>
                  updateField(
                    "preferred_language",
                    event.target.value as "en" | "my"
                  )
                }
                className={settingsFieldClass}
              >
                <option value="en">English</option>
                <option value="my">Myanmar</option>
              </select>
            </label>

            <div className="mt-5 space-y-3">
              <SettingsCheckbox
                label={t("settings.orderUpdates")}
                description="Receive important purchase and delivery updates."
                checked={settings.order_updates_enabled}
                onChange={(checked) =>
                  updateField("order_updates_enabled", checked)
                }
              />
              <SettingsCheckbox
                label={t("settings.supportUpdates")}
                description="Receive updates when an admin replies to live chat."
                checked={settings.support_updates_enabled}
                onChange={(checked) =>
                  updateField("support_updates_enabled", checked)
                }
              />
              <SettingsCheckbox
                label={t("settings.marketing")}
                description="Allow optional marketing and new-product messages."
                checked={settings.marketing_emails_enabled}
                onChange={(checked) =>
                  updateField("marketing_emails_enabled", checked)
                }
              />
            </div>
          </section>

          <section className={glassCard}>
            <h2 className="text-xl font-bold">{t("settings.shoppingPrivacy")}</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Open your shopping information or remove browsing history.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link href="/orders" className={glassTileClass}>
                <span aria-hidden="true">📦</span> My orders
              </Link>
              <Link href="/wishlist" className={glassTileClass}>
                <span aria-hidden="true">♡</span> Wishlist
              </Link>
              <button
                type="button"
                onClick={clearRecentlyViewed}
                className={`${glassTileClass} text-left sm:col-span-2`}
              >
                <span aria-hidden="true">🕘</span> Clear recently viewed history
              </button>
            </div>
          </section>

          <button type="submit" disabled={isSaving} className={authButtonClass}>
            {isSaving ? "Saving settings..." : "Save account settings"}
          </button>
        </form>

        <section className={`mt-5 ${glassCard}`}>
          <h2 className="text-xl font-bold">{t("settings.passwordSecurity")}</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Confirm your current password before choosing a new one.
          </p>

          <form onSubmit={changePassword} className="mt-6 space-y-4">
            <PasswordInput
              label="Current password"
              value={currentPassword}
              onChange={setCurrentPassword}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <PasswordInput
                label="New password"
                value={newPassword}
                onChange={setNewPassword}
              />
              <PasswordInput
                label="Confirm new password"
                value={confirmPassword}
                onChange={setConfirmPassword}
              />
            </div>
            <button
              type="submit"
              disabled={isChangingPassword}
              className="w-full rounded-full border border-zinc-300 bg-white/70 px-5 py-3.5 font-bold backdrop-blur transition hover:border-zinc-950 disabled:cursor-not-allowed disabled:text-zinc-400"
            >
              {isChangingPassword ? "Changing password..." : "Change password"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

function SettingsInput({
  label,
  value,
  onChange,
  required = false,
  disabled = false,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  inputMode?: "text" | "tel" | "numeric";
}) {
  return (
    <label className="block">
      <span className={authLabelClass}>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        inputMode={inputMode}
        className={settingsFieldClass}
      />
    </label>
  );
}

function PasswordInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className={authLabelClass}>{label}</span>
      <input
        type="password"
        required
        minLength={label === "Current password" ? 1 : 8}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={
          label === "Current password" ? "current-password" : "new-password"
        }
        className={settingsFieldClass}
      />
    </label>
  );
}

function SettingsCheckbox({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-2xl border border-zinc-200 bg-white/70 p-4 backdrop-blur transition hover:border-red-500 hover:bg-red-50">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-red-600"
      />
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-1 block text-xs text-zinc-500">{description}</span>
      </span>
    </label>
  );
}
