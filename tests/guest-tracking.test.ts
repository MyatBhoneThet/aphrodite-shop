import { describe, expect, it } from "vitest";
import type { OrderRow } from "../app/lib/supabase";
import {
  guestTrackingView,
  normalizeOrderCode,
  orderCodeMatches,
  phoneTail,
  phonesMatch,
} from "../app/lib/guest-tracking";

/**
 * The signed-out delivery lookup is the only endpoint that answers questions
 * about an order with no session behind it, so what it matches on and what it
 * hands back both need holding still.
 */

const ORDER_ID = "cbf22014-1234-4000-8000-0123456789ab";

describe("phone matching", () => {
  it("treats the same line written different ways as one number", () => {
    // How a keypad, a contacts app and a careful typist each write it.
    expect(phonesMatch("09420082522", "+959420082522")).toBe(true);
    expect(phonesMatch("09 420 082 522", "09420082522")).toBe(true);
    expect(phonesMatch("+95 9 420 082 522", "09420082522")).toBe(true);
  });

  it("does not match a different number", () => {
    expect(phonesMatch("09420082522", "09759732167")).toBe(false);
    // Differing only in the last digit must not pass.
    expect(phonesMatch("09420082522", "09420082523")).toBe(false);
  });

  it("refuses a number too short to identify anyone", () => {
    expect(phonesMatch("12345", "12345")).toBe(false);
    expect(phoneTail("12345")).toHaveLength(5);
  });
});

describe("order code matching", () => {
  it("accepts the forms a customer actually has", () => {
    expect(orderCodeMatches(ORDER_ID, ORDER_ID)).toBe(true);
    expect(orderCodeMatches(ORDER_ID, "cbf22014")).toBe(true);
    expect(orderCodeMatches(ORDER_ID, "#cbf22014")).toBe(true);
    expect(orderCodeMatches(ORDER_ID, "  CBF22014 ")).toBe(true);
  });

  it("rejects a code short enough to guess", () => {
    // The phone number is the second factor, but a 3-character code would
    // match far too many orders for it to carry that weight.
    expect(orderCodeMatches(ORDER_ID, "cbf")).toBe(false);
    expect(orderCodeMatches(ORDER_ID, "cbf2201")).toBe(false);
    expect(orderCodeMatches(ORDER_ID, "")).toBe(false);
  });

  it("rejects a code that is not this order", () => {
    expect(orderCodeMatches(ORDER_ID, "cbf22015")).toBe(false);
    expect(normalizeOrderCode("#CBF-22014")).toBe("cbf22014");
  });
});

describe("what a signed-out caller is shown", () => {
  const order = {
    id: ORDER_ID,
    status: "shipped",
    created_at: "2026-09-19T10:00:00.000Z",
    shipping_name: "Myat Bhone Thet",
    shipping_phone: "09420082522",
    shipping_city: "Yangon",
    shipping_address: "22, Kyeik Wine Yeik Thar St., Mayangone",
    courier_name: "Flash express",
    delivery_tracking_number: "123456789",
    estimated_delivery_at: "2026-09-30T05:30:00.000Z",
    delivered_at: null,
    total_amount: 4_286_660,
    payment_status: "collected",
    admin_order_note: "customer sounded unsure, call before arriving",
    notes: "internal",
    delivery_latitude: 16.8,
    delivery_longitude: 96.1,
    profiles: { email: "customer@example.com", full_name: "Myat Bhone Thet", role: "normal" },
    order_items: [{ quantity: 2 }, { quantity: 1 }],
    delivery_events: [
      {
        stage: "handed_to_courier",
        title: "Handed to courier",
        description: "Picked up from the Yangon store",
        location_label: "Yangon",
        happened_at: "2026-09-19T12:00:00.000Z",
        visible_to_customer: true,
      },
      {
        stage: "packed",
        title: "Packed",
        description: null,
        location_label: null,
        happened_at: "2026-09-19T11:00:00.000Z",
        visible_to_customer: true,
      },
      {
        stage: "in_transit",
        title: "Internal note — courier disputed the address",
        description: "do not show the customer",
        location_label: null,
        happened_at: "2026-09-19T13:00:00.000Z",
        visible_to_customer: false,
      },
    ],
  } as unknown as OrderRow;

  const view = guestTrackingView(order);

  it("answers the question that was asked", () => {
    expect(view.code).toBe("cbf22014");
    expect(view.status).toBe("shipped");
    expect(view.courier).toBe("Flash express");
    expect(view.trackingNumber).toBe("123456789");
    expect(view.estimatedDeliveryAt).toBe("2026-09-30T05:30:00.000Z");
    expect(view.itemCount).toBe(3);
  });

  it("honours visible_to_customer, and orders events oldest first", () => {
    expect(view.events).toHaveLength(2);
    expect(view.events.map((event) => event.stage)).toEqual([
      "packed",
      "handed_to_courier",
    ]);
    expect(JSON.stringify(view)).not.toContain("do not show the customer");
  });

  it("gives away nothing beyond the delivery itself", () => {
    const serialized = JSON.stringify(view);

    // Money, contact details, the doorstep and every internal note stay in.
    expect(serialized).not.toContain("4286660");
    expect(serialized).not.toContain("customer@example.com");
    expect(serialized).not.toContain("Kyeik Wine");
    expect(serialized).not.toContain("collected");
    expect(serialized).not.toContain("sounded unsure");
    expect(serialized).not.toContain("16.8");

    // Enough to recognise your own order, and no more.
    expect(view.recipientName).toBe("Myat");
    expect(view.destination).toBe("Yangon");
  });

  it("keeps the whitelist closed when the orders table grows", () => {
    expect(Object.keys(view).sort()).toEqual([
      "code",
      "courier",
      "deliveredAt",
      "destination",
      "estimatedDeliveryAt",
      "events",
      "itemCount",
      "placedAt",
      "recipientName",
      "status",
      "statusDetail",
      "trackingNumber",
    ]);
  });
});
