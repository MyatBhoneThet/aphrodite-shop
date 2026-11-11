import { describe, expect, it } from "vitest";
import { orderStatusFeed } from "../app/lib/order-status-feed";

const now = Date.parse("2026-11-10T08:00:00Z");
const fresh = "2026-11-10T07:00:00Z";
const old = "2026-11-01T07:00:00Z";

describe("homepage order updates", () => {
  it("retains every processing order, newest first, even when the newest finished order has expired", () => {
    const orders = [
      { id: "older-active", status: "confirmed", created_at: old },
      { id: "latest", status: "pending", created_at: fresh },
      { id: "finished", status: "delivered", created_at: old, delivered_at: old },
    ];
    expect(orderStatusFeed(orders, [], now).map(entry => entry.order.id)).toEqual(["latest", "older-active"]);
  });

  it("keeps recent cancellations visible, then expires them without hiding other orders", () => {
    const orders = [
      { id: "cancelled", status: "cancelled", created_at: old, cancellation_resolved_at: fresh },
      { id: "active", status: "shipped", created_at: old },
    ];
    expect(orderStatusFeed(orders, [], now).map(entry => entry.order.id)).toEqual(["cancelled", "active"]);
    expect(orderStatusFeed(orders, [], now + 86400000).map(entry => entry.order.id)).toEqual(["active"]);
  });

  it("pairs returns with their own orders and keeps an old order with an open refund", () => {
    const orders = [
      { id: "one", status: "pending", created_at: fresh },
      { id: "two", status: "delivered", created_at: old, delivered_at: old },
    ];
    const requests = [{ order_id: "two", status: "approved", created_at: old }];
    const feed = orderStatusFeed(orders, requests, now);
    expect(feed.map(entry => entry.order.id)).toEqual(["one", "two"]);
    expect(feed[0].itemReturn).toBeNull();
    expect(feed[1].itemReturn?.order_id).toBe("two");
  });

  it("does not let an expired return hide an order that is still being delivered", () => {
    const orders = [{ id: "one", status: "shipped", created_at: old }];
    const requests = [{ order_id: "one", status: "declined", created_at: old, updated_at: old }];
    expect(orderStatusFeed(orders, requests, now)).toEqual([{ order: orders[0], itemReturn: null }]);
  });
});
