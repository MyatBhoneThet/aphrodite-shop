"use client";

import { useEffect, useState } from "react";
import type { AdminStats } from "../lib/backend";
import { authHeaders } from "../lib/client-auth";
import { formatCurrency, formatDateTime } from "../lib/format";

export default function AdminOverviewPanel({ onNavigate }: { onNavigate: (panel: "products" | "orders" | "wholesale" | "sync") => void }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/admin/stats", { headers: authHeaders(), cache: "no-store" });
      const data = (await response.json().catch(() => null)) as { stats?: AdminStats; error?: string } | null;
      if (!response.ok || !data?.stats) setError(data?.error ?? "Unable to load statistics.");
      else setStats(data.stats);
    }
    void load();
  }, []);

  return <section className="mt-6 space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-wider text-red-600">Business overview</p><h2 className="mt-1 text-3xl font-black">One dashboard for the whole store</h2><p className="mt-2 text-sm text-zinc-500">Products, orders, returns, customers, pricing, chat, and product sync all stay in this sidebar.</p></div><div className="flex flex-wrap gap-2"><button onClick={() => onNavigate("products")} className="rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white">+ Add product</button><button onClick={() => onNavigate("orders")} className="rounded-full border px-4 py-2 text-sm font-bold">Manage orders</button><button onClick={() => onNavigate("wholesale")} className="rounded-full border px-4 py-2 text-sm font-bold">Wholesale</button><button onClick={() => onNavigate("sync")} className="rounded-full border px-4 py-2 text-sm font-bold">Sync products</button></div></div>
    {error && <p className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>}
    {!stats && !error ? <p className="rounded-2xl bg-white p-8 text-center text-zinc-500 shadow-sm">Loading store overview...</p> : stats && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat title="Revenue" value={formatCurrency(stats.revenue.total)} detail="Excludes cancelled and returned" icon="💰" />
        <Stat title="Orders" value={String(stats.orders.total)} detail={`${stats.orders.pending} pending`} icon="🧾" />
        <Stat title="Customers" value={String(stats.customers.total)} detail="Registered accounts" icon="👥" />
        <Stat title="Products" value={String(stats.products.total)} detail={`${stats.products.outOfStock} out of stock`} icon="💻" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-3xl bg-white p-6 shadow-sm"><h3 className="text-lg font-black">Order status</h3><div className="mt-5 space-y-3">{stats.ordersByStatus.map((item) => { const max = Math.max(...stats.ordersByStatus.map((entry) => entry.count), 1); return <div key={item.status}><div className="flex justify-between text-sm"><span className="capitalize">{item.status}</span><b>{item.count}</b></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100"><div className="h-full rounded-full bg-red-600" style={{ width: `${Math.max(3, item.count / max * 100)}%` }} /></div></div>; })}</div></article>
        <article className="rounded-3xl bg-white shadow-sm"><div className="border-b px-6 py-4"><h3 className="text-lg font-black">Recent orders</h3></div>{stats.recentOrders.length ? <ul className="divide-y">{stats.recentOrders.slice(0, 6).map((order) => <li key={order.id} className="flex items-center justify-between gap-4 px-6 py-4"><div><p className="text-sm font-bold">#{order.id.slice(0, 8)} · {order.shipping_name}</p><p className="text-xs text-zinc-500">{formatDateTime(order.created_at)}</p></div><div className="text-right"><p className="text-sm font-black">{formatCurrency(order.total_amount)}</p><p className="text-xs capitalize text-zinc-500">{order.status}</p></div></li>)}</ul> : <p className="p-6 text-sm text-zinc-500">No orders yet.</p>}</article>
      </div>
    </>}
  </section>;
}

function Stat({ title, value, detail, icon }: { title: string; value: string; detail: string; icon: string }) {
  return <article className="rounded-3xl bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wider text-zinc-400">{title}</p><span className="shrink-0 text-xl">{icon}</span></div><p className="mt-3 text-3xl font-black">{value}</p><p className="mt-1 text-xs text-zinc-500">{detail}</p></article>;
}
