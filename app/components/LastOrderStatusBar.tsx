"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authHeaders } from "../lib/client-auth";
import { useLanguage } from "../lib/language";
import { orderTracking, trackingSteps } from "../lib/order-tracking";
import { deliveredBannerHasExpired } from "../lib/order-status-visibility";
import { refundSteps, refundTracking, type RefundStep } from "../lib/refund-tracking";
import type { TranslationKey } from "../lib/translations";

type HeaderOrder = {
  id: string;
  status: string;
  created_at: string;
  updated_at?: string | null;
  delivered_at?: string | null;
  delivery_last_event_at?: string | null;
  return_request_status?: "none" | "requested" | "approved" | "pickup_scheduled" | "received" | "refunded" | "rejected";
  delivery_events?: { stage: string; happened_at: string }[];
  order_items?: {
    id: string;
    quantity: number;
    product?: { name?: string | null } | null;
  }[];
};

const returnSteps = ["requested", "approved", "pickup_scheduled", "received", "refunded"] as const;
type HeaderReturn = {
  id: string;
  order_id: string;
  status: "requested" | "more_info_needed" | "approved" | "declined" | "collected" | "inspected" | "refund_approved" | "completed" | "cancelled";
  created_at: string;
  expected_refund_at?: string | null;
  delay_reason?: string | null;
  refund_sent_at?: string | null;
};
const returnStatusKeys: Record<HeaderReturn["status"], TranslationKey> = {
  requested: "return.status.requested",
  more_info_needed: "return.status.more_info_needed",
  approved: "return.status.approved",
  declined: "return.status.declined",
  collected: "return.status.collected",
  inspected: "return.status.inspected",
  refund_approved: "return.status.refund_approved",
  completed: "return.status.completed",
  cancelled: "return.status.cancelled",
};
const refundStepKeys: Record<RefundStep, TranslationKey> = {
  request_received: "refund.step.request_received",
  under_review: "refund.step.under_review",
  item_received: "refund.step.item_received",
  refund_approved: "refund.step.refund_approved",
  money_sent: "refund.step.money_sent",
};
const orderReturnStepKeys: Record<(typeof returnSteps)[number], TranslationKey> = {
  requested: "return.order.requested",
  approved: "return.order.approved",
  pickup_scheduled: "return.order.pickup_scheduled",
  received: "return.order.received",
  refunded: "return.order.refunded",
};

