"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authHeaders } from "../lib/client-auth";
import { formatCurrency, formatDateTime } from "../lib/format";
import { useCurrentUser } from "../lib/useCurrentUser";

type OrderItem = {
  id: string;
  product_id: number;
  quantity: number;
  unit_price: number;
  product?: { name: string } | null;
};

type Order = {
  id: string;
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  total_amount: number;
  shipping_address: string;
  created_at: string;
  order_items?: OrderItem[];
};

const statusStyles: Record<Order["status"], string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  shipped: "bg-purple-100 text-purple-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function OrdersPage() {
  const { user, status: userStatus } = useCurrentUser();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  if (userStatus === "checking" || isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-zinc-950">
        Loading your orders...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-5 text-center text-zinc-950">
        <div>
          <h1 className="text-3xl font-bold">Login to view your orders</h1>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/login"
              className="rounded-full bg-red-600 px-6 py-3 font-semibold text-white"
            >
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
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
          <Link href="/" className="text-2xl font-bold text-red-600">
            Aphrodite
          </Link>
          <Link href="/" className="rounded-full border px-5 py-2 text-sm">
            Back to Store
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-5 py-10">
        <h1 className="text-4xl font-bold">Your Orders</h1>

        {orders.length === 0 ? (
          <p className="mt-8 rounded-2xl bg-zinc-100 p-8 text-center text-zinc-500">
            You haven&apos;t placed any orders yet.
          </p>
        ) : (
          <div className="mt-8 space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="rounded-2xl border p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold">Order #{order.id.slice(0, 8)}</p>
                    <p className="text-sm text-zinc-500">
                      {formatDateTime(order.created_at)}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${statusStyles[order.status]}`}
                  >
                    {order.status}
                  </span>
                </div>

                <div className="mt-4 space-y-1 text-sm text-zinc-600">
                  {(order.order_items ?? []).map((item) => (
                    <p key={item.id}>
                      {item.product?.name ?? `Product #${item.product_id}`} ×{" "}
                      {item.quantity}
                    </p>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between border-t pt-4">
                  <p className="text-sm text-zinc-500">
                    Shipping to {order.shipping_address}
                  </p>
                  <p className="font-bold">{formatCurrency(order.total_amount)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
