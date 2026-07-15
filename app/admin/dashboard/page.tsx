"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { adminLogout, authHeaders } from "../../lib/client-auth";
import { formatCurrency, formatDateTime } from "../../lib/format";
import { useCurrentUser } from "../../lib/useCurrentUser";
import type { AdminStats } from "../../lib/backend";

function makeLinePoints(values: number[]) {
  const max = Math.max(...values, 1);
  const width = 320;
  const height = 120;
  const left = 10;
  const bottom = 110;
  const gap = values.length > 1 ? width / (values.length - 1) : width;

  return values
    .map((value, index) => {
      const x = left + index * gap;
      const y = bottom - (value / max) * height * 0.75;
      return `${x},${y}`;
    })
    .join(" ");
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  shipped: "bg-purple-100 text-purple-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function AdminDashboardPage() {
  const { user, status: userStatus } = useCurrentUser();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [error, setError] = useState("");

  const authStatus: "checking" | "ready" | "forbidden" =
    userStatus === "checking"
      ? "checking"
      : user?.role === "admin"
      ? "ready"
      : "forbidden";

  useEffect(() => {
    async function loadStats() {
      if (authStatus !== "ready") return;

      setIsLoadingStats(true);
      setError("");

      try {
        const response = await fetch("/api/admin/stats", {
          headers: authHeaders(),
          cache: "no-store",
        });

        const data = (await response.json().catch(() => null)) as {
          stats?: AdminStats;
          error?: string;
        } | null;

        if (!response.ok || !data?.stats) {
          throw new Error(data?.error ?? "Unable to load statistics.");
        }

        setStats(data.stats);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load statistics.");
      } finally {
        setIsLoadingStats(false);
      }
    }

    loadStats();
  }, [authStatus]);

  async function handleLogout() {
    await adminLogout();
    window.location.assign("/admin/login");
  }

  if (authStatus === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f6f9] text-zinc-700">
        Checking admin access...
      </main>
    );
  }

  if (authStatus === "forbidden") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f6f9] px-5 text-zinc-950">
        <div className="max-w-md rounded-3xl bg-white p-8 text-center shadow">
          <p className="text-5xl">🔒</p>
          <h1 className="mt-4 text-2xl font-bold">Admin access only</h1>
          <p className="mt-3 text-zinc-500">
            You need an admin account to view this page.
          </p>

          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/admin/login"
              className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white"
            >
              Go to Admin Login
            </Link>
            <Link href="/" className="rounded-full border px-5 py-2 text-sm">
              Back to Store
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f6f9] text-zinc-900">
      <header className="sticky top-0 z-30 border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-xs text-zinc-500">Aphrodite Admin</p>
            <h1 className="text-xl font-bold">Business Dashboard</h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin"
              className="rounded-full border px-4 py-2 text-sm font-semibold hover:bg-zinc-100"
            >
              Manage Products &amp; Orders
            </Link>
            <Link
              href="/"
              className="rounded-full border px-4 py-2 text-sm font-semibold hover:bg-zinc-100"
            >
              Back to Store
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8">
        {user?.full_name && (
          <p className="mb-6 text-zinc-500">
            Welcome back, <span className="font-semibold text-zinc-900">{user.full_name}</span>.
          </p>
        )}

        {error && (
          <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {isLoadingStats ? (
          <p className="rounded-2xl bg-white p-8 text-center text-zinc-500 shadow">
            Loading statistics...
          </p>
        ) : stats ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Total Revenue"
                value={formatCurrency(stats.revenue.total)}
                subtitle="Excludes cancelled orders"
                color="bg-cyan-600"
                icon="💰"
              />
              <StatCard
                title="Orders"
                value={String(stats.orders.total)}
                subtitle={`${stats.orders.pending} pending`}
                color="bg-green-600"
                icon="🧾"
              />
              <StatCard
                title="Customers"
                value={String(stats.customers.total)}
                subtitle="Registered accounts"
                color="bg-blue-600"
                icon="👥"
              />
              <StatCard
                title="Products"
                value={String(stats.products.total)}
                subtitle={`${stats.products.inStock} in stock / ${stats.products.outOfStock} out`}
                color="bg-yellow-500"
                icon="💻"
              />
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
              <div className="rounded-2xl bg-white p-5 shadow">
                <h2 className="font-bold">Sales (last 6 months)</h2>
                <p className="text-sm text-zinc-500">Excludes cancelled orders</p>

                <svg viewBox="0 0 350 140" className="mt-4 h-64 w-full">
                  <polyline
                    fill="rgba(14, 165, 233, 0.16)"
                    stroke="none"
                    points={`10,130 ${makeLinePoints(
                      stats.monthlySales.map((item) => item.value)
                    )} 330,130`}
                  />
                  <polyline
                    fill="none"
                    stroke="#0ea5e9"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={makeLinePoints(stats.monthlySales.map((item) => item.value))}
                  />
                  {[20, 50, 80, 110].map((y) => (
                    <line key={y} x1="10" y1={y} x2="340" y2={y} stroke="#e5e7eb" strokeWidth="1" />
                  ))}
                </svg>

                <div className="grid grid-cols-6 gap-2 text-center text-xs text-zinc-500">
                  {stats.monthlySales.map((item) => (
                    <span key={item.label}>{item.label}</span>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow">
                <h2 className="font-bold">Orders by Status</h2>

                <div className="mt-4 flex h-56 items-end gap-3">
                  {stats.ordersByStatus.map((item) => {
                    const max = Math.max(
                      ...stats.ordersByStatus.map((entry) => entry.count),
                      1
                    );

                    return (
                      <div key={item.status} className="flex flex-1 flex-col items-center gap-2">
                        <div className="flex h-40 w-full items-end rounded bg-zinc-100 p-1">
                          <div
                            className="w-full rounded bg-cyan-500"
                            style={{ height: `${Math.max(6, (item.count / max) * 100)}%` }}
                          />
                        </div>
                        <p className="text-center text-[11px] font-bold capitalize">
                          {item.status}
                        </p>
                        <p className="text-center text-[11px] text-zinc-500">{item.count}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl bg-white shadow">
                <div className="border-b px-5 py-4">
                  <h2 className="font-bold">Top Selling Products</h2>
                </div>

                {stats.topProducts.length === 0 ? (
                  <p className="p-5 text-sm text-zinc-500">
                    No sales yet -- this fills in once orders are placed.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {stats.topProducts.map((product, index) => (
                      <li
                        key={product.productId}
                        className="flex items-center gap-3 px-5 py-3"
                      >
                        <span className="w-5 text-sm font-bold text-zinc-400">
                          {index + 1}
                        </span>
                        {product.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.image}
                            alt={product.name}
                            className="h-10 w-10 rounded-lg object-contain ring-1 ring-zinc-200"
                          />
                        )}
                        <span className="flex-1 text-sm font-semibold">{product.name}</span>
                        <span className="text-sm text-zinc-500">
                          {product.quantitySold} sold
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-2xl bg-white shadow">
                <div className="border-b px-5 py-4">
                  <h2 className="font-bold">Recent Activity</h2>
                </div>

                {stats.recentOrders.length === 0 ? (
                  <p className="p-5 text-sm text-zinc-500">No orders yet.</p>
                ) : (
                  <ul className="divide-y">
                    {stats.recentOrders.map((order) => (
                      <li key={order.id} className="px-5 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">
                              #{order.id.slice(0, 8)} &middot; {order.shipping_name}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {formatDateTime(order.created_at)}
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-sm font-bold">
                              {formatCurrency(order.total_amount)}
                            </p>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${
                                statusColors[order.status] ?? "bg-zinc-100 text-zinc-700"
                              }`}
                            >
                              {order.status}
                            </span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  color,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  color: string;
  icon: string;
}) {
  return (
    <article className={`overflow-hidden rounded-2xl text-white shadow ${color}`}>
      <div className="flex items-start justify-between p-5">
        <div>
          <p className="text-3xl font-bold">{value}</p>
          <p className="mt-2 text-sm font-semibold">{title}</p>
        </div>
        <span className="text-5xl opacity-30">{icon}</span>
      </div>
      <div className="bg-black/10 px-5 py-2 text-center text-xs font-semibold">
        {subtitle}
      </div>
    </article>
  );
}
