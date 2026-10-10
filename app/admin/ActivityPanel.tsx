"use client";

import { useCallback, useEffect, useState } from "react";
import { authHeaders } from "@/app/lib/client-auth";
import { formatDateTime } from "@/app/lib/format";
import { actionLabel, categoryOf, changeSummary, targetLabel } from "@/app/lib/audit-describe";

type Entry = {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string;
  previous_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
  profiles: { full_name: string | null; email: string | null } | null;
};

type Page = { categories: { id: string; label: string }[]; entries: Entry[]; hasMore: boolean; nextOffset: number };

export default function ActivityPanel() {
  const [categories, setCategories] = useState<Page["categories"]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [category, setCategory] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (selected: string, offset: number) => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ offset: String(offset) });
      if (selected) query.set("category", selected);
      const response = await fetch(`/api/admin/activity?${query}`, { headers: authHeaders(), cache: "no-store" });
      const data = (await response.json().catch(() => null)) as (Page & { error?: string }) | null;
      if (!response.ok || !data) throw new Error(data?.error ?? "Could not load activity.");
      setCategories(data.categories);
      setEntries((current) => (offset === 0 ? data.entries : [...current, ...data.entries]));
      setHasMore(data.hasMore);
      setNextOffset(data.nextOffset);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load activity.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load("", 0), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function choose(next: string) {
    setCategory(next);
    setEntries([]);
    void load(next, 0);
  }

  const chip = (active: boolean) =>
    `rounded-full border px-4 py-1.5 text-sm font-semibold transition ${active ? "border-zinc-900 bg-zinc-900 text-white" : "bg-white hover:border-red-500 hover:text-red-600"}`;

  return (
    <section className="mt-6 rounded-2xl bg-white shadow-sm ring-1 ring-zinc-100">
      <div className="border-b px-5 py-4">
        <h2 className="font-bold">Activity log</h2>
        <p className="text-sm text-zinc-500">Who changed what, newest first. Covers orders, products, pricing, wholesale, staff, support and advertisements.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => choose("")} className={chip(category === "")}>All</button>
          {categories.map((item) => (
            <button key={item.id} type="button" onClick={() => choose(item.id)} className={chip(category === item.id)}>{item.label}</button>
          ))}
        </div>
      </div>

      {error && <p role="alert" className="m-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>}

      <ul className="divide-y">
        {entries.map((entry) => {
          const lines = changeSummary(entry);
          const group = categoryOf(entry.action);
          return (
            <li key={entry.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-semibold">{actionLabel(entry.action)}</p>
                <time dateTime={entry.created_at} className="text-xs text-zinc-500">{formatDateTime(entry.created_at)}</time>
              </div>
              <p className="mt-1 text-sm text-zinc-600">
                {entry.profiles?.full_name || entry.profiles?.email || (entry.actor_id ? "Unknown user" : "System")}
                {" · "}{targetLabel(entry)}
                {group && <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600">{group.label}</span>}
              </p>
              {lines.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-zinc-500">
                  {lines.map((line) => <li key={line} className="break-words">• {line}</li>)}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {!loading && !error && entries.length === 0 && <p className="p-8 text-center text-sm text-zinc-500">No activity recorded in this category yet.</p>}
      {loading && <p className="p-6 text-center text-sm font-semibold text-zinc-400">Loading…</p>}
      {hasMore && !loading && (
        <div className="border-t p-4 text-center">
          <button type="button" onClick={() => void load(category, nextOffset)} className="rounded-full border px-5 py-2 text-sm font-semibold hover:border-red-500 hover:text-red-600">Show older activity</button>
        </div>
      )}
    </section>
  );
}
