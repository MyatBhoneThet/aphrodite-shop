"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authHeaders } from "../lib/client-auth";
import { useLanguage } from "../lib/language";
import { orderTracking, trackingSteps } from "../lib/order-tracking";

type HeaderOrder = {
  id: string;
  status: string;
  created_at: string;
  delivery_events?: { stage: string; happened_at: string }[];
  order_items?: {
    id: string;
    quantity: number;
    product?: { name?: string | null } | null;
  }[];
};

export default function LastOrderStatusBar({ enabled }: { enabled: boolean }) {
  const { t, text, language } = useLanguage();
  const [order, setOrder] = useState<HeaderOrder | null>(null);

  useEffect(() => {
    if (!enabled) {
      queueMicrotask(() => setOrder(null));
      return;
    }

    let active = true;
    let loading = false;
    const controller = new AbortController();

    async function loadLatestOrder() {
      if (loading) return;
      loading = true;
      try {
        const response = await fetch("/api/orders?limit=1", {
          headers: authHeaders(),
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = await response.json() as { orders?: HeaderOrder[] };
        if (active) setOrder(data.orders?.[0] ?? null);
      } catch {
        // The header remains usable when the status request is offline.
      } finally {
        loading = false;
      }
    }

    void loadLatestOrder();
    const refresh = () => {
      if (document.visibilityState === "visible") void loadLatestOrder();
    };
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [enabled]);

  if (!enabled || !order) return null;

  const tracking = orderTracking(order);
  const statusLabel = tracking.stage ? t(`tracking.${tracking.stage}`) : tracking.label;
  const firstItem = order.order_items?.[0];
  const productName = firstItem?.product?.name?.trim() || `Order #${order.id.slice(0, 8).toUpperCase()}`;
  const extraItems = Math.max(0, (order.order_items?.length ?? 0) - 1);
  const progress = tracking.step < 0 ? 0 : ((tracking.step + 1) / trackingSteps.length) * 100;

  return (
    <Link
      href="/orders"
      className="order-status-banner group relative block overflow-hidden border-t border-emerald-200 bg-gradient-to-r from-emerald-950 via-teal-900 to-emerald-950 text-white focus-visible:outline-offset-[-3px]"
      aria-label={`${text("Last order process")}: ${productName}. ${statusLabel}`}
    >
      <div className="relative z-10 mx-auto max-w-[92rem] px-4 py-3 lg:px-6">
        <div className="flex items-center gap-3 lg:gap-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-300/50 bg-emerald-400/15 text-xl shadow-[0_0_24px_rgba(52,211,153,0.35)] motion-safe:animate-pulse" aria-hidden="true">
            🚚
          </span>

          <div className="min-w-0 shrink lg:w-72">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">
              {text("Last order process")}
            </p>
            <p className="truncate text-sm font-black sm:text-base">
              {productName}{firstItem && firstItem.quantity > 1 ? ` × ${firstItem.quantity}` : ""}
            </p>
            {extraItems > 0 && (
              <p className="text-[11px] text-emerald-200">
                {language === "my" ? `နောက်ထပ် ${extraItems} မျိုး` : `+${extraItems} more product${extraItems === 1 ? "" : "s"}`}
              </p>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm font-bold text-emerald-100" role="status" aria-live="polite">
                {statusLabel}
              </p>
              <span className="shrink-0 text-xs font-bold text-emerald-200 transition group-hover:translate-x-1">
                {text("View tracking")} →
              </span>
            </div>

            {tracking.step >= 0 && (
              <>
                <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-white/20 lg:hidden">
                  <span className="block h-full rounded-full bg-emerald-400 transition-[width] duration-700" style={{ width: `${progress}%` }} />
                </div>
                <ol className="mt-2 hidden grid-cols-6 gap-2 lg:grid" aria-label={text("Order tracking progress")}>
                  {trackingSteps.map((stage, index) => {
                    const complete = index <= tracking.step;
                    const current = index === tracking.step;
                    return (
                      <li key={stage} aria-current={current ? "step" : undefined} className="min-w-0">
                        <span className={`relative block h-1.5 overflow-visible rounded-full transition-colors duration-700 ${complete ? "bg-emerald-400" : "bg-white/20"}`}>
                          {current && <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.9)] motion-safe:animate-pulse" />}
                        </span>
                        <span className={`mt-1 block truncate text-[10px] font-bold ${complete ? "text-emerald-100" : "text-white/45"}`}>
                          {t(`tracking.${stage}`)}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
