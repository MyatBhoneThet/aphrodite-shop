export const DELIVERED_BANNER_LIFETIME_MS = 24 * 60 * 60 * 1000;

type DeliveredOrderForBanner = {
  status?: string | null;
  delivered_at?: string | null;
  delivery_last_event_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  delivery_events?: { stage: string; happened_at: string }[];
};

/** Finds the best available server timestamp for the delivered milestone. */
export function deliveredBannerTimestamp(order: DeliveredOrderForBanner) {
  const deliveredEvents = (order.delivery_events ?? [])
    .filter((event) => event.stage === "delivered")
    .map((event) => Date.parse(event.happened_at))
    .filter(Number.isFinite);

  const candidates = [
    order.delivered_at,
    deliveredEvents.length > 0 ? new Date(Math.max(...deliveredEvents)).toISOString() : null,
    order.delivery_last_event_at,
    // Older orders may predate the delivered_at migration. These final
    // fallbacks prevent a completed banner from remaining on the homepage
    // forever when those legacy rows are encountered.
    order.updated_at,
    order.created_at,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const timestamp = Date.parse(candidate);
    if (Number.isFinite(timestamp)) return timestamp;
  }

  return null;
}

export function deliveredBannerHasExpired(
  order: DeliveredOrderForBanner | null | undefined,
  now = Date.now()
) {
  if (!order || order.status !== "delivered") return false;
  const deliveredAt = deliveredBannerTimestamp(order);
  return deliveredAt !== null && now - deliveredAt >= DELIVERED_BANNER_LIFETIME_MS;
}
