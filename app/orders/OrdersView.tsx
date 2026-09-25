"use client";

import Image from "next/image";
import OrderTracking from "../components/OrderTracking";
import OrderHelpButton from "../components/OrderHelpButton";
import ReturnWizard from "../components/ReturnWizard";
import RefundTracker from "../components/RefundTracker";
import NextStep from "../components/NextStep";
import Link from "next/link";
import OrderItemsList, { type OrderLine } from "../components/OrderItemsList";
import { useCallback, useEffect, useState } from "react";
import { authHeaders } from "../lib/client-auth";
import { formatCurrency, formatDateTime } from "../lib/format";
import { useCurrentUser } from "../lib/useCurrentUser";
import { useLanguage } from "../lib/language";

const MAX_DELIVERY_ATTEMPTS = 3;

type RequestStatus = "none" | "requested" | "approved" | "pickup_scheduled" | "received" | "refunded" | "rejected";
type OrderStatus = "pending" | "confirmed" | "shipped" | "delivered" | "cancelled" | "returned";
type ReturnReason = "defective" | "wrong_item" | "wrong_color" | "wrong_storage" | "damaged_in_transit" | "other";
type PickupMethod = "courier_pickup" | "store_dropoff";
type DeliveryEvent = { id: string; stage: string; title: string; description?: string | null; happened_at: string };
type ReturnEvidence = { id: string; evidence_kind: string; file_name?: string | null; created_at: string };

/** One returned line, with its own decision — see ReturnWizard. */
type ItemReturnStatus =
  | "requested"
  | "more_info_needed"
  | "approved"
  | "declined"
  | "collected"
  | "inspected"
  | "refund_approved"
  | "completed"
  | "cancelled";

type ItemReturn = {
  id: string;
  order_id: string;
  order_item_id: string;
  quantity: number;
  reason_code: ReturnReason;
  description: string;
  preferred_resolution: "replacement" | "refund" | "repair";
  resolution_granted: "replacement" | "refund" | "repair" | null;
  status: ItemReturnStatus;
  admin_decision_note: string | null;
  review_requested_at: string | null;
  refund_amount?: number | null;
  refund_reference?: string | null;
  refund_sent_at?: string | null;
  expected_refund_at?: string | null;
  delay_reason?: string | null;
  preferred_service_at?: string | null;
  created_at: string;
  order_items?: { products?: { name?: string | null } | null } | null;
};

type Order = {
  id: string;
  status: OrderStatus;
  total_amount: number;
  shipping_address: string;
  payment_status: "unpaid" | "collected" | "refunded";
  payment_method?: "cash_on_delivery" | "bank_transfer" | "mmqr";
  payment_account?: "kbz" | "aya" | "mmqr" | null;
  payment_verification_status?:
    | "not_required"
    | "pending"
    | "verified"
    | "rejected"
    | "correction_requested";
  payment_rejected_reason?: string | null;
  payment_amount_received?: number | null;
  payment_correction_reason?:
    | "short_payment"
    | "overpaid"
    | "unclear_slip"
    | "wrong_account"
    | "other"
    | null;
  payment_slips?: { id: string; file_name?: string | null; created_at: string }[];
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
  cancellation_refund_status?: "none" | "details_required" | "pending" | "sent";
  cancellation_refund_bank_name?: string | null;
  cancellation_refund_account_name?: string | null;
  cancellation_refund_account_number?: string | null;
  delivered_at?: string | null;
  receipt_number?: string | null;
  admin_order_note: string | null;
  cod_verification_status?: string | null;
  courier_name?: string | null;
  delivery_tracking_number?: string | null;
  estimated_delivery_at?: string | null;
  delivery_status_detail?: string | null;
  delivery_events?: DeliveryEvent[];
  return_evidence?: ReturnEvidence[];
  created_at: string;
  order_items?: OrderLine[];
};

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