export default function LastOrderStatusBar({ enabled }: { enabled: boolean }) {
  const { t, text, language } = useLanguage();
  const [order, setOrder] = useState<HeaderOrder | null>(null);
  const [itemReturn, setItemReturn] = useState<HeaderReturn | null>(null);

  useEffect(() => {
    if (!enabled) {
      queueMicrotask(() => setOrder(null));
      queueMicrotask(() => setItemReturn(null));
      return;
    }

    let active = true;
    let loading = false;
    const controller = new AbortController();

    async function loadLatestOrder() {
      if (loading) return;
      loading = true;
      try {
        const headers = authHeaders();
        const [orderResponse, returnResponse] = await Promise.all([
          fetch("/api/orders?limit=20", { headers, cache: "no-store", signal: controller.signal }),
          fetch("/api/returns", { headers, cache: "no-store", signal: controller.signal }),
        ]);
        if (!orderResponse.ok) return;
        const data = await orderResponse.json() as { orders?: HeaderOrder[] };
        const recentOrders = data.orders ?? [];
        const latestOrder = recentOrders[0] ?? null;
        let latestReturn: HeaderReturn | null = null;
        if (returnResponse.ok && latestOrder) {
          const returnData = await returnResponse.json() as { requests?: HeaderReturn[] };
          const requests = [...(returnData.requests ?? [])].sort(
            (left, right) => Date.parse(right.created_at) - Date.parse(left.created_at)
          );
          latestReturn = requests.find((request) =>
            !["completed", "declined", "cancelled"].includes(request.status) &&
            recentOrders.some((order) => order.id === request.order_id)
          ) ?? requests.find((request) => request.order_id === latestOrder.id) ?? null;
        }
        const displayedOrder = latestReturn
          ? recentOrders.find((candidate) => candidate.id === latestReturn.order_id) ?? latestOrder
          : latestOrder;
        // A delivered order's bar is only useful for a day; after that it just
        // confuses people, so it disappears (returns stay until they finish).
        const expired = !latestReturn && deliveredBannerHasExpired(displayedOrder);
        if (active && expired) {
          setOrder(null);
          setItemReturn(null);
        } else if (active) {
          setOrder(displayedOrder);
          setItemReturn(latestReturn?.order_id === displayedOrder?.id ? latestReturn : null);
        }
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

  const firstItem = order.order_items?.[0];
  const productName = firstItem?.product?.name?.trim() || `Order #${order.id.slice(0, 8).toUpperCase()}`;
  const extraItems = Math.max(0, (order.order_items?.length ?? 0) - 1);
  const returnStatus = order.return_request_status ?? "none";
  const isReturn = Boolean(itemReturn) || order.status === "returned" || returnStatus !== "none";

  if (isReturn) {
    const itemTracking = itemReturn ? refundTracking(itemReturn) : null;
    const visibleSteps = itemReturn ? refundSteps : returnSteps;
    const returnStep = itemTracking
      ? itemTracking.step
      : returnSteps.indexOf(returnStatus as (typeof returnSteps)[number]);
    const statusLabel = itemTracking
      ? itemTracking.stage
        ? t(`refund.step.${itemTracking.stage}`)
        : t(returnStatusKeys[itemReturn!.status])
      : returnStatus === "none"
        ? t("return.order.refunded")
        : t(`return.order.${returnStatus}`);
    const progress = returnStep < 0 ? 0 : ((returnStep + 1) / visibleSteps.length) * 100;

    return (
      <Link
        href={itemReturn ? "/returns" : "/orders"}
        className="order-status-banner group relative block overflow-hidden border-t border-emerald-200 bg-gradient-to-r from-emerald-950 via-teal-900 to-emerald-950 text-white focus-visible:outline-offset-[-3px]"
        aria-label={`${t("refund.title")}: ${productName}. ${statusLabel}`}
      >
        <div className="relative z-10 mx-auto max-w-[92rem] px-4 py-3 lg:px-6">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 lg:grid-cols-[auto_18rem_minmax(0,1fr)] lg:gap-x-6 lg:gap-y-0">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-300/50 bg-emerald-400/15 text-xl shadow-[0_0_24px_rgba(52,211,153,0.35)] motion-safe:animate-pulse" aria-hidden="true">↩</span>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">{t("refund.title")}</p>
              <p className="line-clamp-2 text-sm font-black sm:text-base lg:line-clamp-1">{productName}{firstItem && firstItem.quantity > 1 ? ` × ${firstItem.quantity}` : ""}</p>
              {extraItems > 0 && <p className="text-[11px] text-emerald-200">{language === "my" ? `နောက်ထပ် ${extraItems} မျိုး` : `+${extraItems} more product${extraItems === 1 ? "" : "s"}`}</p>}
            </div>
            <div className="col-span-2 min-w-0 lg:col-span-1">
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 text-xs font-bold text-emerald-100 sm:truncate sm:text-sm" role="status" aria-live="polite">{statusLabel}</p>
                <span className="shrink-0 text-[11px] font-bold text-emerald-200 transition group-hover:translate-x-1 sm:text-xs">{t("refund.view")} →</span>
              </div>
              {returnStep >= 0 && (
                <>
                  <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-white/20 lg:hidden"><span className="block h-full rounded-full bg-emerald-400 transition-[width] duration-700" style={{ width: `${progress}%` }} /></div>
                  <ol className="mt-2 hidden grid-cols-5 gap-2 lg:grid" aria-label={t("refund.title")}>
                    {visibleSteps.map((stage, index) => {
                      const complete = index <= returnStep;
                      const current = index === returnStep;
                      return <li key={stage} aria-current={current ? "step" : undefined} className="min-w-0">
                        <span className={`relative block h-1.5 overflow-visible rounded-full transition-colors duration-700 ${complete ? "bg-emerald-400" : "bg-white/20"}`}>{current && <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.9)] motion-safe:animate-pulse" />}</span>
                        <span className={`mt-1 block truncate text-[10px] font-bold ${complete ? "text-emerald-100" : "text-white/45"}`}>{itemReturn ? t(refundStepKeys[stage as RefundStep]) : t(orderReturnStepKeys[stage as (typeof returnSteps)[number]])}</span>
                      </li>;
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

  const tracking = orderTracking(order);
  const statusLabel = tracking.stage ? t(`tracking.${tracking.stage}`) : tracking.label;
  const progress = tracking.step < 0 ? 0 : ((tracking.step + 1) / trackingSteps.length) * 100;

  return (
    <Link
      href="/orders"
      className="order-status-banner group relative block overflow-hidden border-t border-emerald-200 bg-gradient-to-r from-emerald-950 via-teal-900 to-emerald-950 text-white focus-visible:outline-offset-[-3px]"
      aria-label={`${text("Last order process")}: ${productName}. ${statusLabel}`}
    >
      <div className="relative z-10 mx-auto max-w-[92rem] px-4 py-3 lg:px-6">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 lg:grid-cols-[auto_18rem_minmax(0,1fr)] lg:gap-x-6 lg:gap-y-0">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-300/50 bg-emerald-400/15 text-xl shadow-[0_0_24px_rgba(52,211,153,0.35)] motion-safe:animate-pulse" aria-hidden="true">
            🚚
          </span>

          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">
              {text("Last order process")}
            </p>
            <p className="line-clamp-2 text-sm font-black sm:text-base lg:line-clamp-1">
              {productName}{firstItem && firstItem.quantity > 1 ? ` × ${firstItem.quantity}` : ""}
            </p>
            {extraItems > 0 && (
              <p className="text-[11px] text-emerald-200">
                {language === "my" ? `နောက်ထပ် ${extraItems} မျိုး` : `+${extraItems} more product${extraItems === 1 ? "" : "s"}`}
              </p>
            )}
          </div>

          <div className="col-span-2 min-w-0 lg:col-span-1">
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 text-xs font-bold text-emerald-100 sm:truncate sm:text-sm" role="status" aria-live="polite">
                {statusLabel}
              </p>
              <span className="shrink-0 text-[11px] font-bold text-emerald-200 transition group-hover:translate-x-1 sm:text-xs">
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
