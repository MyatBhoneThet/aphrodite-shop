"use client";

import { emptyOrderFilters, pageCount, type OrderFilters } from "@/app/lib/admin-order-filter";
import { useAdminText } from "@/app/lib/useAdminText";

const STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled", "returned"] as const;

export default function OrderFilterBar({
  filters,
  onFilters,
  page,
  onPage,
  shown,
  total,
  pageSize,
  searchHint,
}: {
  filters: OrderFilters;
  onFilters: (next: OrderFilters) => void;
  page: number;
  onPage: (page: number) => void;
  shown: number;
  total: number;
  pageSize: number;
  searchHint: string;
}) {
  const a = useAdminText();
  const pages = pageCount(shown, pageSize);
  const active = filters.query || filters.status || filters.from || filters.to;
  const field = "rounded-full border bg-white px-4 py-2 text-sm outline-none focus:border-red-500";

  return (
    <div className="border-b bg-zinc-50/60 px-5 py-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[14rem] flex-1">
          <span className="mb-1 block text-xs font-semibold uppercase text-zinc-500">{a("Search orders")}</span>
          <input
            type="search"
            value={filters.query}
            onChange={(event) => onFilters({ ...filters, query: event.target.value })}
            placeholder={searchHint}
            className={`${field} w-full`}
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold uppercase text-zinc-500">{a("Status")}</span>
          <select value={filters.status} onChange={(event) => onFilters({ ...filters, status: event.target.value })} className={`${field} capitalize`}>
            <option value="">{a("All statuses")}</option>
            {STATUSES.map((status) => <option key={status} value={status}>{a(status)}</option>)}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold uppercase text-zinc-500">{a("From")}</span>
          <input type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => onFilters({ ...filters, from: event.target.value })} className={field} />
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold uppercase text-zinc-500">{a("To")}</span>
          <input type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => onFilters({ ...filters, to: event.target.value })} className={field} />
        </label>
        {active && (
          <button type="button" onClick={() => onFilters(emptyOrderFilters)} className="rounded-full border px-4 py-2 text-sm font-semibold hover:border-red-500 hover:text-red-600">
            {a("Clear")}
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-600">
        <p role="status">
          {shown === total ? `${total} ${a("orders")}` : `${shown} ${a("of")} ${total} ${a("orders")}`}
        </p>
        {pages > 1 && (
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-full border px-4 py-1.5 font-semibold disabled:opacity-40">← {a("Previous")}</button>
            <span className="tabular-nums">{page} / {pages}</span>
            <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className="rounded-full border px-4 py-1.5 font-semibold disabled:opacity-40">{a("Next")} →</button>
          </div>
        )}
      </div>
    </div>
  );
}
