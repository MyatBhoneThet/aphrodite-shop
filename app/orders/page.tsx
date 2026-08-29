"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { authHeaders } from "../lib/client-auth";
import { formatCurrency, formatDateTime } from "../lib/format";
import { useCurrentUser } from "../lib/useCurrentUser";

type RequestStatus = "none" | "requested" | "approved" | "pickup_scheduled" | "received" | "refunded" | "rejected";
type OrderStatus = "pending" | "confirmed" | "shipped" | "delivered" | "cancelled" | "returned";
type ReturnReason = "defective" | "wrong_item" | "wrong_color" | "wrong_storage" | "damaged_in_transit" | "other";
type PickupMethod = "courier_pickup" | "store_dropoff";

type Order = {
  id: string;
  status: OrderStatus;
  total_amount: number;
  shipping_address: string;
  payment_status: "unpaid" | "collected" | "refunded";
  cancellation_request_status: RequestStatus;
  cancellation_reason: string | null;
  return_request_status: RequestStatus;
  return_reason: string | null;
  return_reason_code?: ReturnReason | null;
  return_pickup_method?: PickupMethod | null;
  return_pickup_scheduled_for?: string | null;
  return_pickup_instructions?: string | null;
  return_pickup_tracking_number?: string | null;
  return_received_at?: string | null;
  refund_method?: string | null;
  refund_reference?: string | null;
  refund_amount?: number | null;
  refund_completed_at?: string | null;
  delivered_at?: string | null;
  receipt_number?: string | null;
  admin_order_note: string | null;
  created_at: string;
  order_items?: { id: string; product_id: number; quantity: number; unit_price: number; product?: { name: string } | null }[];
};

type ReturnForm = { reason: string; reasonCode: ReturnReason; pickupMethod: PickupMethod; pickupAddress: string };
const EMPTY_RETURN_FORM: ReturnForm = { reason: "", reasonCode: "defective", pickupMethod: "courier_pickup", pickupAddress: "" };

const statusStyles: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-800",
  returned: "bg-orange-100 text-orange-800",
};
const returnLabels: Record<ReturnReason, string> = {
  defective: "Machine has a fault or error",
  wrong_item: "Wrong product received",
  wrong_color: "Wrong colour received",
  wrong_storage: "Wrong storage size received",
  damaged_in_transit: "Damaged during delivery",
  other: "Other eligible problem",
};
const humanize = (value: string) => value.replaceAll("_", " ");
const returnWindowIsOpen = (order: Order) =>
  !order.delivered_at || Date.now() <= new Date(order.delivered_at).getTime() + 7 * 24 * 60 * 60 * 1000;

