import type { DeliveryEventStage, OrderRow } from "./supabase";

/**
 * Looking up a delivery without signing in.
 *
 * Customers were having to create or recover an account just to answer "where
 * is my order", which is the one question they ask most and the one they ask
 * on someone else's phone. This module holds the matching rules and, more
 * importantly, decides exactly which fields a stranger may see.
 *
 * Two things have to line up before anything is returned: the order code from
 * the confirmation email, and the phone number on the order. The code alone is
 * not treated as a secret -- customers read it out, paste it into chat, and
 * the short form shown in the UI is only eight characters -- so the phone is
 * what actually gates the lookup. The endpoint is rate limited on top of that
 * (app/api/track/route.ts), which is what makes guessing impractical.
 */

/** Digits only, so "09 420 082 522", "+959420082522" and "09420082522" match. */
export function phoneDigits(value: string) {
  return value.replace(/\D+/g, "");
}

/**
 * The last digits of a phone number, used to compare two numbers written
 * differently.
 *
 * Myanmar numbers reach us as 09xxxxxxxxx from a keypad and +959xxxxxxxxx from
 * a contacts app; the same line, two spellings, differing only in the prefix.
 * Comparing the tail matches both. Eight digits is long enough that it is not
 * a meaningful weakening -- the caller still has to know the order code, and
 * the endpoint is rate limited.
 */
export function phoneTail(value: string, length = 8) {
  const digits = phoneDigits(value);
  return digits.slice(-length);
}

/** True when two phone numbers are the same line, however each was written. */
export function phonesMatch(a: string, b: string) {
  const left = phoneTail(a);
  const right = phoneTail(b);

  return left.length >= 6 && left === right;
}

/**
 * Accepts an order code the way customers actually have it: the full id from
 * the email, or the short "#cbf22014" the site and the emails display.
 */
export function normalizeOrderCode(value: string) {
  return value.trim().replace(/^#/, "").replaceAll("-", "").toLowerCase();
}

/** True when `code` is the order's full id or its short display form. */
export function orderCodeMatches(orderId: string, code: string) {
  const normalized = normalizeOrderCode(code);
  const id = orderId.replaceAll("-", "").toLowerCase();

  // Shorter than the eight characters the UI shows would match far too many
  // orders for the phone number to be doing the work it is here to do.
  if (normalized.length < 8) return false;

  return id === normalized || id.startsWith(normalized);
}

export type GuestTrackingEvent = {
  stage: DeliveryEventStage | string;
  happened_at: string;
  title: string;
  description: string | null;
  location: string | null;
};

export type GuestTrackingView = {
  code: string;
  status: OrderRow["status"];
  placedAt: string;
  courier: string | null;
  trackingNumber: string | null;
  estimatedDeliveryAt: string | null;
  statusDetail: string | null;
  deliveredAt: string | null;
  recipientName: string;
  /** Town/city only -- enough to confirm the right order, not the doorstep. */
  destination: string | null;
  itemCount: number;
  events: GuestTrackingEvent[];
};

/**
 * The only shape this feature ever returns to an unauthenticated caller.
 *
 * Written as an explicit whitelist rather than by deleting fields from the
 * row: a column added to `orders` later cannot leak through here by accident,
 * which is the failure mode a blocklist has. Deliberately absent are the money
 * (prices, totals, payment status), the email address, the full street
 * address, the GPS point, and every internal note -- none of which answers
 * "where is my order", and all of which would be worth something to somebody
 * who got hold of a code and a phone number.
 */
export function guestTrackingView(order: OrderRow): GuestTrackingView {
  return {
    code: order.id.replaceAll("-", "").slice(0, 8).toLowerCase(),
    status: order.status,
    placedAt: order.created_at,
    courier: order.courier_name ?? null,
    trackingNumber: order.delivery_tracking_number ?? null,
    estimatedDeliveryAt: order.estimated_delivery_at ?? null,
    statusDetail: order.delivery_status_detail ?? null,
    deliveredAt: order.delivered_at ?? null,
    // First name only: enough for the customer to recognise their own order
    // without printing somebody's full name for a lucky guess.
    recipientName: order.shipping_name.trim().split(/\s+/)[0] ?? "",
    destination: order.shipping_city?.trim() || null,
    itemCount: (order.order_items ?? []).reduce(
      (total, item) => total + (item.quantity ?? 0),
      0
    ),
    events: (order.delivery_events ?? [])
      // Staff can mark an event internal-only; that flag is the whole reason
      // it exists, and it must be honoured here above all.
      .filter((event) => event.visible_to_customer)
      .sort((a, b) => Date.parse(a.happened_at) - Date.parse(b.happened_at))
      .map((event) => ({
        stage: event.stage,
        happened_at: event.happened_at,
        title: event.title,
        description: event.description ?? null,
        location: event.location_label ?? null,
      })),
  };
}
