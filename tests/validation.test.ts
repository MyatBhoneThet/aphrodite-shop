import { describe, expect, it } from "vitest";
import {
  adminOrderCancellationSchema,
  adminDeliveryUpdateSchema,
  adminDeliveryProgressSchema,
  adminOrderResolutionSchema,
  adminReturnWorkflowSchema,
  customerOrderActionSchema,
  orderInputSchema,
  pcBuildCartInputSchema,
  productInputSchema,
  productUpdateSchema,
  registerInputSchema,
  returnRequestInputSchema,
  tierInputSchema,
  wholesaleAccountUpdateSchema,
} from "../app/lib/validation";

describe("PC build cart validation", () => {
  it("accepts 20 identical builds and rejects invalid bulk requests", () => {
    expect(pcBuildCartInputSchema.safeParse({
      product_ids: [1, 2, 3, 4, 5, 6, 7, 8],
      quantity: 20,
    }).success).toBe(true);
    expect(pcBuildCartInputSchema.safeParse({ product_ids: [], quantity: 20 }).success).toBe(false);
    expect(pcBuildCartInputSchema.safeParse({ product_ids: [1, 2], quantity: 0 }).success).toBe(false);
    expect(pcBuildCartInputSchema.safeParse({ product_ids: [1, 2], quantity: 1000 }).success).toBe(false);
  });
});

