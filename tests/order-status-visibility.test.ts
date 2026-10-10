import { describe, expect, it } from "vitest";
import {
  DELIVERED_BANNER_LIFETIME_MS,
  deliveredBannerHasExpired,
  deliveredBannerTimestamp,
} from "../app/lib/order-status-visibility";

const deliveredAt = Date.parse("2026-09-24T02:30:00.000Z");

describe("homepage delivered-status visibility", () => {
  it("keeps the status visible until a full day has passed", () => {
    const order = {
      status: "delivered",
      delivered_at: new Date(deliveredAt).toISOString(),
    };

    expect(deliveredBannerHasExpired(order, deliveredAt + DELIVERED_BANNER_LIFETIME_MS - 1)).toBe(false);
    expect(deliveredBannerHasExpired(order, deliveredAt + DELIVERED_BANNER_LIFETIME_MS)).toBe(true);
  });

  it("uses the delivered tracking event when delivered_at is absent", () => {
    const order = {
      status: "delivered",
      delivery_events: [
        { stage: "packed", happened_at: "2026-09-23T10:00:00.000Z" },
        { stage: "delivered", happened_at: new Date(deliveredAt).toISOString() },
      ],
    };

    expect(deliveredBannerTimestamp(order)).toBe(deliveredAt);
    expect(deliveredBannerHasExpired(order, deliveredAt + DELIVERED_BANNER_LIFETIME_MS)).toBe(true);
  });

  it("falls back to the last delivery update for legacy delivered orders", () => {
    const order = {
      status: "delivered",
      delivered_at: "not-a-date",
      delivery_last_event_at: new Date(deliveredAt).toISOString(),
    };

    expect(deliveredBannerHasExpired(order, deliveredAt + DELIVERED_BANNER_LIFETIME_MS)).toBe(true);
  });

  it("never expires an order that is still being delivered", () => {
    expect(
      deliveredBannerHasExpired(
        { status: "shipped", updated_at: "2026-01-01T00:00:00.000Z" },
        deliveredAt
      )
    ).toBe(false);
  });
});

import { closedOrderBannerHasExpired, returnBannerHasExpired, statusBannerHasExpired } from "../app/lib/order-status-visibility";

describe("finished refunds, returns and cancellations", () => {
  const sent = Date.parse("2026-10-10T03:00:00.000Z");
  const DAY = DELIVERED_BANNER_LIFETIME_MS;

  it("keeps 'Money sent' for a day after the refund went out, then hides it", () => {
    const request = { status: "completed", refund_sent_at: new Date(sent).toISOString(), created_at: "2026-09-01T00:00:00.000Z" };
    expect(returnBannerHasExpired(request, sent + DAY - 1)).toBe(false);
    expect(returnBannerHasExpired(request, sent + DAY)).toBe(true);
  });

  it("measures from the refund, not from when the return was first requested", () => {
    const request = { status: "completed", refund_sent_at: new Date(sent).toISOString(), created_at: "2026-08-01T00:00:00.000Z" };
    expect(returnBannerHasExpired(request, sent + 60_000)).toBe(false);
  });

  it("hides declined and cancelled requests a day after their last update", () => {
    for (const status of ["declined", "cancelled"]) {
      const request = { status, updated_at: new Date(sent).toISOString() };
      expect(returnBannerHasExpired(request, sent + DAY - 1)).toBe(false);
      expect(returnBannerHasExpired(request, sent + DAY)).toBe(true);
    }
  });

  it("never hides a return or refund that is still in progress, however old", () => {
    for (const status of ["requested", "more_info_needed", "approved", "collected", "inspected", "refund_approved"]) {
      expect(returnBannerHasExpired({ status, updated_at: "2026-01-01T00:00:00.000Z" }, sent + 100 * DAY)).toBe(false);
    }
  });

  it("hides a cancelled order a day after it was cancelled", () => {
    const order = { status: "cancelled", cancellation_resolved_at: new Date(sent).toISOString() };
    expect(closedOrderBannerHasExpired(order, sent + DAY - 1)).toBe(false);
    expect(closedOrderBannerHasExpired(order, sent + DAY)).toBe(true);
  });

  it("hides an older-style closed return (refunded or rejected) a day later, but not an open one", () => {
    expect(closedOrderBannerHasExpired({ status: "delivered", return_request_status: "refunded", return_resolved_at: new Date(sent).toISOString() }, sent + DAY)).toBe(true);
    expect(closedOrderBannerHasExpired({ status: "delivered", return_request_status: "requested", return_resolved_at: new Date(sent).toISOString() }, sent + 9 * DAY)).toBe(false);
  });

  it("never hides an order that is still being processed", () => {
    for (const status of ["pending", "confirmed", "shipped"]) {
      expect(statusBannerHasExpired({ status, created_at: "2026-01-01T00:00:00.000Z" }, null, sent + 100 * DAY)).toBe(false);
    }
  });

  it("when the bar shows a refund, only the refund's own timing counts", () => {
    const order = { status: "delivered", delivered_at: "2026-01-01T00:00:00.000Z" }; // delivered long ago
    const open = { status: "refund_approved", updated_at: new Date(sent).toISOString() };
    const done = { status: "completed", refund_sent_at: new Date(sent).toISOString() };
    expect(statusBannerHasExpired(order, open, sent + 30 * DAY)).toBe(false);
    expect(statusBannerHasExpired(order, done, sent + 30 * DAY)).toBe(true);
    expect(statusBannerHasExpired(order, done, sent + 60_000)).toBe(false);
  });
});
