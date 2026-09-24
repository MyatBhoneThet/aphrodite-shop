"use client";

import type { DeliveryEstimate } from "../lib/delivery-estimate";
import { deliveryDateRange } from "../lib/delivery-estimate";
import { useLanguage } from "../lib/language";

export default function DeliveryEstimateBadge({ estimate, compact = false, showDestination = true }: {
  estimate: DeliveryEstimate | null;
  compact?: boolean;
  showDestination?: boolean;
}) {
  const { language } = useLanguage();
  if (!estimate) return null;
  const dates = deliveryDateRange(estimate);
  const estimateText = language === "my"
    ? `ခန့်မှန်းရောက်ရှိချိန် ${dates} (${estimate.minDays}–${estimate.maxDays} ရက်)`
    : `Estimated delivery ${dates} (${estimate.minDays}–${estimate.maxDays} days)`;
  const destination = language === "my"
    ? `${estimate.township} မြို့နယ်သို့`
    : `To ${estimate.township} Township`;

  return <div className={compact
    ? "mt-3 border-t border-zinc-100 pt-3 text-xs"
    : "mt-6 rounded-2xl border border-teal-200 bg-teal-50 p-4"}>
    <p className={`flex items-center gap-2 font-bold ${compact ? "text-teal-700" : "text-teal-800"}`}>
      <span aria-hidden="true">🚚</span>{estimateText}
    </p>
    {showDestination && <p className={`mt-1 ${compact ? "text-zinc-500" : "text-sm text-teal-900/70"}`}>{destination}</p>}
  </div>;
}
