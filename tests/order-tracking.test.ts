import { describe, expect, it } from "vitest";
import { orderTracking } from "../app/lib/order-tracking";

const event = (stage: string, day: number) => ({ stage, happened_at: `2026-09-${String(day).padStart(2, "0")}T12:00:00Z` });
describe("customer order tracking", () => {
  it("tracks older orders with no delivery events", () => {
    expect(orderTracking({ status: "pending" })).toEqual({ label: "Order received", stage: "order_placed", step: 0 });
    expect(orderTracking({ status: "confirmed" }).step).toBe(1);
    expect(orderTracking({ status: "shipped" }).step).toBe(3);
    expect(orderTracking({ status: "delivered" }).step).toBe(5);
  });
  it("uses dated admin updates regardless of response order", () => {
    expect(orderTracking({ status: "confirmed", delivery_events: [event("out_for_delivery", 3), event("packed", 1), event("in_transit", 2)] })).toEqual({ label: "Out for delivery", stage: "out_for_delivery", step: 4 });
  });
  it("shows a failed attempt and a subsequent delivery retry", () => {
    const delivery_events = [event("out_for_delivery", 1), event("delivery_failed", 2)];
    expect(orderTracking({ status: "shipped", delivery_events }).label).toBe("Delivery attempt failed");
    expect(orderTracking({ status: "shipped", delivery_events: [...delivery_events, event("out_for_delivery", 3)] }).label).toBe("Out for delivery");
  });
  it("does not let stale events override terminal order states", () => {
    for (const status of ["cancelled", "returned", "delivered"]) {
      expect(orderTracking({ status, delivery_events: [event("packed", 1)] }).label.toLowerCase()).toBe(status);
    }
  });
  it("ignores unknown stages and verification updates after dispatch", () => {
    expect(orderTracking({ status: "shipped", delivery_events: [event("unknown", 1), event("verified", 2)] }).step).toBe(3);
  });
});
