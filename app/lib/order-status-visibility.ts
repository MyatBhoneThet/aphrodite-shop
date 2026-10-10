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

// ---------------------------------------------------------------------------
// Finished refunds, returns and cancellations
//
// The home-page bar follows an order while something is still happening. Once
// it is over, it stays for a day (so the customer sees the good news) and then
// goes away. While a return or refund is still in progress it never expires.
// ---------------------------------------------------------------------------

const FINISHED_RETURN_STATUSES = new Set(["completed", "declined", "cancelled"]);

const firstTimestamp = (...candidates: (string | null | undefined)[]) => {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const time = Date.parse(candidate);
    if (Number.isFinite(time)) return time;
  }
  return null;
};

const hasExpired = (timestamp: number | null, now: number) =>
  timestamp !== null && now - timestamp >= DELIVERED_BANNER_LIFETIME_MS;

type ReturnForBanner = {
  status?: string | null;
  refund_sent_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

/** A return/refund that is finished (money sent, declined or cancelled) and has been for a day. */
export function returnBannerHasExpired(request: ReturnForBanner | null | undefined, now = Date.now()) {
  if (!request || !request.status || !FINISHED_RETURN_STATUSES.has(request.status)) return false;
  const finishedAt =
    request.status === "completed"
      ? firstTimestamp(request.refund_sent_at, request.updated_at, request.created_at)
      : firstTimestamp(request.updated_at, request.created_at);
  return hasExpired(finishedAt, now);
}

type OrderForFinishedBanner = DeliveredOrderForBanner & {
  cancellation_resolved_at?: string | null;
  return_request_status?: string | null;
  return_resolved_at?: string | null;
};

/** A cancelled order, or one whose older-style return/refund is closed, a day after it ended. */
export function closedOrderBannerHasExpired(order: OrderForFinishedBanner | null | undefined, now = Date.now()) {
  if (!order) return false;
  if (order.status === "cancelled") {
    return hasExpired(firstTimestamp(order.cancellation_resolved_at, order.updated_at, order.created_at), now);
  }
  const returnClosed = order.status === "returned" || order.return_request_status === "refunded" || order.return_request_status === "rejected";
  if (returnClosed) {
    return hasExpired(firstTimestamp(order.return_resolved_at, order.updated_at, order.created_at), now);
  }
  return false;
}

/**
 * Whether the home-page bar should disappear: the thing it shows is finished
 * (delivered, cancelled, refund sent...) and a day has passed. `itemReturn` is
 * the per-item return/refund the bar would show instead of the order, if any.
 */
export function statusBannerHasExpired(
  order: OrderForFinishedBanner | null | undefined,
  itemReturn: ReturnForBanner | null | undefined,
  now = Date.now()
) {
  if (itemReturn) return returnBannerHasExpired(itemReturn, now);
  return deliveredBannerHasExpired(order, now) || closedOrderBannerHasExpired(order, now);
}
