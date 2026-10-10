"use client";

import { useEffect, useMemo, useState } from "react";
import { authHeaders } from "@/app/lib/client-auth";
import { formatDateTime } from "@/app/lib/format";

type FeedbackItem = {
  id: string;
  order_id: string;
  rating: number;
  note: string | null;
  created_at: string;
  updated_at: string;
  profiles: { full_name: string | null; email: string | null } | null;
};

type FeedbackData = {
  summary: { total: number; average: number; counts: Record<string, number>; limit: number };
  items: FeedbackItem[];
};

const PAGE = 15;

function Stars({ value, size = "text-base" }: { value: number; size?: string }) {
  return (
    <span className={`${size} tracking-tight`} role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => <span key={star} className={star <= value ? "text-amber-400" : "text-slate-200"}>★</span>)}
    </span>
  );
}

export default function FeedbackPanel() {
  const [data, setData] = useState<FeedbackData | null>(null);
  const [error, setError] = useState("");
  const [rating, setRating] = useState(0); // 0 = all
  const [onlyNotes, setOnlyNotes] = useState(false);
  const [visible, setVisible] = useState(PAGE);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/feedback", { headers: authHeaders(), cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as (FeedbackData & { error?: string }) | null;
        if (!response.ok || !body) throw new Error(body?.error ?? "Could not load feedback.");
        setData(body);
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Could not load feedback.");
      });
    return () => controller.abort();
  }, []);

  const filtered = useMemo(
    () => (data?.items ?? []).filter((item) => (!rating || item.rating === rating) && (!onlyNotes || item.note?.trim())),
    [data, rating, onlyNotes]
  );

  if (error) return <p role="alert" className="mt-6 rounded-2xl bg-red-50 p-5 text-sm font-semibold text-red-700">{error}</p>;
  if (!data) return <p className="mt-6 rounded-2xl bg-white p-8 text-center text-sm font-semibold text-zinc-400 shadow-sm">Loading feedback…</p>;

  const { summary } = data;
  const max = Math.max(1, ...Object.values(summary.counts));

  return (
    <div className="mt-6 space-y-5">
      <section className="grid gap-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-100 sm:grid-cols-[auto_1fr] sm:p-6">
        <div className="text-center sm:pr-8">
          <p className="text-5xl font-black">{summary.total ? summary.average.toFixed(1) : "–"}</p>
          <Stars value={Math.round(summary.average)} size="text-xl" />
          <p className="mt-1 text-xs font-semibold text-zinc-500">
            {summary.total.toLocaleString()} {summary.total === 1 ? "review" : "reviews"}
            {summary.total >= summary.limit ? ` (latest ${summary.limit})` : ""}
          </p>
        </div>
        <div className="space-y-1.5">
          {[5, 4, 3, 2, 1].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => { setRating(rating === star ? 0 : star); setVisible(PAGE); }}
              aria-pressed={rating === star}
              className={`flex w-full items-center gap-3 rounded-lg px-2 py-1 text-sm transition hover:bg-zinc-50 ${rating === star ? "bg-amber-50 ring-1 ring-amber-200" : ""}`}
            >
              <span className="w-10 shrink-0 text-left font-semibold">{star} ★</span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                <span className="block h-full rounded-full bg-amber-400" style={{ width: `${((summary.counts[star] ?? 0) / max) * 100}%` }} />
              </span>
              <span className="w-10 shrink-0 text-right tabular-nums text-zinc-500">{summary.counts[star] ?? 0}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-zinc-100">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 className="font-bold">Customer feedback</h2>
            <p className="text-sm text-zinc-500" role="status">
              {filtered.length === summary.total ? `${summary.total} reviews` : `${filtered.length} of ${summary.total} reviews`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2 font-semibold">
              <input type="checkbox" checked={onlyNotes} onChange={(event) => { setOnlyNotes(event.target.checked); setVisible(PAGE); }} />
              Only with notes
            </label>
            {(rating > 0 || onlyNotes) && (
              <button type="button" onClick={() => { setRating(0); setOnlyNotes(false); setVisible(PAGE); }} className="rounded-full border px-4 py-1.5 font-semibold hover:border-red-500 hover:text-red-600">Clear</button>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-zinc-500">{summary.total === 0 ? "No feedback yet. It appears here after customers rate an order." : "No feedback matches these filters."}</p>
        ) : (
          <ul className="divide-y">
            {filtered.slice(0, visible).map((item) => (
              <li key={item.id} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Stars value={item.rating} />
                    <span className="font-semibold">{item.profiles?.full_name || item.profiles?.email || "Customer"}</span>
                  </div>
                  <span className="text-xs text-zinc-500">{formatDateTime(item.created_at)}</span>
                </div>
                {item.note?.trim() ? (
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-zinc-700">{item.note}</p>
                ) : (
                  <p className="mt-2 text-sm italic text-zinc-400">No written note</p>
                )}
                <p className="mt-2 text-xs text-zinc-400">
                  Order #{item.order_id.slice(0, 8).toUpperCase()}
                  {item.profiles?.email && item.profiles.full_name ? ` · ${item.profiles.email}` : ""}
                  {item.updated_at !== item.created_at ? " · edited" : ""}
                </p>
              </li>
            ))}
          </ul>
        )}

        {filtered.length > visible && (
          <div className="border-t p-4 text-center">
            <button type="button" onClick={() => setVisible((count) => count + PAGE)} className="rounded-full border px-5 py-2 text-sm font-semibold hover:border-red-500 hover:text-red-600">
              Show more ({filtered.length - visible})
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
