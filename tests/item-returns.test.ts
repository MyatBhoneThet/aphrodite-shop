import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../app/lib/supabase", async (importOriginal) => {
  const original = await importOriginal<typeof import("../app/lib/supabase")>();

  return {
    ...original,
    selectOrderById: vi.fn(),
    insertReturnRequest: vi.fn(),
    selectReturnRequestById: vi.fn(),
    updateReturnRequestService: vi.fn(),
    insertReturnEvidence: vi.fn(),
    insertAuditLog: vi.fn(),
  };
});

import {
  advanceItemReturn,
  createItemReturnRequest,
  decideReturnRequest,
  requestReturnReview,
} from "../app/lib/backend";
import {
  insertAuditLog,
  insertReturnEvidence,
  insertReturnRequest,
  selectOrderById,
  selectReturnRequestById,
  updateReturnRequestService,
  type CurrentUser,
  type OrderRow,
  type Profile,
  type ReturnRequestRow,
} from "../app/lib/supabase";

const DELIVERED_AT = "2026-09-14T00:00:00Z";
const NOW = new Date("2026-09-16T00:00:00Z");

function user(role: Profile["role"] = "normal"): CurrentUser {
  const id = role === "admin" ? "admin-1" : "customer-1";
  const profile: Profile = {
    id,
    email: `${role}@example.com`,
    full_name: role,
    role,
    wholesale_status: "not_applied",
    price_list_id: null,
    phone: null,
  };

  return { id, email: profile.email, role, profile, accessToken: "token" };
}

function order(overrides: Partial<OrderRow> = {}): OrderRow {
  return {
    id: "order-1",
    user_id: "customer-1",
    status: "delivered",
    delivered_at: DELIVERED_AT,
    total_amount: 1500000,
    shipping_name: "Customer",
    shipping_phone: "0912345678",
    shipping_address: "12 Test Road, Yangon",
    shipping_address_line1: "12 Test Road",
    shipping_address_line2: null,
    shipping_city: "Yangon",
    shipping_state: "Yangon Region",
    shipping_postal_code: "11181",
    shipping_country: "Myanmar",
    payment_method: "cash_on_delivery",
    payment_status: "collected",
    cancellation_request_status: "none",
    cancellation_reason: null,
    cancellation_requested_at: null,
    cancellation_resolved_at: null,
    return_request_status: "none",
    return_reason: null,
    return_requested_at: null,
    return_resolved_at: null,
    admin_order_note: null,
    notes: null,
    created_at: "2026-09-10T00:00:00Z",
    updated_at: "2026-09-10T00:00:00Z",
    order_items: [
      { id: "line-laptop", order_id: "order-1", product_id: 1, quantity: 1, unit_price: 1400000 },
      { id: "line-mouse", order_id: "order-1", product_id: 2, quantity: 2, unit_price: 50000 },
    ],
    ...overrides,
  };
}

function request(overrides: Partial<ReturnRequestRow> = {}): ReturnRequestRow {
  return {
    id: "request-1",
    order_id: "order-1",
    order_item_id: "line-mouse",
    customer_id: "customer-1",
    quantity: 1,
    reason_code: "defective",
    description: "The left button does not click at all.",
    preferred_resolution: "replacement",
    resolution_granted: null,
    collection_method: "store_dropoff",
    pickup_address: null,
    status: "requested",
    unboxing_video_confirmed: true,
    admin_decision_note: null,
    decided_by: null,
    decided_at: null,
    review_requested_at: null,
    review_request_note: null,
    created_at: "2026-09-16T00:00:00Z",
    updated_at: "2026-09-16T00:00:00Z",
    ...overrides,
  };
}

const validInput = {
  order_id: "order-1",
  order_item_id: "line-mouse",
  quantity: 1,
  reason_code: "defective" as const,
  description: "The left button does not click at all.",
  preferred_resolution: "replacement" as const,
  collection_method: "store_dropoff" as const,
  unboxing_video_confirmed: true,
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.mocked(selectOrderById).mockReset().mockResolvedValue(order());
  vi.mocked(insertReturnRequest).mockReset().mockResolvedValue(request());
  vi.mocked(selectReturnRequestById).mockReset().mockResolvedValue(request());
  vi.mocked(updateReturnRequestService).mockReset().mockResolvedValue(request());
  vi.mocked(insertReturnEvidence).mockReset().mockResolvedValue(undefined as never);
  vi.mocked(insertAuditLog).mockReset().mockResolvedValue(undefined);
});