export default function OrdersPage() {
  const { user, status: userStatus } = useCurrentUser();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancellationReasons, setCancellationReasons] = useState<Record<string, string>>({});
  const [returnForms, setReturnForms] = useState<Record<string, ReturnForm>>({});
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadOrders() {
      if (userStatus !== "ready" || !user) { setIsLoading(false); return; }
      const response = await fetch("/api/orders", { headers: authHeaders() });
      if (response.ok) {
        const data = (await response.json()) as { orders: Order[] };
        setOrders(data.orders);
      } else setError("Unable to load your orders. Please refresh the page.");
      setIsLoading(false);
    }
    void loadOrders();
  }, [userStatus, user]);

  function returnForm(orderId: string) {
    return returnForms[orderId] ?? { ...EMPTY_RETURN_FORM, pickupAddress: orders.find((order) => order.id === orderId)?.shipping_address ?? "" };
  }
  function updateReturnForm(orderId: string, update: Partial<ReturnForm>) {
    setReturnForms((current) => ({ ...current, [orderId]: { ...returnForm(orderId), ...update } }));
  }

  async function submitRequest(order: Order, body: Record<string, unknown>) {
    setError(""); setMessage(""); setProcessingOrderId(order.id);
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => null)) as { order?: Order; error?: string } | null;
      if (!response.ok || !data?.order) throw new Error(data?.error ?? "Unable to submit your request.");
      setOrders((current) => current.map((item) => item.id === order.id ? data.order! : item));
      setCancellationReasons((current) => ({ ...current, [order.id]: "" }));
      setReturnForms((current) => ({ ...current, [order.id]: { ...EMPTY_RETURN_FORM } }));
      setMessage(body.action === "request_return" ? "Return request sent. Our team will review it before arranging pickup or drop-off." : "Cancellation request sent for administrator review.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to submit your request.");
    } finally { setProcessingOrderId(null); }
  }

  async function submitCancellation(order: Order) {
    const reason = cancellationReasons[order.id]?.trim() ?? "";
    if (reason.length < 3) { setError("Please enter a short reason for the cancellation."); return; }
    await submitRequest(order, { action: "request_cancellation", reason });
  }
  async function submitReturn(order: Order) {
    const form = returnForm(order.id);
    if (form.reason.trim().length < 3) { setError("Please describe what is wrong with the item."); return; }
    if (form.pickupMethod === "courier_pickup" && form.pickupAddress.trim().length < 5) { setError("Enter the address where the courier should collect the item."); return; }
    await submitRequest(order, {
      action: "request_return",
      reason: form.reason.trim(),
      reason_code: form.reasonCode,
      pickup_method: form.pickupMethod,
      pickup_address: form.pickupMethod === "courier_pickup" ? form.pickupAddress.trim() : null,
    });
  }

  if (userStatus === "checking" || isLoading) return <main className="flex min-h-screen items-center justify-center bg-white">Loading your orders...</main>;
  if (!user) return <main className="flex min-h-screen items-center justify-center bg-white px-5 text-center"><div><h1 className="text-3xl font-bold">Login to view your orders</h1><div className="mt-6 flex justify-center gap-3"><Link href="/login" className="rounded-full bg-red-600 px-6 py-3 font-semibold text-white">Login</Link><Link href="/" className="rounded-full border px-6 py-3 font-semibold">Back to Store</Link></div></div></main>;

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
        <Link href="/" aria-label="Aphrodite Myanmar home"><Image src="/brand/aphrodite-myanmar.png" alt="Aphrodite Myanmar" width={218} height={77} className="h-12 w-auto" priority /></Link>
        <div className="flex gap-2"><Link href="/returns" className="rounded-full border px-4 py-2 text-sm font-semibold">Return policy</Link><Link href="/" className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">Store</Link></div>
      </div></header>

      <section className="mx-auto max-w-5xl px-5 py-10">
        <div className="rounded-3xl bg-zinc-950 p-8 text-white"><p className="text-sm font-bold uppercase tracking-[0.25em] text-red-400">Customer care</p><h1 className="mt-2 text-4xl font-black">Orders, receipts and returns</h1><p className="mt-3 max-w-2xl text-zinc-300">Track delivery, print your receipt, and request an eligible return within 7 days after delivery.</p></div>
        {error && <p role="alert" className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>}
        {message && <p role="status" className="mt-5 rounded-2xl bg-green-50 p-4 text-sm font-semibold text-green-700">{message}</p>}

        {orders.length === 0 ? <p className="mt-8 rounded-3xl bg-white p-10 text-center text-zinc-500 shadow-sm">You haven&apos;t placed any orders yet.</p> : (
          <div className="mt-8 space-y-6">{orders.map((order) => {
            const canCancel = (order.status === "pending" || order.status === "confirmed") && !["requested", "approved"].includes(order.cancellation_request_status);
            const returnOpen = returnWindowIsOpen(order);
            const canReturn = order.status === "delivered" && returnOpen && !["requested", "approved", "pickup_scheduled", "received", "refunded"].includes(order.return_request_status);
            const form = returnForm(order.id);
            return <article key={order.id} className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b p-6"><div><p className="text-xl font-black">Order #{order.id.slice(0, 8).toUpperCase()}</p><p className="mt-1 text-sm text-zinc-500">{formatDateTime(order.created_at)}</p>{order.receipt_number && <p className="mt-1 text-xs font-semibold text-zinc-500">Receipt {order.receipt_number}</p>}</div><div className="flex flex-wrap items-center gap-2">{order.receipt_number && <Link href={`/orders/${order.id}/receipt`} className="rounded-full border px-4 py-2 text-xs font-bold hover:border-red-500 hover:text-red-600">View / print receipt</Link>}<span className={`rounded-full px-3 py-2 text-xs font-bold capitalize ${statusStyles[order.status]}`}>{order.status}</span></div></div>
              <div className="p-6">
                <div className="grid gap-6 md:grid-cols-[1fr_auto]"><div className="space-y-2 text-sm text-zinc-700">{(order.order_items ?? []).map((item) => <p key={item.id} className="flex justify-between gap-4"><span>{item.product?.name ?? `Product #${item.product_id}`} × {item.quantity}</span><span className="font-semibold">{formatCurrency(item.unit_price * item.quantity)}</span></p>)}</div><p className="text-2xl font-black">{formatCurrency(order.total_amount)}</p></div>
                <div className="mt-5 grid gap-3 rounded-2xl bg-zinc-50 p-4 text-sm sm:grid-cols-3"><div><p className="text-xs uppercase text-zinc-400">Payment</p><p className="font-semibold">Cash on delivery</p></div><div><p className="text-xs uppercase text-zinc-400">Payment status</p><p className="font-semibold capitalize">{order.payment_status}</p></div><div><p className="text-xs uppercase text-zinc-400">Delivery address</p><p className="font-semibold">{order.shipping_address}</p></div></div>
                {order.cancellation_request_status !== "none" && <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-950"><p className="font-bold capitalize">Cancellation: {humanize(order.cancellation_request_status)}</p>{order.cancellation_reason && <p className="mt-1">{order.cancellation_reason}</p>}</div>}
                {order.return_request_status !== "none" && <div className="mt-4 rounded-2xl bg-orange-50 p-5 text-sm text-orange-950"><p className="font-bold capitalize">Return: {humanize(order.return_request_status)}</p>{order.return_reason_code && <p className="mt-1">Problem: {returnLabels[order.return_reason_code]}</p>}{order.return_reason && <p className="mt-1">Details: {order.return_reason}</p>}{order.return_pickup_method && <p className="mt-1">Method: {humanize(order.return_pickup_method)}</p>}{order.return_pickup_scheduled_for && <p className="mt-1">Scheduled: {formatDateTime(order.return_pickup_scheduled_for)}</p>}{order.return_pickup_instructions && <p className="mt-1">Instructions: {order.return_pickup_instructions}</p>}{order.return_pickup_tracking_number && <p className="mt-1">Tracking: {order.return_pickup_tracking_number}</p>}{order.return_received_at && <p className="mt-1">Received by store: {formatDateTime(order.return_received_at)}</p>}{order.refund_completed_at && <p className="mt-1 font-semibold">Refund recorded: {formatCurrency(order.refund_amount ?? 0)} by {humanize(order.refund_method ?? "selected method")}{order.refund_reference ? ` (${order.refund_reference})` : ""}</p>}</div>}
                {order.admin_order_note && <p className="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">Administrator note: {order.admin_order_note}</p>}
                {order.status === "delivered" && !returnOpen && order.return_request_status === "none" && <p className="mt-4 rounded-xl bg-zinc-100 p-3 text-sm text-zinc-600">The 7-day online return request window has closed. Contact support if you have a warranty question.</p>}

                {canReturn && <div className="mt-6 border-t pt-6"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-black">Request a return</h2><p className="text-sm text-zinc-500">Choose the exact problem and how you want to hand the machine back.</p></div><Link href="/returns" className="text-sm font-semibold text-red-600 hover:underline">Read the return policy</Link></div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Problem<select value={form.reasonCode} onChange={(event) => updateReturnForm(order.id, { reasonCode: event.target.value as ReturnReason })} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 font-normal outline-none focus:border-red-500">{Object.entries(returnLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm font-semibold">Return method<select value={form.pickupMethod} onChange={(event) => updateReturnForm(order.id, { pickupMethod: event.target.value as PickupMethod })} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 font-normal outline-none focus:border-red-500"><option value="courier_pickup">Courier pickup</option><option value="store_dropoff">Drop off at store</option></select></label></div>
                  {form.pickupMethod === "courier_pickup" && <label className="mt-4 block text-sm font-semibold">Pickup address<textarea rows={2} maxLength={500} value={form.pickupAddress} onChange={(event) => updateReturnForm(order.id, { pickupAddress: event.target.value })} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal outline-none focus:border-red-500" /></label>}
                  <label className="mt-4 block text-sm font-semibold">What happened?<textarea rows={3} maxLength={500} value={form.reason} onChange={(event) => updateReturnForm(order.id, { reason: event.target.value })} placeholder="Example: I ordered black 512 GB, but received silver 256 GB." className="mt-2 w-full rounded-xl border px-4 py-3 font-normal outline-none focus:border-red-500" /></label>
                  <p className="mt-3 text-xs text-zinc-500">Keep the machine, accessories, packaging, serial labels, and proof of order together. Remove passwords and back up personal data before handover.</p><button type="button" disabled={processingOrderId === order.id} onClick={() => submitReturn(order)} className="mt-4 rounded-full bg-red-600 px-6 py-3 text-sm font-bold text-white disabled:opacity-50">{processingOrderId === order.id ? "Sending request..." : "Send return request"}</button>
                </div>}
                {canCancel && !canReturn && <div className="mt-6 border-t pt-6"><label htmlFor={`cancel-${order.id}`} className="block text-sm font-semibold">Why are you cancelling this order?</label><textarea id={`cancel-${order.id}`} rows={2} maxLength={500} value={cancellationReasons[order.id] ?? ""} onChange={(event) => setCancellationReasons((current) => ({ ...current, [order.id]: event.target.value }))} className="mt-2 w-full rounded-xl border px-4 py-3 outline-none focus:border-red-500" /><button type="button" disabled={processingOrderId === order.id} onClick={() => submitCancellation(order)} className="mt-3 rounded-full border border-red-600 px-5 py-2 text-sm font-bold text-red-600 disabled:opacity-50">{processingOrderId === order.id ? "Sending request..." : "Request cancellation"}</button></div>}
              </div>
            </article>;
          })}</div>
        )}
      </section>
    </main>
  );
}
