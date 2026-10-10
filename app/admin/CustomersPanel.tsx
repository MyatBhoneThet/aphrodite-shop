"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { authHeaders } from "@/app/lib/client-auth";
import { formatCurrency, formatDateTime } from "@/app/lib/format";
import { useDebouncedValue } from "@/app/lib/useDebouncedValue";
import CompanyCard from "./CompanyCard";

type CustomerRow = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: "normal" | "wholesale";
  created_at: string;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
};

type Detail = {
  profile: Omit<CustomerRow, "orderCount" | "totalSpent" | "lastOrderAt">;
  orders: {
    id: string;
    status: string;
    total_amount: number;
    created_at: string;
    payment_method: string | null;
    payment_status: string | null;
    order_items: { quantity: number; products: { name: string } | null }[] | null;
  }[];
  totalSpent: number;
  notes: { id: string; body: string; created_at: string; profiles: { full_name: string | null; email: string | null } | null }[];
  notesAvailable: boolean;
};

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800", confirmed: "bg-blue-100 text-blue-800", shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-emerald-100 text-emerald-800", cancelled: "bg-red-100 text-red-800", returned: "bg-orange-100 text-orange-800",
};

async function errorOf(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? fallback;
}

function CustomerDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [noteError, setNoteError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/customers/${id}`, { headers: authHeaders(), cache: "no-store" });
      if (!response.ok) throw new Error(await errorOf(response, "Could not load this customer."));
      setDetail((await response.json()) as Detail);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load this customer.");
    }
  }, [id]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function addNote(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setNoteError("");
    try {
      const response = await fetch(`/api/admin/customers/${id}`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ body: note }),
      });
      if (!response.ok) throw new Error(await errorOf(response, "Could not save the note."));
      setNote("");
      await load();
    } catch (reason) {
      setNoteError(reason instanceof Error ? reason.message : "Could not save the note.");
    } finally {
      setSaving(false);
    }
  }

  const back = <button type="button" onClick={onBack} className="rounded-full border bg-white px-4 py-2 text-sm font-semibold hover:border-red-500 hover:text-red-600">← All customers</button>;
  if (error) return <div className="space-y-4">{back}<p role="alert" className="rounded-2xl bg-red-50 p-5 text-sm font-semibold text-red-700">{error}</p></div>;
  if (!detail) return <div className="space-y-4">{back}<p className="rounded-2xl bg-white p-8 text-center text-sm font-semibold text-zinc-400 shadow-sm">Loading…</p></div>;

  const { profile } = detail;
  return (
    <div className="space-y-5">
      {back}
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-100 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="break-words text-xl font-black">{profile.full_name || "Unnamed customer"}</h2>
            <p className="break-all text-sm text-zinc-600">{profile.email}</p>
            <p className="text-sm text-zinc-600">{profile.phone || "No phone on the account"}</p>
          </div>
          {profile.role === "wholesale" && <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-800">Wholesale</span>}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-zinc-50 p-3"><p className="text-xs font-semibold text-zinc-500">Orders</p><p className="text-xl font-black">{detail.orders.length}</p></div>
          <div className="rounded-xl bg-zinc-50 p-3"><p className="text-xs font-semibold text-zinc-500">Total spent</p><p className="text-base font-black sm:text-xl">{formatCurrency(detail.totalSpent)}</p></div>
          <div className="rounded-xl bg-zinc-50 p-3"><p className="text-xs font-semibold text-zinc-500">Joined</p><p className="text-sm font-black sm:text-base">{new Date(profile.created_at).toLocaleDateString()}</p></div>
        </div>
      </section>

      {profile.role === "wholesale" && (
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-100 sm:p-6">
          <h3 className="mb-3 font-bold">Company and business licence</h3>
          <CompanyCard userId={profile.id} />
        </section>
      )}

      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-zinc-100">
        <h3 className="border-b px-5 py-4 font-bold">Order history</h3>
        {detail.orders.length === 0 ? <p className="p-6 text-center text-sm text-zinc-500">No orders yet.</p> : (
          <ul className="divide-y">
            {detail.orders.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                <div className="min-w-[10rem] flex-1">
                  <p className="font-bold">#{order.id.slice(0, 8).toUpperCase()}</p>
                  <p className="text-xs text-zinc-500">{formatDateTime(order.created_at)}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-600">
                    {(order.order_items ?? []).map((item) => `${item.products?.name ?? "Product"} ×${item.quantity}`).join(", ")}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${STATUS_STYLE[order.status] ?? "bg-zinc-100"}`}>{order.status}</span>
                <p className="ml-auto font-black">{formatCurrency(order.total_amount)}</p>
                <a href={`/admin/slip/${order.id}`} target="_blank" rel="noreferrer" className="rounded-full border px-3 py-1.5 text-xs font-semibold hover:border-red-500 hover:text-red-600">Packing slip</a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-100 sm:p-6">
        <h3 className="font-bold">Private notes</h3>
        <p className="text-xs text-zinc-500">Only admins can see these. The customer never does.</p>
        {detail.notesAvailable ? (
          <>
            <form onSubmit={addNote} className="mt-3">
              <label htmlFor="customer-note" className="sr-only">New note</label>
              <textarea id="customer-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={3}
                placeholder="e.g. Prefers calls after 5 pm, always pays cash, trusted buyer" className="w-full resize-none rounded-xl border p-3 text-sm outline-none focus:border-red-500" />
              {noteError && <p role="alert" className="mt-1 text-sm font-semibold text-red-600">{noteError}</p>}
              <button type="submit" disabled={saving || !note.trim()} className="mt-2 rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Add note"}</button>
            </form>
            <ul className="mt-4 space-y-3">
              {detail.notes.map((item) => (
                <li key={item.id} className="rounded-xl bg-amber-50 p-3 text-sm">
                  <p className="whitespace-pre-wrap break-words">{item.body}</p>
                  <p className="mt-1 text-xs text-zinc-500">{item.profiles?.full_name || item.profiles?.email || "Admin"} · {formatDateTime(item.created_at)}</p>
                </li>
              ))}
              {detail.notes.length === 0 && <li className="text-sm text-zinc-400">No notes yet.</li>}
            </ul>
          </>
        ) : (
          <p className="mt-3 rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">Notes are not set up yet. Run supabase/migrations/2026-10-09-customer-notes.sql in the Supabase SQL Editor.</p>
        )}
      </section>
    </div>
  );
}