describe("tier input validation", () => {
  const valid = {
    price_list_id: "3f9d8e60-1111-4111-8111-000000000000",
    product_id: 1,
    min_quantity: 10,
    unit_price: 48_000,
  };

  it("accepts a valid tier", () => {
    expect(tierInputSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects negative prices", () => {
    expect(tierInputSchema.safeParse({ ...valid, unit_price: -1 }).success).toBe(false);
  });

  it("rejects zero or negative minimum quantities", () => {
    expect(tierInputSchema.safeParse({ ...valid, min_quantity: 0 }).success).toBe(false);
    expect(tierInputSchema.safeParse({ ...valid, min_quantity: -5 }).success).toBe(false);
  });

  it("rejects non-integer values", () => {
    expect(tierInputSchema.safeParse({ ...valid, min_quantity: 2.5 }).success).toBe(false);
  });

  it("rejects a malformed price list id", () => {
    expect(
      tierInputSchema.safeParse({ ...valid, price_list_id: "not-a-uuid" }).success
    ).toBe(false);
  });
});

describe("product input validation", () => {
  const valid = {
    name: "Laptop",
    type: "laptop",
    category: "Laptop",
    brand: "Apple",
    price: 100,
    image: "/x.png",
    stock: "In Stock",
  };

  it("rejects negative stock quantities", () => {
    expect(
      productInputSchema.safeParse({ ...valid, stockQuantity: -1 }).success
    ).toBe(false);
  });

  it("accepts a non-negative stock quantity", () => {
    expect(
      productInputSchema.safeParse({ ...valid, stockQuantity: 250 }).success
    ).toBe(true);
  });

  it("rejects an empty product patch", () => {
    expect(productUpdateSchema.safeParse({}).success).toBe(false);
  });
});

describe("registration cannot smuggle privileges", () => {
  it("strips role and wholesale fields from the payload", () => {
    const parsed = registerInputSchema.parse({
      email: "new@example.com",
      password: "longenough",
      role: "wholesale",
      wholesale_status: "approved",
    });

    expect(parsed).toEqual({
      email: "new@example.com",
      password: "longenough",
    });
  });
});

describe("wholesale account update validation", () => {
  it("accepts every admin action", () => {
    expect(
      wholesaleAccountUpdateSchema.safeParse({ action: "grant", business_name: "Example shop", business_review_note: "Business callback and address checked", business_verified: true }).success
    ).toBe(true);
    expect(
      wholesaleAccountUpdateSchema.safeParse({
        action: "grant",
        price_list_id: "3f9d8e60-1111-4111-8111-000000000000",
        business_name: "Example shop", business_review_note: "Business callback and address checked", business_verified: true,
      }).success
    ).toBe(true);
    expect(
      wholesaleAccountUpdateSchema.safeParse({ action: "revoke" }).success
    ).toBe(true);
    expect(
      wholesaleAccountUpdateSchema.safeParse({ action: "suspend" }).success
    ).toBe(true);
  });

  it("rejects unknown actions and malformed price lists", () => {
    expect(
      wholesaleAccountUpdateSchema.safeParse({ action: "approve" }).success
    ).toBe(false);
    expect(
      wholesaleAccountUpdateSchema.safeParse({
        action: "assign_price_list",
        price_list_id: "not-a-uuid",
      }).success
    ).toBe(false);
  });
});

describe("order input validation", () => {
  it("accepts expected_total but has no field for prices or line items", () => {
    const parsed = orderInputSchema.parse({
      shipping_name: "A Customer",
      shipping_phone: "0812345678",
      shipping_address: "Somewhere 123",
      shipping_country: "Myanmar",
      shipping_state: "Yangon",
      cod_confirmation: true,
      cod_contact_confirmation: true,
      expected_total: 480000,
      // Injected junk that must be dropped:
      total_amount: 1,
      lines: [{ unit_price: 1 }],
    } as never);

    expect(parsed.expected_total).toBe(480000);
    expect("total_amount" in parsed).toBe(false);
    expect("lines" in parsed).toBe(false);
  });

  it("accepts a complete structured COD delivery address", () => {
    const parsed = orderInputSchema.parse({
      shipping_name: "A Customer",
      shipping_phone: "+66 81 234 5678",
      shipping_address_line1: "123 Test Road",
      shipping_address_line2: "Unit 4",
      shipping_city: "Yangon",
      shipping_state: "Yangon",
      shipping_postal_code: "10110",
      shipping_country: "Myanmar",
      payment_method: "cash_on_delivery",
      cod_confirmation: true,
      cod_contact_confirmation: true,
      delivery_location_consent: true,
      delivery_location: {
        latitude: 16.8661,
        longitude: 96.1951,
        accuracy_m: 25,
        captured_at: "2026-09-02T10:00:00.000Z",
      },
    });
    expect(parsed.payment_method).toBe("cash_on_delivery");
  });

  it("rejects incomplete COD addresses and unsupported payment methods", () => {
    expect(orderInputSchema.safeParse({
      shipping_name: "A Customer",
      shipping_phone: "0812345678",
      shipping_address_line1: "123 Test Road",
      payment_method: "card",
    }).success).toBe(false);
  });
});

describe("order lifecycle validation", () => {
  it("accepts only customer-visible delivery progress milestones", () => {
    for (const stage of ["verified", "packed", "handed_to_courier", "out_for_delivery", "delivered"]) {
      expect(adminDeliveryProgressSchema.safeParse({
        action: "advance_delivery_progress",
        stage,
      }).success).toBe(true);
    }
    expect(adminDeliveryProgressSchema.safeParse({
      action: "advance_delivery_progress",
      stage: "in_transit",
    }).success).toBe(false);
  });

  it("accepts customer requests and administrator resolutions", () => {
    expect(customerOrderActionSchema.safeParse({
      action: "request_cancellation",
      reason: "I ordered the wrong model.",
    }).success).toBe(true);
    expect(customerOrderActionSchema.safeParse({
      action: "request_return",
      reason: "The package arrived damaged.",
      reason_code: "damaged_in_transit",
      pickup_method: "courier_pickup",
      pickup_address: "123 Test Road, Bangkok",
      evidence_url: "https://example.com/evidence",
      evidence_attestation: true,
    }).success).toBe(true);
    expect(adminOrderResolutionSchema.safeParse({
      action: "resolve_request",
      request_type: "return",
      decision: "approve",
      admin_note: "Refund issued.",
    }).success).toBe(true);
  });

  it("validates admin COD and delivery timeline updates", () => {
    expect(adminDeliveryUpdateSchema.safeParse({
      action: "update_delivery",
      verification_status: "phone_verified",
      verification_method: "phone_callback",
      courier_name: "Example Courier",
      tracking_number: "MM-123",
      estimated_delivery_at: "2026-09-05T16:00:00+06:30",
      stage: "in_transit",
      event_title: "Package is travelling to Yangon",
    }).success).toBe(true);
    expect(adminDeliveryUpdateSchema.safeParse({
      action: "update_delivery",
      verification_status: "approved",
      stage: "in_transit",
    }).success).toBe(false);
  });

  it("validates cancellation, pickup, inspection, and refund administration", () => {
    expect(adminOrderCancellationSchema.safeParse({
      action: "admin_cancel",
      reason_code: "out_of_stock",
      reason: "Item is unavailable after verification.",
    }).success).toBe(true);
    expect(adminReturnWorkflowSchema.safeParse({
      action: "advance_return",
      stage: "schedule_pickup",
      scheduled_for: "2026-08-25T03:00:00.000Z",
    }).success).toBe(true);
    expect(adminReturnWorkflowSchema.safeParse({
      action: "advance_return",
      stage: "mark_received",
      restock_approved: false,
    }).success).toBe(true);
    expect(adminReturnWorkflowSchema.safeParse({
      action: "advance_return",
      stage: "complete_refund",
      refund_method: "bank_transfer",
      refund_amount: 50000,
    }).success).toBe(true);
  });

  it("requires a pickup address for courier returns", () => {
    expect(customerOrderActionSchema.safeParse({
      action: "request_return",
      reason: "Wrong storage size.",
      reason_code: "wrong_storage",
      pickup_method: "courier_pickup",
      pickup_address: "",
    }).success).toBe(false);
  });
});

describe("return payout and service date validation", () => {
  const base = {
    order_id: "3f9d8e60-1111-4111-8111-000000000000",
    order_item_id: "4f9d8e60-1111-4111-8111-000000000000",
    quantity: 1,
    reason_code: "defective",
    description: "The product does not turn on at all.",
    collection_method: "store_dropoff",
    unboxing_video_confirmed: false,
  };

  it("requires payout account details for a refund", () => {
    expect(returnRequestInputSchema.safeParse({ ...base, preferred_resolution: "refund" }).success).toBe(false);
    expect(returnRequestInputSchema.safeParse({
      ...base,
      preferred_resolution: "refund",
      refund_bank_name: "KBZ",
      refund_account_name: "Customer Name",
      refund_account_number: "123456789",
    }).success).toBe(true);
  });

  it("requires a preferred date for replacement or repair", () => {
    expect(returnRequestInputSchema.safeParse({ ...base, preferred_resolution: "repair" }).success).toBe(false);
    expect(returnRequestInputSchema.safeParse({
      ...base,
      preferred_resolution: "replacement",
      preferred_service_at: "2026-09-30T03:30:00.000Z",
    }).success).toBe(true);
  });
});
