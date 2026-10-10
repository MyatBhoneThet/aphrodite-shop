"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { authHeaders } from "@/app/lib/client-auth";

type LowStockItem = {
  id: number;
  name: string;
  brand: string | null;
  category: string | null;
  image: string | null;
  stock_quantity: number | null;
};

type LowStockData = { threshold: number; outOfStock: LowStockItem[]; low: LowStockItem[] };

const LEVELS = [3, 5, 10, 20];
const PREVIEW = 6;

export default function LowStockCard({ onOpenProducts }: { onOpenProducts: () => void }) {
  const [threshold, setThreshold] = useState(5);
  const [data, setData] = useState<LowStockData | null>(null);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [showOut, setShowOut] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/low-stock?threshold=${threshold}`, { headers: authHeaders(), cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as (LowStockData & { error?: string }) | null;
        if (!response.ok || !body) throw new Error(body?.error ?? "Could not load stock levels.");
        setData(body);
        setError("");
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Could not load stock levels.");
      });
    return () => controller.abort();
  }, [threshold]);

  const rows = showOut ? [...(data?.low ?? []), ...(data?.outOfStock ?? [])] : data?.low ?? [];
  const visible = showAll ? rows : rows.slice(0, PREVIEW);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-950">Running low</h2>
          <p className="mt-1 text-xs text-slate-500">Products with {threshold} or fewer left in stock</p>
        </div>
        <label className="text-xs font-semibold text-slate-500">
          <span className="sr-only">Low-stock level</span>
          <select
            value={threshold}
            onChange={(event) => { setThreshold(Number(event.target.value)); setShowAll(false); }}
            className="rounded-full border bg-white px-3 py-1.5 text-sm font-semibold text-slate-900"
          >
            {LEVELS.map((level) => <option key={level} value={level}>≤ {level} left</option>)}
          </select>
        </label>
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>
      ) : !data ? (
        <p className="mt-4 rounded-2xl bg-slate-50 p-5 text-center text-sm font-semibold text-slate-400">Loading…</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-amber-50 p-4">
              <p className="text-xs font-semibold text-amber-700">Running low</p>
              <p className="mt-1 text-2xl font-black text-slate-950">{data.low.length.toLocaleString()}</p>
            </div>
            <button
              type="button"
              onClick={() => { setShowOut((value) => !value); setShowAll(false); }}
              aria-pressed={showOut}
              className={`rounded-2xl p-4 text-left transition ${showOut ? "bg-red-100 ring-2 ring-red-300" : "bg-red-50 hover:bg-red-100"}`}
            >
              <p className="text-xs font-semibold text-red-700">Out of stock {showOut ? "(shown)" : "(tap to show)"}</p>
              <p className="mt-1 text-2xl font-black text-slate-950">{data.outOfStock.length.toLocaleString()}</p>
            </button>
          </div>

          {rows.length === 0 ? (
            <p className="mt-4 rounded-2xl bg-emerald-50 p-5 text-center text-sm font-semibold text-emerald-700">Nothing is running low.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {visible.map((item) => {
                const left = item.stock_quantity ?? 0;
                return (
                  <li key={item.id} className="flex items-center gap-3 py-3">
                    {item.image ? <img src={item.image} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-xl bg-white object-contain" /> : <span className="h-10 w-10 shrink-0 rounded-xl bg-slate-100" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-slate-900">{item.name}</span>
                      <span className="block truncate text-xs text-slate-500">{[item.brand, item.category].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${left <= 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>
                      {left <= 0 ? "Out" : `${left} left`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {rows.length > PREVIEW && (
              <button type="button" onClick={() => setShowAll((value) => !value)} className="rounded-full border px-4 py-2 text-sm font-semibold hover:border-red-500 hover:text-red-600">
                {showAll ? "Show less" : `Show all ${rows.length}`}
              </button>
            )}
            <button type="button" onClick={onOpenProducts} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              Open products
            </button>
          </div>
        </>
      )}
    </section>
  );
}
