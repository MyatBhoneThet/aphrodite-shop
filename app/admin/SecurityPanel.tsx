"use client";

import { useCallback, useEffect, useState } from "react";
import { authHeaders } from "@/app/lib/client-auth";
import { formatDateTime } from "@/app/lib/format";
import MfaSetup from "./MfaSetup";
import { fetchWithReauth } from "./reauth";

type Factor = { id: string; status: string; friendly_name: string | null; created_at: string | null };
type Status = { enrolled: boolean; pending: string | null; requiredForAll: boolean; factors: Factor[] };
type Overview = {
  accounts: { id: string; email: string; full_name: string | null; role: string; twoStep: boolean | null }[];
  requiredForAll: boolean;
  sessionHours: number;
  alertsConfigured: boolean;
  extraAlertRecipients: number;
};

async function errorOf(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? fallback;
}

export default function SecurityPanel({ isAdmin }: { isAdmin: boolean }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/mfa/status", { headers: authHeaders(), cache: "no-store" });
      if (!response.ok) throw new Error(await errorOf(response, "Could not load your security settings."));
      setStatus((await response.json()) as Status);
      if (isAdmin) {
        const overviewResponse = await fetch("/api/admin/security", { headers: authHeaders(), cache: "no-store" });
        if (overviewResponse.ok) setOverview((await overviewResponse.json()) as Overview);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load your security settings.");
    }
  }, [isAdmin]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function remove(factor: Factor) {
    if (!window.confirm("Remove this authenticator? You will not be able to use it to sign in any more.")) return;
    setError(""); setMessage("");
    try {
      const response = await fetchWithReauth(`/api/auth/mfa/factors/${factor.id}`, { method: "DELETE", headers: authHeaders() });
      if (!response.ok) throw new Error(await errorOf(response, "Could not remove it."));
      setMessage("Authenticator removed.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not remove it.");
    }
  }

  const verified = status?.factors.filter((factor) => factor.status === "verified") ?? [];

  return (
    <div className="mt-6 space-y-5">
      {(message || error) && <p role={error ? "alert" : "status"} className={`rounded-2xl p-4 text-sm font-semibold ${error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{error || message}</p>}

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-100 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">Two-step login</h2>
            <p className="mt-1 text-sm text-zinc-600">After your password, sign in with a 6-digit code from an authenticator app. A stolen password alone is then not enough.</p>
          </div>
          {status && <span className={`rounded-full px-3 py-1 text-xs font-black ${status.enrolled ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{status.enrolled ? "ON" : "OFF"}</span>}
        </div>

        {!status ? (
          !error && <p className="mt-4 text-sm text-zinc-400">Loading…</p>
        ) : (
          <>
            {verified.length > 0 && (
              <ul className="mt-4 divide-y rounded-xl border">
                {verified.map((factor) => (
                  <li key={factor.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold">{factor.friendly_name || "Authenticator"}</p>
                      {factor.created_at && <p className="text-xs text-zinc-500">Added {formatDateTime(factor.created_at)}</p>}
                    </div>
                    <button type="button" onClick={() => void remove(factor)} className="rounded-full bg-red-50 px-4 py-1.5 text-sm font-bold text-red-700">Remove</button>
                  </li>
                ))}
              </ul>
            )}
            {verified.length === 1 && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Tip: add a <strong>second phone or app</strong> too. If you lose this phone, the other one still gets you in.</p>}

            <div className="mt-4">
              {adding ? (
                <MfaSetup onCancel={() => setAdding(false)} onDone={() => { setAdding(false); setMessage("Authenticator added. Two-step login is on."); void load(); }} />
              ) : (
                <button type="button" onClick={() => setAdding(true)} className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-bold text-white">{verified.length ? "Add another authenticator" : "Set up two-step login"}</button>
              )}
            </div>
          </>
        )}
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-100 sm:p-6">
        <h2 className="text-lg font-black">Safeguards in place</h2>
        <ul className="mt-3 space-y-2 text-sm text-zinc-700">
          <li>⏱ Admin and staff sign-ins last <strong>{overview?.sessionHours ?? 12} hours</strong>, then you sign in again (customers stay signed in for 5 days).</li>
          <li>🔁 Deleting products, exporting orders and customers, and changing staff access ask you to <strong>confirm again</strong> (a fresh code, or your password if two-step is off).</li>
          <li>📧 Every back-office sign-in <strong>emails the account owner</strong>{overview ? (overview.alertsConfigured ? "" : " (email is not configured on the server yet)") : ""}{overview && overview.extraAlertRecipients > 0 ? ` and ${overview.extraAlertRecipients} extra address${overview.extraAlertRecipients === 1 ? "" : "es"}` : ""}.</li>
          {overview && <li>{overview.requiredForAll ? "🔒 Two-step login is compulsory for every admin and staff account." : "ℹ️ Two-step login is switched on per account. Set ADMIN_MFA_REQUIRED=all on the server to make it compulsory for everyone."}</li>}
        </ul>
      </section>

      {isAdmin && overview && (
        <section className="rounded-2xl bg-white shadow-sm ring-1 ring-zinc-100">
          <div className="border-b px-5 py-4 sm:px-6">
            <h2 className="text-lg font-black">Back-office accounts ({overview.accounts.length})</h2>
            <p className="text-sm text-zinc-500">Keep this list short. Remove anyone who no longer needs access, and give each person a strong password they use nowhere else.</p>
          </div>
          <ul className="divide-y">
            {overview.accounts.map((account) => (
              <li key={account.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-6">
                <div className="min-w-0">
                  <p className="break-words font-semibold">{account.full_name || account.email}<span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-bold capitalize text-zinc-600">{account.role}</span></p>
                  <p className="break-all text-xs text-zinc-500">{account.email}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${account.twoStep === true ? "bg-emerald-100 text-emerald-800" : account.twoStep === false ? "bg-amber-100 text-amber-800" : "bg-zinc-100 text-zinc-600"}`}>
                  {account.twoStep === true ? "Two-step on" : account.twoStep === false ? "Two-step off" : "Unknown"}
                </span>
              </li>
            ))}
          </ul>
          <ul className="space-y-1 border-t px-5 py-4 text-sm text-zinc-600 sm:px-6">
            <li>• Use a long, unique password (a password manager makes this easy).</li>
            <li>• Never share one admin login between people. Create staff accounts instead.</li>
            <li>• Check the Activity log now and then for anything you do not recognise.</li>
          </ul>
        </section>
      )}
    </div>
  );
}
