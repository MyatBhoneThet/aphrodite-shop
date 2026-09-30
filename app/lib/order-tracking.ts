import type { DeliveryEventStage } from "./supabase";

export const trackingLabels: Record<DeliveryEventStage, string> = {
  order_placed: "Order received",
  verification_pending: "Awaiting verification",
  verified: "Order verified",
  packed: "Packed",
  handed_to_courier: "Handed to courier",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  delivery_failed: "Delivery attempt failed",
};
export type TrackableOrder = {
  status: string;
  delivery_events?: { stage: string; happened_at: string }[];
};
export const trackingSteps = ["order_placed", "verified", "packed", "handed_to_courier", "out_for_delivery", "delivered"] as const;

export function orderTracking(order: TrackableOrder) {
  if (order.status === "cancelled" || order.status === "returned") {
    // No delivery stage: a translated view falls back to `label`.
    return { label: order.status === "cancelled" ? "Cancelled" : "Returned", stage: null, step: -1 };
  }
  if (order.status === "delivered") {
    return { label: trackingLabels.delivered, stage: "delivered" as DeliveryEventStage, step: 5 };
  }
  const ranks: Record<string, number> = { order_placed: 0, verification_pending: 0, verified: 1, packed: 2, handed_to_courier: 3, in_transit: 3, out_for_delivery: 4, delivered: 5 };
  let stage: DeliveryEventStage = order.status === "shipped" ? "handed_to_courier" : order.status === "confirmed" ? "verified" : "order_placed";
  let step = ranks[stage];
  for (const event of [...(order.delivery_events ?? [])].sort((a, b) => Date.parse(a.happened_at) - Date.parse(b.happened_at))) {
    if (event.stage === "delivery_failed") { stage = "delivery_failed"; continue; }
    if (event.stage in trackingLabels && ranks[event.stage] >= step) {
      stage = event.stage as DeliveryEventStage;
      step = ranks[stage];
    }
  }
  // `stage` lets a translated view look the label up itself; `label` stays for
  // the admin list and anything not translated yet.
  return { label: trackingLabels[stage], stage: stage as DeliveryEventStage | null, step };
}
