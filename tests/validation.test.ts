import { describe, expect, it } from "vitest";
import {
  adminOrderCancellationSchema,
  adminOrderResolutionSchema,
  adminReturnWorkflowSchema,
  customerOrderActionSchema,
  orderInputSchema,
  productInputSchema,
  productUpdateSchema,
  registerInputSchema,
  tierInputSchema,
  wholesaleAccountUpdateSchema,
} from "../app/lib/validation";

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
      wholesaleAccountUpdateSchema.safeParse({ action: "grant" }).success
    ).toBe(true);
    expect(
      wholesaleAccountUpdateSchema.safeParse({
        action: "grant",
        price_list_id: "3f9d8e60-1111-4111-8111-000000000000",
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
      shipping_city: "Bangkok",
      shipping_state: "Bangkok",
      shipping_postal_code: "10110",
      shipping_country: "Thailand",
      payment_method: "cash_on_delivery",
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
    }).success).toBe(true);
    expect(adminOrderResolutionSchema.safeParse({
      action: "resolve_request",
      request_type: "return",
      decision: "approve",
      admin_note: "Refund issued.",
    }).success).toBe(true);
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