describe("per-item return requests", () => {
  it("returns only the line the customer picked", async () => {
    await createItemReturnRequest(user(), validInput);

    expect(insertReturnRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        order_id: "order-1",
        order_item_id: "line-mouse",
        customer_id: "customer-1",
        quantity: 1,
      })
    );
  });

  it("refuses a return before the order is delivered", async () => {
    vi.mocked(selectOrderById).mockResolvedValue(
      order({ status: "shipped", delivered_at: null })
    );

    await expect(createItemReturnRequest(user(), validInput)).rejects.toMatchObject({
      status: 409,
    });
    expect(insertReturnRequest).not.toHaveBeenCalled();
  });

  it("refuses a return once the 7-day window has closed", async () => {
    vi.setSystemTime(new Date("2026-09-25T00:00:00Z"));

    await expect(createItemReturnRequest(user(), validInput)).rejects.toMatchObject({
      status: 409,
    });
    expect(insertReturnRequest).not.toHaveBeenCalled();
  });

  it("refuses a line that is not on this order", async () => {
    await expect(
      createItemReturnRequest(user(), { ...validInput, order_item_id: "line-other" })
    ).rejects.toMatchObject({ status: 400 });
    expect(insertReturnRequest).not.toHaveBeenCalled();
  });

  it("refuses to return more units than were bought", async () => {
    await expect(
      createItemReturnRequest(user(), { ...validInput, quantity: 5 })
    ).rejects.toMatchObject({ status: 400 });
    expect(insertReturnRequest).not.toHaveBeenCalled();
  });

  it("stores a customer's video link against the request", async () => {
    await createItemReturnRequest(user(), {
      ...validInput,
      evidence_url: "https://drive.google.com/file/abc",
    });

    expect(insertReturnEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        return_request_id: "request-1",
        evidence_kind: "unboxing_video",
        external_url: "https://drive.google.com/file/abc",
      })
    );
  });
});

describe("administrator decisions", () => {
  it("only lets an administrator decide", async () => {
    await expect(
      decideReturnRequest(user(), "request-1", { decision: "approve" })
    ).rejects.toMatchObject({ status: 403 });
    expect(updateReturnRequestService).not.toHaveBeenCalled();
  });

  it("grants the customer's preferred outcome unless staff picks another", async () => {
    await decideReturnRequest(user("admin"), "request-1", { decision: "approve" });

    expect(updateReturnRequestService).toHaveBeenCalledWith(
      "request-1",
      expect.objectContaining({ status: "approved", resolution_granted: "replacement" })
    );
  });

  it("records a decline with its explanation", async () => {
    await decideReturnRequest(user("admin"), "request-1", {
      decision: "decline",
      note: "The photos show physical damage from a drop, which is not covered.",
    });

    expect(updateReturnRequestService).toHaveBeenCalledWith(
      "request-1",
      expect.objectContaining({
        status: "declined",
        admin_decision_note:
          "The photos show physical damage from a drop, which is not covered.",
      })
    );
    expect(insertAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "return_request.declined" })
    );
  });

  it("puts a declined request back in the queue when the customer asks again", async () => {
    vi.mocked(selectReturnRequestById).mockResolvedValue(request({ status: "declined" }));

    await requestReturnReview(user(), "request-1", "The drop happened after delivery.");

    expect(updateReturnRequestService).toHaveBeenCalledWith(
      "request-1",
      expect.objectContaining({
        status: "requested",
        review_request_note: "The drop happened after delivery.",
      })
    );
  });

  it("will not let a second review be requested while one is pending", async () => {
    vi.mocked(selectReturnRequestById).mockResolvedValue(
      request({ status: "declined", review_requested_at: "2026-09-16T00:00:00Z" })
    );

    await expect(
      requestReturnReview(user(), "request-1", "Please look again at the video.")
    ).rejects.toMatchObject({ status: 409 });
  });

  it("keeps the collected/inspected/completed ladder in order", async () => {
    vi.mocked(selectReturnRequestById).mockResolvedValue(request({ status: "requested" }));

    await expect(
      advanceItemReturn(user("admin"), "request-1", { stage: "completed" })
    ).rejects.toMatchObject({ status: 409 });

    vi.mocked(selectReturnRequestById).mockResolvedValue(request({ status: "approved" }));
    await advanceItemReturn(user("admin"), "request-1", { stage: "collected" });

    expect(updateReturnRequestService).toHaveBeenCalledWith(
      "request-1",
      expect.objectContaining({ status: "collected" })
    );
  });
});