export default function OrdersView({ orderId }: { orderId?: string }) {
  const { user, status: userStatus } = useCurrentUser();
  const { t } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [itemReturns, setItemReturns] = useState<ItemReturn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancellationReasons, setCancellationReasons] = useState<Record<string, string>>({});
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [slipFiles, setSlipFiles] = useState<Record<string, File | null>>({});
  const [uploadingOrderId, setUploadingOrderId] = useState<string | null>(null);
  // Which order currently has the three-step return wizard open.
  const [returnOrderId, setReturnOrderId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [refundDetails, setRefundDetails] = useState<
    Record<string, { bankName: string; accountName: string; accountNumber: string }>
  >({});

  const refreshOrders = useCallback(async () => {
    const response = await fetch("/api/orders", { headers: authHeaders(), cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as { orders: Order[] };
    setOrders(data.orders);
  }, []);

  const refreshReturns = useCallback(async () => {
    const response = await fetch("/api/returns", { headers: authHeaders(), cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as { requests: ItemReturn[] };
    setItemReturns(data.requests ?? []);
  }, []);

  /** Sends the transfer slip, then refreshes just this order. */
  async function submitSlip(order: Order) {
    const file = slipFiles[order.id];
    if (!file || uploadingOrderId) return;

    setError("");
    setMessage("");
    setUploadingOrderId(order.id);

    try {
      const body = new FormData();
      body.append("file", file);

      const response = await fetch(`/api/orders/${order.id}/payment-slip`, {
        method: "POST",
        headers: authHeaders(),
        body,
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Unable to upload the slip.");

      const refreshed = await fetch(`/api/orders/${order.id}`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      const refreshedData = (await refreshed.json().catch(() => null)) as { order?: Order } | null;
      if (refreshed.ok && refreshedData?.order) {
        const updated = refreshedData.order;
        setOrders((current) => current.map((item) => (item.id === order.id ? updated : item)));
      }

      setSlipFiles((current) => ({ ...current, [order.id]: null }));
      setMessage("Thank you. We will check your payment and update this order.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload the slip.");
    } finally {
      setUploadingOrderId(null);
    }
  }

  useEffect(() => {
    let active = true;
    let loading = false;
    const controller = new AbortController();
    async function loadOrders() {
      if (userStatus !== "ready" || !user) { setIsLoading(false); return; }
      if (loading) return;
      loading = true;
      try {
        const response = await fetch("/api/orders", { headers: authHeaders(), cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Unable to refresh your orders. Please try again.");
        const data = (await response.json()) as { orders: Order[] };
        if (active) setOrders(data.orders);
        // Returns are listed separately: one order can hold several, each with
        // its own decision.
        if (active) await refreshReturns();
      } catch (error) {
        if (active) setError(error instanceof Error ? error.message : "Unable to load orders.");
      } finally {
        loading = false;
        if (active) setIsLoading(false);
      }
    }
    void loadOrders();
    const refresh = () => { if (document.visibilityState === "visible") void loadOrders(); };
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => { active = false; controller.abort(); window.clearInterval(interval); window.removeEventListener("focus", refresh); };
  }, [userStatus, user, refreshReturns]);

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
      setMessage("Cancellation request sent for administrator review.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to submit your request.");
    } finally { setProcessingOrderId(null); }
  }

  async function submitCancellationRefundDetails(order: Order) {
    const details = refundDetails[order.id] ?? {
      bankName: "",
      accountName: "",
      accountNumber: "",
    };
    if (
      details.bankName.trim().length < 2 ||
      details.accountName.trim().length < 2 ||
      details.accountNumber.trim().length < 5
    ) {
      setError("Enter the bank or wallet name, account holder, and account number.");
      return;
    }

    setError("");
    setMessage("");
    setProcessingOrderId(order.id);
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit_cancellation_refund_details",
          bank_name: details.bankName.trim(),
          account_name: details.accountName.trim(),
          account_number: details.accountNumber.trim(),
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        order?: Order;
        error?: string;
      } | null;
      if (!response.ok || !data?.order) {
        throw new Error(data?.error ?? "Unable to save refund bank information.");
      }
      setOrders((current) =>
        current.map((item) => (item.id === order.id ? data.order! : item))
      );
      setMessage("Refund bank information saved. The store will process your refund.");
    } catch (refundError) {
      setError(
        refundError instanceof Error
          ? refundError.message
          : "Unable to save refund bank information."
      );
    } finally {
      setProcessingOrderId(null);
    }
  }

  async function submitCancellation(order: Order) {
    const reason = cancellationReasons[order.id]?.trim() ?? "";
    if (reason.length < 3) { setError("Please enter a short reason for the cancellation."); return; }
    await submitRequest(order, { action: "request_cancellation", reason });
  }

  /** Asks a second person to look at a declined return again. */
  async function askForReview(request: ItemReturn) {
    const note = reviewNotes[request.id]?.trim() ?? "";
    if (note.length < 10) { setError(t("return.askReviewHelp")); return; }

    setError(""); setMessage("");

    try {
      const response = await fetch(`/api/returns/${request.id}`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_review", note }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Unable to send your request.");

      setReviewNotes((current) => ({ ...current, [request.id]: "" }));
      setMessage(t("return.reviewSent"));
      await refreshReturns();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Unable to send your request.");
    }
  }

  if (userStatus === "checking" || isLoading) return <main className="flex min-h-screen items-center justify-center bg-white">Loading your orders...</main>;
  if (!user) return <main className="flex min-h-screen items-center justify-center bg-white px-5 text-center"><div><h1 className="text-3xl font-bold">Login to view your orders</h1><div className="mt-6 flex justify-center gap-3"><Link href="/login" className="rounded-full bg-red-600 px-6 py-3 font-semibold text-white">Login</Link><Link href="/" className="rounded-full border px-6 py-3 font-semibold">Back to Store</Link></div></div></main>;

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
        <Link href="/" aria-label="Aphrodite Myanmar home"><Image src="/brand/aphrodite-myanmar.png" alt="Aphrodite Myanmar" width={218} height={77} className="h-12 w-auto" priority /></Link>
        <div className="flex gap-2"><Link href="/returns" className="rounded-full border px-4 py-2 text-sm font-semibold">{t("nav.returnPolicy")}</Link><Link href="/" className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">Store</Link></div>
      </div></header>

      <section className="mx-auto max-w-5xl px-5 py-10">
        <div className="rounded-3xl bg-zinc-950 p-8 text-white"><p className="text-sm font-bold uppercase tracking-[0.25em] text-red-400">Customer care</p><h1 className="mt-2 text-4xl font-black">Orders, receipts and returns</h1><p className="mt-3 max-w-2xl text-zinc-300">Tracking refreshes every 30 seconds. Track delivery, print your receipt, and request an eligible return within 7 days after delivery.</p></div>
        {error && <p role="alert" className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>}
        {message && <p role="status" className="mt-5 rounded-2xl bg-green-50 p-4 text-sm font-semibold text-green-700">{message}</p>}

        {orderId && <Link href="/orders" className="mt-6 inline-block rounded-full border bg-white px-4 py-2 text-sm font-semibold hover:border-red-500 hover:text-red-600">← All orders</Link>}
        {!orderId && orders.length > 0 ? (
          <ul className="mt-8 space-y-3">{orders.map((order) => {
            const lines = order.order_items ?? [];
            const count = lines.reduce((sum, line) => sum + line.quantity, 0);
            return <li key={order.id}><Link href={`/orders/${order.id}`} className="grid min-w-0 gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-red-300 hover:shadow-md md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
              <div className="flex min-w-0 max-w-full shrink-0 -space-x-3 overflow-hidden">{lines.slice(0, 3).map((line) => line.product?.image ? <img key={line.id} src={line.product.image} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-xl border-2 border-white bg-white object-contain sm:h-14 sm:w-14" /> : <span key={line.id} className="h-12 w-12 shrink-0 rounded-xl border-2 border-white bg-zinc-100 sm:h-14 sm:w-14" />)}{lines.length > 3 && <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-white bg-zinc-100 text-xs font-bold text-zinc-600 sm:h-14 sm:w-14">+{lines.length - 3}</span>}</div>
              <div className="min-w-0">
                <p className="break-normal font-black">Order #{order.id.slice(0, 8).toUpperCase()}</p>
                <p className="text-sm text-zinc-500">{formatDateTime(order.created_at)} · {count} item{count === 1 ? "" : "s"}</p>
                {order.cancellation_refund_status === "details_required" && (
                  <p className="mt-2 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900">
                    Action required: add your refund bank information →
                  </p>
                )}
                {order.cancellation_refund_status === "pending" && (
                  <p className="mt-2 inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-900">
                    Refund pending
                  </p>
                )}
              </div>
              <div className="flex min-w-0 items-center justify-between gap-3 md:flex-col md:items-end">
                <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold capitalize ${statusStyles[order.status]}`}>{order.status}</span>
                <p className="min-w-0 text-right text-base font-black tabular-nums sm:text-lg">{formatCurrency(order.total_amount)}</p>
                <span aria-hidden className="hidden text-zinc-400 md:block">›</span>
              </div>
            </Link></li>;
          })}</ul>
        ) : orders.length === 0 || (orderId && !orders.some((order) => order.id === orderId)) ? <p className="mt-8 rounded-3xl bg-white p-10 text-center text-zinc-500 shadow-sm">{orderId ? "We couldn't find that order." : "You haven't placed any orders yet."}</p> : (
          <div className="mt-8 space-y-6">{orders.filter((order) => order.id === orderId).map((order) => {
            const canCancel = (order.status === "pending" || order.status === "confirmed") && !["requested", "approved"].includes(order.cancellation_request_status);
            // Bank transfer and MMQR are checked against a slip, so the COD
            // callback wording below does not apply to them.
            const isPrepaid =
              order.payment_method === "bank_transfer" || order.payment_method === "mmqr";
            const returnOpen = returnWindowIsOpen(order);
            const canReturn = order.status === "delivered" && returnOpen;
            const orderReturns = itemReturns.filter((request) => request.order_id === order.id);
            const deliveryEvents = [...(order.delivery_events ?? [])].sort(
              (left, right) => Date.parse(left.happened_at) - Date.parse(right.happened_at)
            );
            const failedAttempts = deliveryEvents.filter((event) => event.stage === "delivery_failed").length;
            // Only while the newest update is a failed attempt: once the courier
            // is on the way again, the normal delivery details come back.
            const awaitingRetry =
              order.status === "shipped" &&
              deliveryEvents[deliveryEvents.length - 1]?.stage === "delivery_failed";
            return <article id={`order-${order.id}`} key={order.id} className="scroll-mt-6 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b p-6"><div><p className="text-xl font-black">Order #{order.id.slice(0, 8).toUpperCase()}</p><p className="mt-1 text-sm text-zinc-500">{formatDateTime(order.created_at)}</p>{order.receipt_number && <p className="mt-1 text-xs font-semibold text-zinc-500">Receipt {order.receipt_number}</p>}</div><div className="flex flex-wrap items-center gap-2">{order.receipt_number && <Link href={`/orders/${order.id}/receipt`} className="rounded-full border px-4 py-2 text-xs font-bold hover:border-red-500 hover:text-red-600">View / print receipt</Link>}<span className={`rounded-full px-3 py-2 text-xs font-bold capitalize ${statusStyles[order.status]}`}>{order.status}</span></div></div>
              <div className="p-6">
                {/* The one thing to do next, derived from this order rather
                    than stored — see lib/next-step.ts. */}
                <NextStep order={order} note={order.payment_rejected_reason} />
                <OrderTracking order={order} />
                <div className="grid gap-6 lg:grid-cols-[1fr_auto]"><OrderItemsList items={order.order_items ?? []} /><p className="text-2xl font-black">{formatCurrency(order.total_amount)}</p></div>
                <div className="mt-5 grid gap-3 rounded-2xl bg-zinc-50 p-4 text-sm sm:grid-cols-3"><div><p className="text-xs uppercase text-zinc-400">Payment</p><p className="font-semibold">{t(`payment.method.${order.payment_method ?? "cash_on_delivery"}`)}{order.payment_account ? ` · ${order.payment_account.toUpperCase()}` : ""}</p></div><div><p className="text-xs uppercase text-zinc-400">Payment status</p><p className="font-semibold capitalize">{order.payment_status}</p></div><div><p className="text-xs uppercase text-zinc-400">Delivery address</p><p className="font-semibold">{order.shipping_address}</p></div></div>
                <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-950">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div><p className="text-xs uppercase text-blue-500">{isPrepaid ? t("payment.verification") : "COD verification"}</p><p className="font-bold capitalize">{humanize(isPrepaid ? order.payment_verification_status ?? "pending" : order.cod_verification_status ?? "pending")}</p></div>
                    <div><p className="text-xs uppercase text-blue-500">Courier</p><p className="font-bold">{order.courier_name ?? "Not assigned"}</p></div>
                    <div><p className="text-xs uppercase text-blue-500">Tracking / ETA</p><p className="font-bold">{order.delivery_tracking_number ?? "Pending"}</p>{order.estimated_delivery_at && <p className="text-xs">Estimated {formatDateTime(order.estimated_delivery_at)}</p>}</div>
                  </div>
                  {awaitingRetry ? (
                    // Written in the reader's language rather than showing the
                    // stored bilingual note twice.
                    <div className="mt-3 rounded-xl bg-amber-50 p-4 text-amber-950">
                      <p className="font-bold">{t("delivery.attempt.heading")}</p>
                      <p className="mt-1">{t("delivery.attempt.message")}</p>
                      <p className="mt-2 text-xs font-semibold">
                        {t("delivery.attempt.count", { attempt: failedAttempts, max: MAX_DELIVERY_ATTEMPTS })}
                      </p>
                      {order.estimated_delivery_at && (
                        <p className="mt-1 text-xs">
                          {t("delivery.attempt.nextAttempt", { date: formatDateTime(order.estimated_delivery_at) })}
                        </p>
                      )}
                      {failedAttempts >= MAX_DELIVERY_ATTEMPTS && (
                        <p className="mt-2 text-xs font-semibold">{t("delivery.attempt.lastAttempt")}</p>
                      )}
                    </div>
                  ) : (
                    order.delivery_status_detail && <p className="mt-3">{order.delivery_status_detail}</p>
                  )}
                  {(order.delivery_events ?? []).length > 0 && <ol className="mt-4 space-y-3 border-l-2 border-blue-200 pl-4">{(order.delivery_events ?? []).map((event) => <li key={event.id}><p className="font-bold">{event.stage === "delivery_failed" ? t("delivery.attempt.heading") : event.title}</p><p className="text-xs text-blue-700">{formatDateTime(event.happened_at)}{event.description ? ` · ${event.description}` : ""}</p></li>)}</ol>}
                </div>
                {order.cancellation_request_status !== "none" && <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-950"><p className="font-bold capitalize">Cancellation: {humanize(order.cancellation_request_status)}</p>{order.cancellation_reason && <p className="mt-1">{order.cancellation_reason}</p>}</div>}
                {order.cancellation_refund_status === "details_required" && (
                  <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950">
                    <p className="text-lg font-black">Where should we send your refund?</p>
                    <p className="mt-1">Your payment was verified. Enter an account belonging to you so the store can return {formatCurrency(order.refund_amount ?? order.total_amount)}.</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <label className="font-semibold">Bank or wallet name<input value={refundDetails[order.id]?.bankName ?? ""} onChange={(event) => setRefundDetails((current) => ({ ...current, [order.id]: { bankName: event.target.value, accountName: current[order.id]?.accountName ?? "", accountNumber: current[order.id]?.accountNumber ?? "" } }))} maxLength={120} autoComplete="organization" className="mt-1 block w-full rounded-xl border bg-white px-4 py-3 font-normal outline-none focus:border-red-500" /></label>
                      <label className="font-semibold">Account holder name<input value={refundDetails[order.id]?.accountName ?? ""} onChange={(event) => setRefundDetails((current) => ({ ...current, [order.id]: { bankName: current[order.id]?.bankName ?? "", accountName: event.target.value, accountNumber: current[order.id]?.accountNumber ?? "" } }))} maxLength={160} autoComplete="name" className="mt-1 block w-full rounded-xl border bg-white px-4 py-3 font-normal outline-none focus:border-red-500" /></label>
                    </div>
                    <label className="mt-3 block font-semibold">Account or wallet number<input value={refundDetails[order.id]?.accountNumber ?? ""} onChange={(event) => setRefundDetails((current) => ({ ...current, [order.id]: { bankName: current[order.id]?.bankName ?? "", accountName: current[order.id]?.accountName ?? "", accountNumber: event.target.value } }))} maxLength={120} inputMode="numeric" autoComplete="off" className="mt-1 block w-full rounded-xl border bg-white px-4 py-3 font-normal outline-none focus:border-red-500" /></label>
                    <p className="mt-3 text-xs">Check every digit before saving. These details are shown only to you and authorised store administrators.</p>
                    <button type="button" disabled={processingOrderId === order.id} onClick={() => submitCancellationRefundDetails(order)} className="mt-4 rounded-full bg-red-600 px-6 py-3 font-bold text-white disabled:bg-zinc-400">{processingOrderId === order.id ? "Saving..." : "Save refund information"}</button>
                  </div>
                )}
                {order.cancellation_refund_status === "pending" && (
                  <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-950">
                    <p className="text-lg font-black">Refund pending</p>
                    <p className="mt-1">We received your {order.cancellation_refund_bank_name} account information. The store will send {formatCurrency(order.refund_amount ?? order.total_amount)} and record the transfer reference here.</p>
                  </div>
                )}
                {order.cancellation_refund_status === "sent" && (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-950">
                    <p className="text-lg font-black">Refund sent</p>
                    <p className="mt-1">{formatCurrency(order.refund_amount ?? order.total_amount)} was sent by {humanize(order.refund_method ?? "bank_transfer")}.</p>
                    {order.refund_reference && <p className="mt-2 font-mono font-bold">Reference: {order.refund_reference}</p>}
                  </div>
                )}
                {order.return_request_status !== "none" && <div className="mt-4 rounded-2xl bg-orange-50 p-5 text-sm text-orange-950"><p className="font-bold capitalize">Return: {humanize(order.return_request_status)}</p>{order.return_reason_code && <p className="mt-1">Problem: {returnLabels[order.return_reason_code]}</p>}{order.return_reason && <p className="mt-1">Details: {order.return_reason}</p>}{order.return_pickup_method && <p className="mt-1">Method: {humanize(order.return_pickup_method)}</p>}{order.return_pickup_scheduled_for && <p className="mt-1">Scheduled: {formatDateTime(order.return_pickup_scheduled_for)}</p>}{order.return_pickup_instructions && <p className="mt-1">Instructions: {order.return_pickup_instructions}</p>}{order.return_pickup_tracking_number && <p className="mt-1">Tracking: {order.return_pickup_tracking_number}</p>}{order.return_received_at && <p className="mt-1">Received by store: {formatDateTime(order.return_received_at)}</p>}{order.refund_completed_at && <p className="mt-1 font-semibold">Refund recorded: {formatCurrency(order.refund_amount ?? 0)} by {humanize(order.refund_method ?? "selected method")}{order.refund_reference ? ` (${order.refund_reference})` : ""}</p>}</div>}
                {(order.return_evidence ?? []).length > 0 && <div className="mt-3 flex flex-wrap gap-2">{(order.return_evidence ?? []).map((evidence) => <a key={evidence.id} href={`/api/orders/${order.id}/return-evidence/${evidence.id}`} target="_blank" rel="noreferrer" className="rounded-full border px-3 py-2 text-xs font-bold hover:border-red-500">Open {humanize(evidence.evidence_kind)}</a>)}</div>}
                {order.payment_method && order.payment_method !== "cash_on_delivery" && (
                  <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-sm text-emerald-950">
                    <p className="font-bold">
                      {t(`payment.method.${order.payment_method}`)}
                      {order.payment_account && ` · ${order.payment_account.toUpperCase()}`}
                    </p>
                    <p className="mt-1">
                      {order.payment_verification_status === "verified"
                        ? t("payment.status.verified")
                        : order.payment_verification_status === "rejected"
                          ? t("payment.status.rejected")
                          : order.payment_verification_status === "correction_requested"
                            ? t("payment.status.correctionRequested")
                            : (order.payment_slips ?? []).length > 0
                              ? t("payment.status.pending")
                              : t("payment.status.awaitingSlip")}
                    </p>
                    {/* Both figures side by side, so a short payment never
                        leaves the customer working out the difference. */}
                    {order.payment_verification_status === "correction_requested" &&
                      typeof order.payment_amount_received === "number" && (
                        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                          <div className="rounded-xl bg-white/70 px-3 py-2">
                            <dt className="text-xs uppercase opacity-70">
                              {t("payment.amountReceived")}
                            </dt>
                            <dd className="font-black tabular-nums">
                              {formatCurrency(order.payment_amount_received)}
                            </dd>
                          </div>
                          <div className="rounded-xl bg-white/70 px-3 py-2">
                            <dt className="text-xs uppercase opacity-70">
                              {t("payment.amountRemaining")}
                            </dt>
                            <dd className="font-black tabular-nums">
                              {formatCurrency(
                                Math.max(0, order.total_amount - order.payment_amount_received)
                              )}
                            </dd>
                          </div>
                        </dl>
                      )}
                    {order.payment_rejected_reason && (
                      <p className="mt-1 font-semibold text-red-700">{order.payment_rejected_reason}</p>
                    )}
                    {(order.payment_slips ?? []).map((slip, index) => (
                      <a key={slip.id} href={`/api/orders/${order.id}/payment-slip/${slip.id}`} target="_blank" rel="noreferrer"
                        className="mt-2 inline-block rounded-full border border-emerald-300 px-3 py-1 text-xs font-bold hover:border-emerald-600">
                        {t("payment.slip.uploaded")} {index + 1} · {formatDateTime(slip.created_at)}
                      </a>
                    ))}
                    {order.payment_verification_status !== "verified" && (
                      <div className="mt-3">
                        <label className="block text-sm font-semibold" htmlFor={`slip-${order.id}`}>
                          {t("payment.slip.title")}
                        </label>
                        <p className="mt-1 text-xs">{t("payment.slip.help")}</p>
                        <input id={`slip-${order.id}`} type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
                          onChange={(event) => setSlipFiles((current) => ({ ...current, [order.id]: event.target.files?.[0] ?? null }))}
                          className="mt-2 block w-full rounded-xl border bg-white px-4 py-3 text-sm" />
                        <button type="button" disabled={!slipFiles[order.id] || uploadingOrderId === order.id}
                          onClick={() => submitSlip(order)}
                          className="mt-3 rounded-full bg-emerald-700 px-5 py-2 text-sm font-bold text-white disabled:bg-zinc-400">
                          {uploadingOrderId === order.id ? "Uploading..." : t("payment.slip.title")}
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {order.admin_order_note && <p className="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">Administrator note: {order.admin_order_note}</p>}

                {/* Every return this customer opened on this order, each with
                    its own decision and its own way back if it was declined. */}
                {orderReturns.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <p className="text-sm font-black">{t("return.myRequests")}</p>
                    {orderReturns.map((request) => (
                      <div key={request.id} className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="font-bold">
                            {request.order_items?.products?.name ?? "Item"} × {request.quantity}
                          </p>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-orange-800">
                            {t(`return.status.${request.status}`)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-600">
                          {returnLabels[request.reason_code]} · {t(`return.resolution.${request.resolution_granted ?? request.preferred_resolution}`)}
                        </p>
                        {request.admin_decision_note && (
                          <p className="mt-2 rounded-xl bg-white p-3 text-xs">{request.admin_decision_note}</p>
                        )}
                        {(request.resolution_granted ?? request.preferred_resolution) === "refund" ? (
                          <RefundTracker request={request} />
                        ) : (
                          <div className="mt-3 rounded-2xl border bg-white p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                              {(request.resolution_granted ?? request.preferred_resolution) === "repair" ? "Repair progress" : "Replacement progress"}
                            </p>
                            <p className="mt-2 text-lg font-black capitalize">{humanize(request.status)}</p>
                            {request.preferred_service_at && <p className="mt-2 text-xs text-zinc-600">Preferred date: {formatDateTime(request.preferred_service_at)}</p>}
                          </div>
                        )}
                        {(request.status === "declined" || request.status === "more_info_needed") && !request.review_requested_at && (
                          <div className="mt-3">
                            <p className="text-xs text-zinc-600">{t("return.askReviewHelp")}</p>
                            <textarea
                              rows={2}
                              maxLength={1000}
                              value={reviewNotes[request.id] ?? ""}
                              onChange={(event) => setReviewNotes((current) => ({ ...current, [request.id]: event.target.value }))}
                              className="mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-red-500"
                            />
                            <button
                              type="button"
                              onClick={() => askForReview(request)}
                              className="mt-2 rounded-full bg-zinc-900 px-5 py-2 text-xs font-bold text-white"
                            >
                              {t("return.askReview")}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-6 flex flex-wrap gap-2 border-t pt-6">
                  <OrderHelpButton orderId={order.id} />
                  {canReturn && returnOrderId !== order.id && (
                    <button
                      type="button"
                      onClick={() => setReturnOrderId(order.id)}
                      className="rounded-full bg-red-600 px-5 py-2.5 text-xs font-bold text-white"
                    >
                      {t("return.start")}
                    </button>
                  )}
                  <Link href="/returns" className="self-center text-xs font-semibold text-red-600 hover:underline">
                    {t("nav.returnPolicy")}
                  </Link>
                </div>

                {canReturn && returnOrderId === order.id && (
                  <ReturnWizard
                    order={order}
                    unavailableItemIds={orderReturns
                      .filter((request) => !["completed", "cancelled", "declined"].includes(request.status))
                      .map((request) => request.order_item_id)}
                    onSubmitted={() => {
                      setReturnOrderId(null);
                      setMessage(t("return.sent"));
                      void refreshReturns();
                      void refreshOrders();
                    }}
                  />
                )}

                {order.status === "delivered" && !returnOpen && orderReturns.length === 0 && (
                  <p className="mt-4 rounded-xl bg-zinc-100 p-3 text-sm text-zinc-600">{t("return.deadlinePassed")}</p>
                )}

                {canCancel && <div className="mt-6 border-t pt-6"><label htmlFor={`cancel-${order.id}`} className="block text-sm font-semibold">Why are you cancelling this order?</label><textarea id={`cancel-${order.id}`} rows={2} maxLength={500} value={cancellationReasons[order.id] ?? ""} onChange={(event) => setCancellationReasons((current) => ({ ...current, [order.id]: event.target.value }))} className="mt-2 w-full rounded-xl border px-4 py-3 outline-none focus:border-red-500" /><button type="button" disabled={processingOrderId === order.id} onClick={() => submitCancellation(order)} className="mt-3 rounded-full border border-red-600 px-5 py-2 text-sm font-bold text-red-600 disabled:opacity-50">{processingOrderId === order.id ? "Sending request..." : "Request cancellation"}</button></div>}
              </div>
            </article>;
          })}</div>
        )}
      </section>
    </main>
  );
}
