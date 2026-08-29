"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { authHeaders } from "../lib/client-auth";
import { useCurrentUser } from "../lib/useCurrentUser";

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
  account: {
    role: "normal" | "wholesale" | "admin";
    wholesale_status: string;
    price_list_id: string | null;
    price_list_name: string | null;
  };
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
  shipping_country: "Thailand",
  preferred_language: "en",
  order_updates_enabled: true,
  support_updates_enabled: true,
  marketing_emails_enabled: false,
  account: {
    role: "normal",
    wholesale_status: "not_applied",
    price_list_id: null,
    price_list_name: null,
  },
};

async function errorMessage(response: Response) {
  const data = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  return data?.error ?? "Request failed.";
}

export default function SettingsPage() {
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

      if (!user || user.role === "admin") {
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
      <main className="flex min-h-screen items-center justify-center bg-zinc-50">
        Loading account settings...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-5 text-center">
        <div>
          <h1 className="text-3xl font-bold">Login to manage your account</h1>
          <p className="mt-3 text-zinc-500">
            Settings are private and connected to your customer account.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block rounded-full bg-red-600 px-6 py-3 font-semibold text-white"
          >
            Login
          </Link>
        </div>
      </main>
    );
  }

  if (user.role === "admin") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-5 text-center">
        <div>
          <h1 className="text-3xl font-bold">Customer settings</h1>
          <p className="mt-3 text-zinc-500">
            Administrators manage their work from the admin dashboard.
          </p>
          <Link
            href="/admin"
            className="mt-6 inline-block rounded-full bg-zinc-900 px-6 py-3 font-semibold text-white"
          >
            Open admin dashboard
          </Link>
        </div>
      </main>
    );
  }

  const isWholesale =
    settings.account.role === "wholesale" &&
    settings.account.wholesale_status === "approved";
  const isWholesaleAccount = settings.account.role === "wholesale";
  const accountTypeLabel = isWholesale
    ? "Wholesale customer"
    : isWholesaleAccount
      ? `Wholesale customer (${settings.account.wholesale_status})`
      : "Retail customer";

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <Link href="/" className="text-2xl font-bold text-red-600">
            Aphrodite
          </Link>
          <Link href="/" className="rounded-full border px-5 py-2 text-sm">
            Back to Store
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-red-600">
              My account
            </p>
            <h1 className="mt-1 text-4xl font-bold">Settings</h1>
            <p className="mt-2 text-zinc-500">
              Manage your profile, delivery details, preferences and security.
            </p>
          </div>

          <div
            className={`rounded-2xl px-5 py-3 ${
              isWholesale
                ? "bg-green-100 text-green-800"
                : "bg-white text-zinc-700 shadow-sm"
            }`}
          >
            <p className="text-xs font-semibold uppercase">Account type</p>
            <p className="font-bold">{accountTypeLabel}</p>
            {isWholesale && settings.account.price_list_name && (
              <p className="text-xs">{settings.account.price_list_name}</p>
            )}
          </div>
        </div>

        {(message || error) && (
          <p
            className={`mt-6 rounded-2xl p-4 text-sm font-semibold ${
              error
                ? "bg-red-50 text-red-700"
                : "bg-green-50 text-green-700"
            }`}
          >
            {error || message}
          </p>
        )}

        <form
          onSubmit={saveSettings}
          className="mt-8 grid gap-6 lg:grid-cols-2"
        >
          <section className="rounded-[2rem] bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">Profile and contact</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Used for orders and customer support.
            </p>

            <div className="mt-5 space-y-4">
              <SettingsInput
                label="Email"
                value={settings.email}
                disabled
                onChange={() => undefined}
              />
              <SettingsInput
                label="Full name"
                value={settings.full_name}
                required
                onChange={(value) => updateField("full_name", value)}
              />
              <SettingsInput
                label="Phone"
                value={settings.phone}
                inputMode="tel"
                placeholder="+66 81 234 5678"
                onChange={(value) => updateField("phone", value)}
              />
            </div>
          </section>

          <section className="rounded-[2rem] bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">Default delivery address</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Automatically fills the cash-on-delivery checkout form.
            </p>

            <div className="mt-5 space-y-4">
              <SettingsInput
                label="Address line 1"
                value={settings.shipping_address_line1}
                placeholder="House number and street"
                onChange={(value) =>
                  updateField("shipping_address_line1", value)
                }
              />
              <SettingsInput
                label="Address line 2"
                value={settings.shipping_address_line2}
                placeholder="Apartment, unit or building"
                onChange={(value) =>
                  updateField("shipping_address_line2", value)
                }
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <SettingsInput
                  label="City / District"
                  value={settings.shipping_city}
                  onChange={(value) => updateField("shipping_city", value)}
                />
                <SettingsInput
                  label="Province / State"
                  value={settings.shipping_state}
                  onChange={(value) => updateField("shipping_state", value)}
                />
                <SettingsInput
                  label="Postal code"
                  value={settings.shipping_postal_code}
                  onChange={(value) =>
                    updateField("shipping_postal_code", value)
                  }
                />
                <SettingsInput
                  label="Country"
                  value={settings.shipping_country}
                  required
                  onChange={(value) => updateField("shipping_country", value)}
                />
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">Shopping preferences</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Choose your language and communication preferences.
            </p>

            <label className="mt-5 block text-sm font-semibold">
              Preferred language
              <select
                value={settings.preferred_language}
                onChange={(event) =>
                  updateField(
                    "preferred_language",
                    event.target.value as "en" | "my"
                  )
                }
                className="mt-2 w-full rounded-xl border px-4 py-3 outline-none focus:border-red-500"
              >
                <option value="en">English</option>
                <option value="my">Myanmar</option>
              </select>
            </label>

            <div className="mt-5 space-y-3">
              <SettingsCheckbox
                label="Order status updates"
                description="Receive important purchase and delivery updates."
                checked={settings.order_updates_enabled}
                onChange={(checked) =>
                  updateField("order_updates_enabled", checked)
                }
              />
              <SettingsCheckbox
                label="Support reply updates"
                description="Receive updates when an admin replies to live chat."
                checked={settings.support_updates_enabled}
                onChange={(checked) =>
                  updateField("support_updates_enabled", checked)
                }
              />
              <SettingsCheckbox
                label="Offers and promotions"
                description="Allow optional marketing and new-product messages."
                checked={settings.marketing_emails_enabled}
                onChange={(checked) =>
                  updateField("marketing_emails_enabled", checked)
                }
              />
            </div>
          </section>

          <section className="rounded-[2rem] bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">Shopping and privacy</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Access your shopping information or remove browsing history.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Link
                href="/orders"
                className="rounded-2xl border p-4 font-semibold hover:border-red-500"
              >
                📦 My orders
              </Link>
              <Link
                href="/wishlist"
                className="rounded-2xl border p-4 font-semibold hover:border-red-500"
              >
                ♡ Wishlist
              </Link>
              <button
                type="button"
                onClick={clearRecentlyViewed}
                className="rounded-2xl border p-4 text-left font-semibold hover:border-red-500 sm:col-span-2"
              >
                🕘 Clear recently viewed history
              </button>
            </div>
          </section>

          <div className="lg:col-span-2">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full rounded-full bg-red-600 px-6 py-3.5 font-semibold text-white disabled:bg-zinc-400"
            >
              {isSaving ? "Saving settings..." : "Save account settings"}
            </button>
          </div>
        </form>

        <section className="mt-6 rounded-[2rem] bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">Password and security</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Confirm your current password before choosing a new one.
          </p>

          <form
            onSubmit={changePassword}
            className="mt-5 grid gap-4 md:grid-cols-3"
          >
            <PasswordInput
              label="Current password"
              value={currentPassword}
              onChange={setCurrentPassword}
            />
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
            <button
              type="submit"
              disabled={isChangingPassword}
              className="rounded-full bg-zinc-900 px-6 py-3 font-semibold text-white disabled:bg-zinc-400 md:col-span-3"
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
    <label className="block text-sm font-semibold">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        inputMode={inputMode}
        className="mt-2 w-full rounded-xl border px-4 py-3 font-normal outline-none focus:border-red-500 disabled:bg-zinc-100 disabled:text-zinc-500"
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
    <label className="block text-sm font-semibold">
      {label}
      <input
        type="password"
        required
        minLength={label === "Current password" ? 1 : 8}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={
          label === "Current password" ? "current-password" : "new-password"
        }
        className="mt-2 w-full rounded-xl border px-4 py-3 font-normal outline-none focus:border-red-500"
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
    <label className="flex cursor-pointer gap-3 rounded-2xl border p-4">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 accent-red-600"
      />
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-1 block text-xs text-zinc-500">{description}</span>
      </span>
    </label>
  );
}
