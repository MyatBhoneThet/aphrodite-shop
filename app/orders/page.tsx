"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authHeaders } from "../lib/client-auth";
import { formatCurrency, formatDateTime } from "../lib/format";
import { useCurrentUser } from "../lib/useCurrentUser";

type RequestStatus = "none" | "requested" | "approved" | "rejected";
type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned";

type Order = {
  id: string;
  status: OrderStatus;
  total_amount: number;
  shipping_address: string;
  payment_method: "cash_on_delivery";
  payment_status: "unpaid" | "collected" | "refunded";
  cancellation_request_status: RequestStatus;
  cancellation_reason: string | null;
  return_request_status: RequestStatus;
  return_reason: string | null;
  admin_order_note: string | null;
  created_at: string;
  order_items?: {
    id: string;
    product_id: number;
    quantity: number;
    unit_price: number;
    product?: { name: string } | null;
  }[];
};

const statusStyles: Record<OrderStatus, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  shipped: "bg-purple-100 text-purple-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  returned: "bg-orange-100 text-orange-700",
};

export default function OrdersPage() {
  const { user, status: userStatus } = useCurrentUser();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [requestReasons, setRequestReasons] = useState<Record<string, string>>({});
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadOrders() {
      if (userStatus !== "ready" || !user) {
        setIsLoading(false);
        return;
      }
      const response = await fetch("/api/orders", { headers: authHeaders() });
      if (response.ok) {
        const data = (await response.json()) as { orders: Order[] };
        setOrders(data.orders);
      }
      setIsLoading(false);
    }
    loadOrders();
  }, [userStatus, user]);

  async function submitOrderRequest(
    order: Order,
    action: "request_cancellation" | "request_return"
  ) {
    const reason = requestReasons[order.id]?.trim() ?? "";
    if (reason.length < 3) {
      setError("Please enter a short reason for your request.");
      return;
    }
    setError("");
    setMessage("");
    setProcessingOrderId(order.id);

    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const data = (await response.json().catch(() => null)) as
        | { order?: Order; error?: string }
        | null;
      if (!response.ok || !data?.order) {
        throw new Error(data?.error ?? "Unable to submit your request.");
      }
      setOrders((current) =>
        current.map((item) => (item.id === order.id ? data.order! : item))
      );
      setRequestReasons((current) => ({ ...current, [order.id]: "" }));
      setMessage(
        action === "request_cancellation"
          ? "Cancellation request sent for administrator review."
          : "Return request sent for administrator review."
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to submit your request."
      );
    } finally {
      setProcessingOrderId(null);
    }
  }

  if (userStatus === "checking" || isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white">
        Loading your orders...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-5 text-center">
        <div>
          <h1 className="text-3xl font-bold">Login to view your orders</h1>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/login" className="rounded-full bg-red-600 px-6 py-3 font-semibold text-white">
              Login
            </Link>
            <Link href="/" className="rounded-full border px-6 py-3 font-semibold">
              Back to Store
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-zinc-950">
      <header className="border-b">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
          <Link href="/" className="text-2xl font-bold text-red-600">Aphrodite</Link>
          <Link href="/" className="rounded-full border px-5 py-2 text-sm">Back to Store</Link>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-5 py-10">
        <h1 className="text-4xl font-bold">Your Orders</h1>
        <p className="mt-2 text-zinc-500">
          Track fulfilment, COD payment, cancellation, and return requests.
        </p>
        {error && <p role="alert" className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>}
        {message && <p role="status" className="mt-4 rounded-2xl bg-green-50 p-4 text-sm font-semibold text-green-700">{message}</p>}

        {orders.length === 0 ? (
          <p className="mt-8 rounded-2xl bg-zinc-100 p-8 text-center text-zinc-500">
            You haven&apos;t placed any orders yet.
          </p>
        ) : (
          <div className="mt-8 space-y-4">
            {orders.map((order) => {
              const canCancel =
                (order.status === "pending" || order.status === "confirmed") &&
                !["requested", "approved"].includes(order.cancellation_request_status);
              const canReturn =
                order.status === "delivered" &&
                !["requested", "approved"].includes(order.return_request_status);
              const action = canReturn ? "request_return" : "request_cancellation";

              return (
                <article key={order.id} className="rounded-2xl border p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-bold">Order #{order.id.slice(0, 8)}</p>
                      <p className="text-sm text-zinc-500">{formatDateTime(order.created_at)}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${statusStyles[order.status]}`}>
                      {order.status}
                    </span>
                  </div>

                  <div className="mt-4 space-y-1 text-sm text-zinc-600">
                    {(order.order_items ?? []).map((item) => (
                      <p key={item.id}>
                        {item.product?.name ?? `Product #${item.product_id}`} × {item.quantity}
                      </p>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t pt-4">
                    <p className="text-sm text-zinc-500">Shipping to {order.shipping_address}</p>
                    <p className="font-bold">{formatCurrency(order.total_amount)}</p>
                  </div>

                  <div className="mt-4 grid gap-3 rounded-2xl bg-zinc-50 p-4 text-sm sm:grid-cols-2">
                    <div><p className="text-xs uppercase text-zinc-400">Payment</p><p className="font-semibold">Cash on delivery</p></div>
                    <div><p className="text-xs uppercase text-zinc-400">Payment status</p><p className="font-semibold capitalize">{order.payment_status}</p></div>
                  </div>

                  {order.cancellation_request_status !== "none" && (
                    <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm">
                      <p className="font-bold capitalize">Cancellation: {order.cancellation_request_status}</p>
                      {order.cancellation_reason && <p>Reason: {order.cancellation_reason}</p>}
                    </div>
                  )}
                  {order.return_request_status !== "none" && (
                    <div className="mt-4 rounded-2xl bg-orange-50 p-4 text-sm">
                      <p className="font-bold capitalize">Return: {order.return_request_status}</p>
                      {order.return_reason && <p>Reason: {order.return_reason}</p>}
                    </div>
                  )}
                  {order.admin_order_note && <p className="mt-3 text-sm text-zinc-500">Administrator note: {order.admin_order_note}</p>}

                  {(canCancel || canReturn) && (
                    <div className="mt-4 border-t pt-4">
                      <label htmlFor={`reason-${order.id}`} className="mb-2 block text-sm font-semibold">
                        {canReturn ? "Why are you returning this order?" : "Why are you cancelling this order?"}
                      </label>
                      <textarea id={`reason-${order.id}`} rows={2} maxLength={500}
                        value={requestReasons[order.id] ?? ""}
                        onChange={(event) => setRequestReasons((current) => ({ ...current, [order.id]: event.target.value }))}
                        className="w-full rounded-xl border px-4 py-3 outline-none focus:border-red-500" />
                      <button type="button" disabled={processingOrderId === order.id}
                        onClick={() => submitOrderRequest(order, action)}
                        className="mt-3 rounded-full border border-red-600 px-5 py-2 text-sm font-semibold text-red-600 disabled:opacity-50">
                        {processingOrderId === order.id
                          ? "Sending request..."
                          : canReturn ? "Request return" : "Request cancellation"}
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
