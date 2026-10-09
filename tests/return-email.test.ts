import { describe, expect, it } from "vitest";
import { returnStatusEmailContent } from "../app/lib/return-email";
import type { ReturnRequestRow } from "../app/lib/supabase";

function request(overrides: Partial<ReturnRequestRow> = {}): ReturnRequestRow {
  return {
    id: "return-1",
    order_id: "12345678-abcd-4000-8000-123456789012",
    order_item_id: "line-1",
    customer_id: "customer-1",
    quantity: 2,
    reason_code: "defective",
    description: "Does not turn on",
    preferred_resolution: "refund",
    resolution_granted: "refund",
    collection_method: "store_dropoff",
    pickup_address: null,
    status: "requested",
    unboxing_video_confirmed: true,
    admin_decision_note: null,
    decided_by: null,
    decided_at: null,
    review_requested_at: null,
    review_request_note: null,
    created_at: "2026-09-24T00:00:00Z",
    updated_at: "2026-09-24T00:00:00Z",
    order_items: {
      id: "line-1",
      order_id: "12345678-abcd-4000-8000-123456789012",
      product_id: 1,
      quantity: 2,
      unit_price: 300000,
      products: { id: 1, name: "Test Laptop", brand: "Test", image: "/test.jpg" } as never,
    },
    profiles: { email: "customer@example.com", full_name: "Customer", role: "normal" },
    ...overrides,
  };
}

describe("return and refund status email", () => {
  it.each([
    ["requested", "Return request received"],
    ["approved", "Return approved — under review"],
    ["collected", "Item received for return"],
    ["inspected", "Item inspection completed"],
    ["refund_approved", "Refund approved"],
    ["completed", "Refund process completed"],
  ] as const)("creates the %s customer update", (event, heading) => {
    const content = returnStatusEmailContent(request(), event, {
      ...process.env,
      PUBLIC_SITE_URL: "https://shop.example.com",
    });

    expect(content.subject).toContain(heading);
    expect(content.text).toContain("Test Laptop × 2");
    expect(content.text).toContain("https://shop.example.com/orders");
  });

  it("includes money timing and trace details when the refund is sent", () => {
    const content = returnStatusEmailContent(
      request({
        status: "completed",
        refund_amount: 600000,
        refund_method: "bank_transfer",
        refund_reference: "KBZ-REF-123",
        expected_refund_at: "2026-09-30T08:30:00Z",
      }),
      "completed",
      { ...process.env, PUBLIC_SITE_URL: "https://shop.example.com" }
    );

    expect(content.text).toContain("MMK 600,000");
    expect(content.text).toContain("bank transfer");
    expect(content.text).toContain("KBZ-REF-123");
  });
});
