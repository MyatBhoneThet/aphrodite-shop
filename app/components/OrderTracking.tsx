"use client";

import { useLanguage } from "../lib/language";
import { orderTracking, trackingSteps, type TrackableOrder } from "../lib/order-tracking";

export default function OrderTracking({ order }: { order: TrackableOrder }) {
  const { t } = useLanguage();
  const tracking = orderTracking(order);
  return <section aria-label="Order tracking" className="mb-5 rounded-2xl border border-zinc-200 p-4">
    <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Order tracking</p>
    <p className="mt-1 text-lg font-bold" role="status">{tracking.stage ? t(`tracking.${tracking.stage}`) : tracking.label}</p>
    {tracking.step >= 0 && <ol className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-6" aria-label="Delivery progress">
      {trackingSteps.map((stage, index) => <li key={stage} aria-current={index === tracking.step ? "step" : undefined} className={`border-t-4 pt-2 text-xs ${index <= tracking.step ? "border-emerald-600 font-semibold text-emerald-800" : "border-zinc-200 text-zinc-500"}`}>
        {t(`tracking.${stage}`)}{index === tracking.step && <span className="sr-only"> (current stage)</span>}
      </li>)}
    </ol>}
  </section>;
}