export default function CustomersPanel() {
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 300);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async (term: string, offset: number) => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ offset: String(offset) });
      if (term) query.set("search", term);
      const response = await fetch(`/api/admin/customers?${query}`, { headers: authHeaders(), cache: "no-store" });
      if (!response.ok) throw new Error(await errorOf(response, "Could not load customers."));
      const data = (await response.json()) as { customers: CustomerRow[]; total: number; hasMore: boolean; nextOffset: number };
      setCustomers((current) => (offset === 0 ? data.customers : [...current, ...data.customers]));
      setTotal(data.total);
      setHasMore(data.hasMore);
      setNextOffset(data.nextOffset);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load customers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(debounced.trim(), 0), 0);
    return () => window.clearTimeout(timer);
  }, [debounced, load]);

  if (openId) return <div className="mt-6"><CustomerDetail id={openId} onBack={() => setOpenId(null)} /></div>;

  return (
    <section className="mt-6 rounded-2xl bg-white shadow-sm ring-1 ring-zinc-100">
      <div className="border-b px-5 py-4">
        <h2 className="font-bold">Customers</h2>
        <p className="text-sm text-zinc-500" role="status">{total.toLocaleString()} {total === 1 ? "customer" : "customers"}{debounced.trim() ? " match your search" : ""}</p>
        <label className="mt-3 block">
          <span className="sr-only">Search customers</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email or phone"
            className="w-full rounded-full border px-4 py-2 text-sm outline-none focus:border-red-500 sm:max-w-md" />
        </label>
      </div>

      {error && <p role="alert" className="m-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>}

      <ul className="divide-y">
        {customers.map((customer) => (
          <li key={customer.id}>
            <button type="button" onClick={() => setOpenId(customer.id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 text-left transition hover:bg-zinc-50">
              <span className="min-w-[12rem] flex-1">
                <span className="block break-words font-semibold">{customer.full_name || "Unnamed customer"}{customer.role === "wholesale" && <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-800">Wholesale</span>}</span>
                <span className="block break-all text-xs text-zinc-500">{customer.email}{customer.phone ? ` · ${customer.phone}` : ""}</span>
              </span>
              <span className="text-sm"><span className="font-bold">{customer.orderCount}</span> <span className="text-zinc-500">orders</span></span>
              <span className="text-sm font-bold">{formatCurrency(customer.totalSpent)}</span>
              <span className="text-xs text-zinc-500">{customer.lastOrderAt ? `Last order ${new Date(customer.lastOrderAt).toLocaleDateString()}` : "No orders"}</span>
              <span aria-hidden className="hidden text-zinc-400 sm:inline">›</span>
            </button>
          </li>
        ))}
      </ul>

      {!loading && !error && customers.length === 0 && <p className="p-8 text-center text-sm text-zinc-500">No customers found.</p>}
      {loading && <p className="p-6 text-center text-sm font-semibold text-zinc-400">Loading…</p>}
      {hasMore && !loading && (
        <div className="border-t p-4 text-center">
          <button type="button" onClick={() => void load(debounced.trim(), nextOffset)} className="rounded-full border px-5 py-2 text-sm font-semibold hover:border-red-500 hover:text-red-600">Show more</button>
        </div>
      )}
    </section>
  );
}
