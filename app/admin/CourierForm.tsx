"use client";

import { FormEvent, useState } from "react";
import { authHeaders } from "@/app/lib/client-auth";

type CourierOrder = { id: string; courier_name?: string | null; delivery_tracking_number?: string | null; estimated_delivery_at?: string | null };

/** Courier name, tracking number and ETA: what a packer saves before handing a parcel over. */
export default function CourierForm({ order, onClose, onSaved }: { order: CourierOrder; onClose: () => void; onSaved: () => void | Promise<void> }) {
  const [courier, setCourier] = useState(order.courier_name ?? "");
  const [tracking, setTracking] = useState(order.delivery_tracking_number ?? "");
  const [eta, setEta] = useState(order.estimated_delivery_at ? order.estimated_delivery_at.slice(0, 10) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_courier",
          courier_name: courier,
          tracking_number: tracking,
          estimated_delivery_at: eta ? new Date(`${eta}T12:00:00+06:30`).toISOString() : null,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Could not save the courier details.");
      }
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save the courier details.");
    } finally {
      setBusy(false);
    }
  }

  const field = "mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-red-500";
  return (
    <form onSubmit={submit} className="m-4 rounded-2xl border border-blue-200 bg-blue-50 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold">Courier and tracking</h3>
          <p className="text-sm text-zinc-600">Order #{order.id.slice(0, 8).toUpperCase()}. Save these before handing the parcel to the courier.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-full px-2 text-xl leading-none text-zinc-500 hover:text-zinc-800">×</button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-bold text-zinc-600">Courier
          <input required value={courier} onChange={(event) => setCourier(event.target.value)} maxLength={120} placeholder="e.g. Royal Express" className={field} />
        </label>
        <label className="text-xs font-bold text-zinc-600">Tracking / reference no.
          <input required value={tracking} onChange={(event) => setTracking(event.target.value)} maxLength={120} className={field} />
        </label>
        <label className="text-xs font-bold text-zinc-600">Expected delivery (optional)
          <input type="date" value={eta} onChange={(event) => setEta(event.target.value)} className={field} />
        </label>
      </div>
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={busy} className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
        <button type="button" onClick={onClose} className="rounded-full border bg-white px-5 py-2 text-sm font-semibold">Cancel</button>
      </div>
    </form>
  );
}
