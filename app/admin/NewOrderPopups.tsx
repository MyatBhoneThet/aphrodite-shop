"use client";

import { useEffect, useRef, useState } from "react";
import { formatCurrency } from "../lib/format";
import { useAdminText } from "../lib/useAdminText";
import type { NewOrderPreview } from "./useNewOrderAlerts";

/** How long a popup stays before it tucks itself away. Hovering pauses it. */
const VISIBLE_MS = 15_000;

const PAYMENT_LABEL: Record<string, string> = {
  cash_on_delivery: "Cash on delivery",
  bank_transfer: "Bank transfer",
  mmqr: "MMQR",
};

function ageLabel(createdAt: string | undefined, a: (value: string) => string) {
  if (!createdAt) return a("just now");
  const minutes = Math.floor((Date.now() - Date.parse(createdAt)) / 60_000);
  if (minutes < 1) return a("just now");
  if (minutes < 60) return `${minutes} ${a("min ago")}`;
  return `${Math.floor(minutes / 60)} ${a("h ago")}`;
}

function OrderPopup({
  order,
  onClose,
  onView,
}: {
  order: NewOrderPreview;
  onClose: () => void;
  onView: () => void;
}) {
  const a = useAdminText();
  const [paused, setPaused] = useState(false);
  const remaining = useRef(VISIBLE_MS);
  const startedAt = useRef(0);

  // Counts down only while the pointer is away, so a popup being read is not
  // pulled out from under the admin.
  useEffect(() => {
    if (paused) return;
    startedAt.current = Date.now();
    const timer = window.setTimeout(onClose, Math.max(0, remaining.current));
    return () => {
      window.clearTimeout(timer);
      remaining.current -= Date.now() - startedAt.current;
    };
  }, [paused, onClose]);

  const payment = order.payment_method ? PAYMENT_LABEL[order.payment_method] : null;
  const first = order.items?.[0];
  const extra = Math.max(0, (order.item_count ?? 0) - (order.items?.length ?? 0));

  return (
    <article
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="order-popup-in pointer-events-auto relative w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_24px_60px_-18px_rgba(190,18,60,0.45)]"
    >
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-red-500 to-rose-700" />

      <div className="flex items-start gap-3 py-4 pl-5 pr-3">
        <span className="relative mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center">
          <span aria-hidden="true" className="order-popup-ring absolute inset-0 rounded-full bg-red-400" />
          <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-rose-700 text-white shadow-md">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8Z" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
          </span>
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-red-600">{a("New order")}</p>
            <p className="text-[11px] font-semibold text-zinc-400">{ageLabel(order.created_at, a)}</p>
          </div>
          <p className="mt-1 truncate text-base font-bold text-zinc-900">{order.shipping_name || a("A customer")}</p>
          <p className="text-xl font-black tracking-tight text-zinc-950">{formatCurrency(order.total_amount)}</p>

          {first && (
            <p className="mt-1 truncate text-sm text-zinc-600">
              {first.name} <span className="font-semibold text-zinc-800">× {first.quantity}</span>
              {extra > 0 && <span className="text-zinc-500"> · +{extra} {a("more")}</span>}
            </p>
          )}
          {payment && (
            <span className="mt-2 inline-block rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-bold text-zinc-700">{a(payment)}</span>
          )}

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={onView}
              className="rounded-full bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
            >
              {a("View order")}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-3 py-2 text-xs font-semibold text-zinc-500 hover:bg-zinc-100"
            >
              {a("Later")}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label={a("Close")}
          className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
        >
          <span aria-hidden="true" className="text-lg leading-none">×</span>
        </button>
      </div>

      <span
        aria-hidden="true"
        className="order-popup-timer absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-red-500 to-rose-300"
        style={{ animationDuration: `${VISIBLE_MS}ms`, animationPlayState: paused ? "paused" : "running" }}
      />
    </article>
  );
}

/**
 * Floating "new order" popups. They sit above everything on the admin page,
 * whatever panel is open, so an order is noticed without watching the header.
 */
export default function NewOrderPopups({
  popups,
  onClose,
  onView,
}: {
  popups: NewOrderPreview[];
  onClose: (id: string) => void;
  onView: () => void;
}) {
  if (popups.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 top-3 z-[90] flex flex-col gap-3 sm:inset-x-auto sm:right-5 sm:top-20 sm:w-[24rem]"
    >
      {popups.map((order) => (
        <OrderPopup key={order.id} order={order} onClose={() => onClose(order.id)} onView={onView} />
      ))}
    </div>
  );
}
