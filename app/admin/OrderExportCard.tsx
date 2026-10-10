"use client";

import { useState } from "react";
import { authHeaders } from "@/app/lib/client-auth";
import { fetchWithReauth } from "./reauth";

const isoDay = (date: Date) => {
  // Local calendar day, not UTC, so "today" matches what the admin sees.
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

export default function OrderExportCard() {
  const [from, setFrom] = useState(() => { const now = new Date(); return isoDay(new Date(now.getFullYear(), now.getMonth(), 1)); });
  const [to, setTo] = useState(() => isoDay(new Date()));
  const [kind, setKind] = useState<"orders" | "customers">("orders");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function download() {
    setBusy(true);
    setError("");
    try {
      const response = await fetchWithReauth(`/api/admin/reports/orders?kind=${kind}&from=${from}&to=${to}`, { headers: authHeaders() });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Could not create the export.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `aphrodite-${kind}-${from}-to-${to}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create the export.");
    } finally {
      setBusy(false);
    }
  }

  const field = "mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-semibold text-slate-900";

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-red-600">Accounting</p>
      <h2 className="mt-2 text-lg font-black text-slate-950">Export orders or customers</h2>
      <p className="mt-1 text-sm leading-6 text-slate-500">
        Download a CSV for any date range (up to a year, Yangon time). Includes customer names, phones and addresses, so keep it private.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-bold text-slate-600">What to export
          <select value={kind} onChange={(event) => setKind(event.target.value as "orders" | "customers")} className={field}>
            <option value="orders">One row per order</option>
            <option value="customers">One row per customer</option>
          </select>
        </label>
        <label className="text-xs font-bold text-slate-600">From
          <input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} className={field} />
        </label>
        <label className="text-xs font-bold text-slate-600">To
          <input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} className={field} />
        </label>
      </div>

      {error && <p role="alert" className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
      <button
        type="button"
        onClick={() => void download()}
        disabled={busy || !from || !to}
        className="mt-4 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Preparing…" : "Download CSV"}
      </button>
    </section>
  );
}
