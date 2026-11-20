"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { authHeaders } from "@/app/lib/client-auth";
import AuthenticatorSelect, { loadAuthenticatorStatus, type AuthenticatorStatus } from "./AuthenticatorSelect";
import { registerReauthOpener } from "./reauth";

/** Mounted once on the admin page. Opens when a risky action asks to be confirmed. */
export default function ReauthDialog() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<AuthenticatorStatus | null>(null);
  const [selectedFactor, setSelectedFactor] = useState("");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const settle = useRef<((ok: boolean) => void) | null>(null);
  const enrolled = status?.enrolled ?? true;
  const factorId = status?.factors.length === 1 ? status.factors[0].id : selectedFactor;

  useEffect(() => {
    registerReauthOpener(async () => {
      setValue("");
      setError("");
      setSelectedFactor("");
      try {
        setStatus(await loadAuthenticatorStatus());
      } catch (reason) {
        setStatus(null);
        setError(reason instanceof Error ? reason.message : "Could not load your authenticators.");
      }
      setOpen(true);
      return new Promise<boolean>((resolve) => { settle.current = resolve; });
    });
    return () => registerReauthOpener(null);
  }, []);

  function close(ok: boolean) {
    setOpen(false);
    settle.current?.(ok);
    settle.current = null;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!status || (enrolled && !factorId) || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(enrolled ? "/api/auth/mfa/verify" : "/api/auth/reauth", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(enrolled ? { code: value, factor_id: factorId } : { password: value }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "That did not work. Please try again.");
      }
      close(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That did not work. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4" role="dialog" aria-modal="true" aria-labelledby="reauth-title">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
        <h2 id="reauth-title" className="text-lg font-black">Confirm it&apos;s you</h2>
        <p className="mt-1 text-sm text-zinc-600">
          {enrolled ? "This is a sensitive action. Enter the 6-digit code from your authenticator app." : "This is a sensitive action. Enter your password again."}
        </p>
        {status && enrolled && (
          <AuthenticatorSelect factors={status.factors} value={selectedFactor} onChange={setSelectedFactor} disabled={busy} />
        )}
        <input
          autoFocus
          required
          type={enrolled ? "text" : "password"}
          inputMode={enrolled ? "numeric" : undefined}
          autoComplete={enrolled ? "one-time-code" : "current-password"}
          maxLength={enrolled ? 7 : 200}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-label={enrolled ? "6-digit code" : "Password"}
          placeholder={enrolled ? "123456" : "Password"}
          className={`mt-4 w-full rounded-xl border px-4 py-3 outline-none focus:border-red-500 ${enrolled ? "text-center text-2xl font-bold tracking-[0.3em]" : ""}`}
        />
        {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-600">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => close(false)} className="rounded-full border px-5 py-2 text-sm font-semibold">Cancel</button>
          <button type="submit" disabled={busy || !value || !status || (enrolled && !factorId)} className="rounded-full bg-red-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "Checking…" : "Confirm"}</button>
        </div>
      </form>
    </div>
  );
}
