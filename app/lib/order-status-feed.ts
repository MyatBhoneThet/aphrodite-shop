import { returnBannerHasExpired, statusBannerHasExpired } from "./order-status-visibility";

type BannerOrder = {
  id: string; status: string; created_at: string; updated_at?: string | null;
  delivered_at?: string | null; cancellation_resolved_at?: string | null;
  return_resolved_at?: string | null; return_request_status?: string | null;
};
type BannerReturn = {
  order_id: string; status: string; created_at: string;
  updated_at?: string | null; refund_sent_at?: string | null;
};
const closedReturns = new Set(["completed", "declined", "cancelled"]);

/** Keep every ongoing order visible, with its own most relevant return. */
export function orderStatusFeed<O extends BannerOrder, R extends BannerReturn>(orders: O[], requests: R[], now = Date.now()) {
  const returns = [...requests].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  return [...orders].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).flatMap(order => {
    const matching = returns.filter(request => request.order_id === order.id);
    const candidate = matching.find(request => !closedReturns.has(request.status)) ?? matching[0] ?? null;
    const itemReturn = candidate && !returnBannerHasExpired(candidate, now) ? candidate : null;
    return statusBannerHasExpired(order, itemReturn, now) ? [] : [{ order, itemReturn }];
  });
}
