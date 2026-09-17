"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { authHeaders } from "../lib/client-auth";
import { formatCurrency, formatDateTime } from "../lib/format";
import { trackingLabels } from "../lib/order-tracking";
import type { DeliveryEventStage } from "../lib/supabase";
import { codReviewError, codReviewSignals } from "../lib/cod-verification";

type Order = {
  id: string; status: string; total_amount: number; shipping_name: string;
  shipping_phone: string; shipping_address: string; delivery_location_consent?: boolean;
  cod_verification_status?: string | null; courier_name?: string | null;
  delivery_tracking_number?: string | null; estimated_delivery_at?: string | null;
};
type Review = { callback_confirmed: boolean; address_confirmed: boolean; note: string; reviewed_at: string };
type Context = { review: Review | null; delivered: number; open: number; cancelled: number };
const field = "mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-red-600";
const stages: DeliveryEventStage[] = ["order_placed", "verified", "packed", "handed_to_courier", "in_transit", "out_for_delivery", "delivered", "delivery_failed"];

function localDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function CodDeliveryForm({ order, onClose, onSaved }: {
  order: Order; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [context, setContext] = useState<Context | null>(null);
  const [status, setStatus] = useState(order.cod_verification_status === "deposit_verified" ? "pending" : order.cod_verification_status ?? "pending");
  const [callback, setCallback] = useState(false);
  const [address, setAddress] = useState(false);
  const [note, setNote] = useState("");
  const [courier, setCourier] = useState(order.courier_name ?? "");
  const [tracking, setTracking] = useState(order.delivery_tracking_number ?? "");
  const [eta, setEta] = useState(localDateTime(order.estimated_delivery_at));
  const [stage, setStage] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    heading.current?.focus();
    let active = true;
    fetch(`/api/admin/orders/${order.id}/cod-review`, { headers: authHeaders(), cache: "no-store" })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load COD review.");
        if (active) {
          setContext(data);
          setCallback(data.review?.callback_confirmed ?? false);
          setAddress(data.review?.address_confirmed ?? false);
          setNote(data.review?.note ?? "");
        }
      }).catch(err => { if (active) setError(err instanceof Error ? err.message : "Unable to load COD review."); });
    return () => { active = false; };
  }, [order.id]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy || !context) return;
    if (eta && !Number.isFinite(new Date(eta).getTime())) {
      setError("Choose a valid estimated arrival date and time."); return;
    }
    const payload = {
      action: "update_delivery", verification_status: status, verification_method: "phone_callback",
      callback_confirmed: callback, address_confirmed: address, verification_note: note.trim(),
      courier_name: courier.trim() || null, tracking_number: tracking.trim() || null,
      estimated_delivery_at: eta ? new Date(eta).toISOString() : null,
      stage: stage || null, event_title: title.trim() || null,
      event_description: description.trim() || null, event_location: location.trim() || null,
    };
    const problem = codReviewError(payload);
    if (problem) { setError(problem); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to save delivery details.");
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save delivery details.");
    } finally { setBusy(false); }
  }
  return <section className="m-4 rounded-2xl border border-blue-200 bg-blue-50/40 p-5" aria-labelledby="cod-heading">
    <div className="flex items-start justify-between gap-4">
      <div><h3 id="cod-heading" ref={heading} tabIndex={-1} className="text-xl font-bold outline-none">Order tracking & COD</h3>
        <p className="mt-1 text-sm">Order {order.id.slice(0, 8)} · {order.shipping_name} · {formatCurrency(order.total_amount)}</p></div>
      <button type="button" disabled={busy} onClick={onClose} className="rounded-full border bg-white px-4 py-2">Close</button>
    </div>
    <p className="mt-3 text-sm"><strong>Call:</strong> {order.shipping_phone} · <strong>Address:</strong> {order.shipping_address}</p>
    {context && <ul className="my-4 list-disc space-y-1 rounded-xl bg-amber-50 p-4 pl-8 text-sm text-amber-950">
      {codReviewSignals({ ...context, total: order.total_amount, hasPin: Boolean(order.delivery_location_consent) }).map(signal => <li key={signal}>{signal}</li>)}
      <li>These are review reminders, not fraud findings. {context.delivered} previously delivered order(s).</li>
    </ul>}
    {error && <p role="alert" className="my-3 rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
    {!context && !error && <p role="status" className="my-3">Loading verification history…</p>}
    <form onSubmit={save}>
      <fieldset disabled={busy || !context} className="space-y-5 disabled:opacity-60">
        <legend className="py-3 font-bold">1. Staff verification — private to admins</legend>
        <label className="flex gap-3 text-sm"><input type="checkbox" checked={callback} onChange={e => setCallback(e.target.checked)} />I spoke to the customer using the order phone number and confirmed the products, quantities and cash total.</label>
        <label className="flex gap-3 text-sm"><input type="checkbox" checked={address} onChange={e => setAddress(e.target.checked)} />I checked the address, township, recipient and courier service area. A map pin alone is not verification.</label>
        <label className="block text-sm font-semibold">Callback / review note<textarea className={field} maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder="Example: Called today; customer confirmed 1 laptop and the cash total, landmark and recipient availability. No ID numbers." /></label>
        {context?.review && <p className="text-xs text-zinc-500">Last staff review: {formatDateTime(context.review.reviewed_at)}</p>}
        <label className="block text-sm font-semibold">COD decision<select className={field} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="pending">Pending — do not dispatch</option><option value="phone_verified">Phone checked — address/review still needed</option>
          <option value="approved">Approved for COD</option><option value="rejected">On hold / rejected — do not dispatch</option>
        </select></label>
        <div className="border-t pt-4"><h4 className="font-bold">2. Delivery details — visible to the customer</h4>
          <p className="mt-1 text-xs text-zinc-600">Enter real courier updates. This is not live GPS tracking. ETA uses this device’s time zone ({Intl.DateTimeFormat().resolvedOptions().timeZone}).</p></div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold">Courier<input className={field} maxLength={120} value={courier} onChange={e => setCourier(e.target.value)} /></label>
          <label className="text-sm font-semibold">Tracking / courier reference<input className={field} maxLength={120} value={tracking} onChange={e => setTracking(e.target.value)} /></label>
          <label className="text-sm font-semibold">Estimated arrival<input type="datetime-local" className={field} value={eta} onChange={e => setEta(e.target.value)} /></label>
          <label className="text-sm font-semibold">Customer tracking status<select className={field} value={stage} onChange={e => { setStage(e.target.value); setTitle(trackingLabels[e.target.value as DeliveryEventStage] ?? ""); }}><option value="">No new event</option>{stages.map(value => <option key={value} value={value}>{trackingLabels[value]}</option>)}</select></label>
        </div>
        {stage && <div className="space-y-3">
          <label className="block text-sm font-semibold">Customer-facing title<input required minLength={2} maxLength={120} className={field} value={title} onChange={e => setTitle(e.target.value)} /></label>
          <label className="block text-sm font-semibold">Update details<textarea maxLength={500} className={field} value={description} onChange={e => setDescription(e.target.value)} /></label>
          <label className="block text-sm font-semibold">Courier checkpoint / city<input maxLength={200} className={field} value={location} onChange={e => setLocation(e.target.value)} /></label>
          <p className="text-xs text-zinc-500">A timeline event does not mark cash as collected. Update the order status separately after the courier confirms delivery and payment.</p>
        </div>}
        <div className="flex gap-3"><button className="rounded-full bg-red-600 px-6 py-3 font-bold text-white" type="submit">{busy ? "Saving…" : "Save COD & delivery details"}</button><button className="rounded-full border bg-white px-5" type="button" onClick={onClose}>Cancel changes</button></div>
      </fieldset>
    </form>
  </section>;
}
