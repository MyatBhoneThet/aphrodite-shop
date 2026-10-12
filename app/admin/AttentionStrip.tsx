"use client";

import { useCallback, useEffect, useState } from "react";
import type { UserRole } from "@/app/data/products";
import type { OrderFilters } from "@/app/lib/admin-order-filter";
import { authHeaders } from "@/app/lib/client-auth";
import { useAdminText } from "@/app/lib/useAdminText";
import type { AdminPanelId } from "./types";

type Attention = {
  slipsToCheck: number;
  awaitingPayment: number;
  toShip: number;
  openReturns: number;
  refundsToSend: number;
};

type Tile = {
  key: string;
  label: string;
  count: number;
  hint?: string;
  tone: "red" | "amber" | "blue";
  go: () => void;
};

const TONES = {
  red: "border-red-200 bg-red-50 text-red-800",
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  blue: "border-blue-200 bg-blue-50 text-blue-900",
} as const;

/**
 * "Needs attention today": the few counts a shop owner wants first thing.
 * Every tile opens the screen where the work is done; a tile with nothing to
 * do is left out, and when everything is zero the strip says so.
 */
export default function AttentionStrip({
  role,
  onNavigate,
}: {
  role: UserRole;
  onNavigate: (panel: AdminPanelId, ordersFilter?: Partial<OrderFilters>) => void;
}) {
  const a = useAdminText();
  const [data, setData] = useState<Attention | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/attention", { headers: authHeaders(), cache: "no-store" });
      if (!response.ok) throw new Error("attention unavailable");
      const body = (await response.json()) as { attention: Attention };
      setData(body.attention);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    // Counts move all day as orders come in and get handled.
    const timer = window.setInterval(() => void load(), 60_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [load]);

  if (failed && !data) return null;
  if (!data) {
    return <div aria-hidden="true" className="h-24 animate-pulse rounded-3xl bg-slate-100" />;
  }

  const tiles: Tile[] = [];
  if (role === "admin" && data.slipsToCheck > 0) {
    tiles.push({
      key: "slips",
      label: a("Payment slips to check"),
      count: data.slipsToCheck,
      hint: data.awaitingPayment > 0 ? `${data.awaitingPayment} ${a("more waiting for the customer to pay")}` : undefined,
      tone: "red",
      go: () => onNavigate("orders", { status: "pending" }),
    });
  }
  if (data.toShip > 0) {
    tiles.push({
      key: "ship",
      label: a("Orders to ship"),
      count: data.toShip,
      hint: a("Verified — pack and hand to the courier"),
      tone: "amber",
      go: () => onNavigate("orders", { status: "confirmed" }),
    });
  }
  if (role === "admin" && data.openReturns > 0) {
    tiles.push({
      key: "returns",
      label: a("Open returns & cancellations"),
      count: data.openReturns,
      tone: "red",
      go: () => onNavigate("queue"),
    });
  }
  if (role === "admin" && data.refundsToSend > 0) {
    tiles.push({
      key: "refunds",
      label: a("Refunds to send"),
      count: data.refundsToSend,
      tone: "blue",
      go: () => onNavigate("orders", { status: "cancelled" }),
    });
  }

  return (
    <section
      aria-label={a("Needs attention today")}
      className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <h2 className="text-sm font-black uppercase tracking-wider text-slate-500">{a("Needs attention today")}</h2>

      {tiles.length === 0 ? (
        <p className="mt-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          ✅ {a("All clear — nothing is waiting for you right now.")}
        </p>
      ) : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {tiles.map((tile) => (
            <li key={tile.key}>
              <button
                type="button"
                onClick={tile.go}
                className={`flex h-full w-full flex-col items-start rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none ${TONES[tile.tone]}`}
              >
                <span className="text-3xl font-black tabular-nums">{tile.count.toLocaleString()}</span>
                <span className="mt-1 text-sm font-bold">{tile.label}</span>
                {tile.hint && <span className="mt-1 text-xs opacity-80">{tile.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
