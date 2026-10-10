"use client";

import { FormEvent, useState } from "react";
import { authHeaders } from "@/app/lib/client-auth";
import { qrImageSrc } from "@/app/lib/qr-src";
import { fetchWithReauth } from "./reauth";

type Enrollment = { factor_id: string; qr_code: string; secret: string };

/** Add an authenticator: scan the QR code, then type the first 6-digit code to prove it works. */
export default function MfaSetup({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) {
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setBusy(true);
    setError("");
    try {
      const response = await fetchWithReauth("/api/auth/mfa/enroll", { method: "POST", headers: authHeaders() });
      const body = (await response.json().catch(() => null)) as (Enrollment & { error?: string }) | null;
      if (!response.ok || !body) throw new Error(body?.error ?? "Could not start setup.");
      setEnrollment(body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not start setup.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(event: FormEvent) {
    event.preventDefault();
    if (!enrollment) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ factor_id: enrollment.factor_id, code }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "That code did not work.");
      }
      onDone();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That code did not work.");
    } finally {
      setBusy(false);
    }
  }

  if (!enrollment) {
    return (
      <div>
        <p className="text-sm text-zinc-600">
          You will need an authenticator app on your phone, such as Microsoft Authenticator, Google Authenticator or Authy.
        </p>
        {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => void start()} disabled={busy} className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? "Starting…" : "Start setup"}</button>
          {onCancel && <button type="button" onClick={onCancel} className="rounded-full border px-5 py-2.5 text-sm font-semibold">Cancel</button>}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={confirm} className="space-y-5">
      <ol className="list-decimal space-y-4 pl-5 text-sm text-zinc-700">
        <li>
          Open your authenticator app, tap <strong>Add account</strong> (or the + button), choose <strong>Other / work or school account</strong> and scan this code.
          <div className="mt-3 inline-block rounded-2xl border bg-white p-3">
            {qrImageSrc(enrollment.qr_code) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrImageSrc(enrollment.qr_code)} alt="QR code to scan with your authenticator app" className="h-48 w-48" />
            ) : (
              <p className="h-48 w-48 p-2 text-xs text-zinc-500">The QR code could not be shown. Use the key below instead.</p>
            )}
          </div>
        </li>
        <li>
          Can&apos;t scan? In the app choose <strong>Other account</strong>, then <strong>Enter code manually</strong>, and type this key. <strong>Save it somewhere safe</strong>: it lets you add a new phone later.
          <code className="mt-2 block break-all rounded-xl bg-zinc-100 px-3 py-2 font-mono text-xs select-all">{enrollment.secret}</code>
        </li>
        <li>
          Type the 6-digit code the app shows now:
          <input
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            aria-label="6-digit code"
            placeholder="123456"
            className="mt-2 block w-48 rounded-xl border px-4 py-3 text-center text-2xl font-bold tracking-[0.3em] outline-none focus:border-red-500"
          />
        </li>
      </ol>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy || !code} className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? "Checking…" : "Turn on two-step login"}</button>
        {onCancel && <button type="button" onClick={onCancel} className="rounded-full border px-5 py-2.5 text-sm font-semibold">Cancel</button>}
      </div>
    </form>
  );
}
