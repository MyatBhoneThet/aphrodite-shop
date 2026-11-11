"use client";

import type { DeliveryEstimate } from "../lib/delivery-estimate";
import type { Product } from "../data/products";
import { deliveryDateRange, productDeliveryEstimate } from "../lib/delivery-estimate";
import { useLanguage } from "../lib/language";

export default function DeliveryEstimateBadge({ estimate: destinationEstimate, product, compact = false, showDestination = true, mobileDense = false }: {
  estimate: DeliveryEstimate | null;
  product?: Pick<Product, "fullSpecs">;
  compact?: boolean;
  showDestination?: boolean;
  mobileDense?: boolean;
}) {
  const { language } = useLanguage();
  const estimate = productDeliveryEstimate(product, destinationEstimate);
  if (!estimate) return null;
  const dates = deliveryDateRange(estimate);
  const days = estimate.minDays === estimate.maxDays ? `${estimate.minDays}` : `${estimate.minDays}–${estimate.maxDays}`;
  const estimateText = language === "my"
    ? `ခန့်မှန်းရောက်ရှိချိန် ${dates} (${days} ရက်)`
    : `Estimated delivery ${dates} (${days} days)`;
  const destination = language === "my"
    ? `${estimate.township} မြို့နယ်သို့`
    : `To ${estimate.township} Township`;

  return <div className={compact
    ? mobileDense ? "mt-2 border-t border-zinc-100 pt-2 text-[10px] sm:mt-3 sm:pt-3 sm:text-xs" : "mt-3 border-t border-zinc-100 pt-3 text-xs"
    : "mt-4 rounded-xl border border-teal-200 bg-teal-50 p-3 text-xs sm:mt-6 sm:rounded-2xl sm:p-4 sm:text-base"}>
    <p className={`flex items-center gap-1.5 font-bold sm:gap-2 ${compact ? "text-teal-700" : "text-teal-800"}`}>
      <span aria-hidden="true">🚚</span>{estimateText}
    </p>
    {showDestination && estimate.township && <p className={`mt-1 ${compact ? "text-zinc-500" : "text-xs text-teal-900/70 sm:text-sm"}`}>{destination}</p>}
  </div>;
}
