"use client";

import { FormEvent, useState } from "react";
import { authHeaders } from "@/app/lib/client-auth";
import MfaSetup from "./MfaSetup";

/** Shown instead of the dashboard while a signed-in admin still owes a code (or must set one up). */
export default function MfaGate({ pending, onLogout }: { pending: "verify" | "enroll"; onLogout: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "That code did not work.");
      }
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That code did not work.");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f6f9] px-5 text-zinc-950">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow">
        <p className="text-4xl" aria-hidden>🔐</p>
        {pending === "verify" ? (
          <form onSubmit={submit}>
            <h1 className="mt-3 text-2xl font-black">Two-step login</h1>
            <p className="mt-2 text-sm text-zinc-600">Open your authenticator app and enter the 6-digit code for Aphrodite Admin.</p>
            <input
              autoFocus
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              aria-label="6-digit code"
              placeholder="123456"
              className="mt-5 w-full rounded-xl border px-4 py-3 text-center text-3xl font-bold tracking-[0.3em] outline-none focus:border-red-500"
            />
            {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-600">{error}</p>}
            <button type="submit" disabled={busy || !code} className="mt-4 w-full rounded-full bg-red-600 px-5 py-3 font-bold text-white disabled:opacity-50">{busy ? "Checking…" : "Continue"}</button>
            <p className="mt-4 text-xs text-zinc-500">Lost your phone? Ask the store owner to remove your authenticator in the Supabase dashboard, then sign in again to set up a new one.</p>
          </form>
        ) : (
          <div>
            <h1 className="mt-3 text-2xl font-black">Set up two-step login</h1>
            <p className="mt-2 mb-5 text-sm text-zinc-600">Admin accounts must use an authenticator app before they can open the dashboard.</p>
            <MfaSetup onDone={() => window.location.reload()} />
          </div>
        )}
        <button type="button" onClick={onLogout} className="mt-5 w-full rounded-full border px-5 py-2 text-sm font-semibold">Sign out</button>
      </div>
    </main>
  );
}
