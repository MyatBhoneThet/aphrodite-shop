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
