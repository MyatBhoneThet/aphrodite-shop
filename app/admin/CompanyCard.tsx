"use client";

import { useCallback, useEffect, useState } from "react";
import { authHeaders } from "@/app/lib/client-auth";
import { formatDateTime } from "@/app/lib/format";

type CompanyView = {
  business_name: string | null;
  licence_required: boolean;
  tax_id: string | null;
  address: string | null;
  billing_name: string | null;
  billing_phone: string | null;
  billing_email: string | null;
  licence: { status: "none" | "pending" | "verified" | "rejected"; file_name: string | null; submitted_at: string | null; review_note: string | null };
  licence_url: string | null;
  licence_content_type: string | null;
};

const BADGE = {
  none: ["Not uploaded", "bg-zinc-100 text-zinc-700"],
  pending: ["Waiting for review", "bg-amber-100 text-amber-800"],
  verified: ["Verified", "bg-emerald-100 text-emerald-800"],
  rejected: ["Rejected", "bg-red-100 text-red-700"],
} as const;

/** A wholesale account's company details and business licence, with verify / reject. Admin only. */
export default function CompanyCard({ userId }: { userId: string }) {
  const [data, setData] = useState<CompanyView | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/company/${userId}`, { headers: authHeaders(), cache: "no-store" });
      const body = (await response.json().catch(() => null)) as (CompanyView & { error?: string }) | null;
      if (!response.ok || !body) throw new Error(body?.error ?? "Could not load company details.");
      setData(body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load company details.");
    }
  }, [userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function review(decision: "verify" | "reject") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/company/${userId}`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Could not save the decision.");
      }
      setNote("");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save the decision.");
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) return <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>;
  if (!data) return <p className="text-sm text-zinc-400">Loading company details…</p>;

  const [label, style] = BADGE[data.licence.status];
  const row = (name: string, value: string | null) => (
    <div><dt className="text-xs uppercase text-zinc-400">{name}</dt><dd className="break-words font-semibold">{value || <span className="font-normal text-zinc-400">Not given</span>}</dd></div>
  );

  return (
    <div className="space-y-4">
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        {row("Business name", data.business_name)}
        {row("Tax / registration no.", data.tax_id)}
        <div className="sm:col-span-2">{row("Address", data.address)}</div>
        {row("Billing contact", [data.billing_name, data.billing_phone].filter(Boolean).join(" · ") || null)}
        {row("Billing email", data.billing_email)}
      </dl>

      <div className="rounded-xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">Business licence</p>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${style}`}>{label}</span>
        </div>
        {data.licence.file_name && <p className="mt-2 break-all text-sm text-zinc-600">{data.licence.file_name}{data.licence.submitted_at ? ` · sent ${formatDateTime(data.licence.submitted_at)}` : ""}</p>}
        {data.licence.review_note && <p className="mt-2 text-sm text-zinc-600"><strong>Note:</strong> {data.licence.review_note}</p>}
        {data.licence_required && data.licence.status !== "verified" && <p className="mt-2 text-xs font-semibold text-amber-700">Wholesale prices are held back until this is verified.</p>}

        {data.licence_url && (
          <div className="mt-3">
            {data.licence_content_type?.startsWith("image/") && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.licence_url} alt="Business licence" className="max-h-72 rounded-lg border object-contain" />
            )}
            <a href={data.licence_url} target="_blank" rel="noreferrer" className="mt-2 inline-block rounded-full border px-4 py-1.5 text-sm font-semibold hover:border-red-500 hover:text-red-600">Open licence ↗</a>
            <span className="ml-2 text-xs text-zinc-400">link expires in 5 minutes</span>
          </div>
        )}

        {data.licence.status !== "none" && data.licence.status !== "verified" && (
          <div className="mt-4 space-y-2">
            <label htmlFor={`licence-note-${userId}`} className="block text-xs font-semibold text-zinc-600">Note to the customer (needed to reject)</label>
            <input id={`licence-note-${userId}`} value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder="e.g. The photo is blurry, please upload a clearer copy" className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-red-500" />
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={() => void review("verify")} className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Verify licence</button>
              <button type="button" disabled={busy || !note.trim()} onClick={() => void review("reject")} className="rounded-full bg-red-50 px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-50">Reject</button>
            </div>
          </div>
        )}
        {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-600">{error}</p>}
      </div>
    </div>
  );
}
