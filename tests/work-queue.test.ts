import { beforeEach, describe, expect, it, vi } from "vitest";
import { isOverdue, queueLane } from "../app/lib/work-queue";

const NOW = Date.parse("2026-09-20T00:00:00Z");

describe("work queue lanes", () => {
  it("sends an unchecked prepaid slip to the payment lane", () => {
    expect(
      queueLane({
        type: "order",
        status: "pending",
        payment_method: "bank_transfer",
        payment_verification_status: "pending",
      })
    ).toBe("awaiting_payment_check");
  });

  it("leaves cash-on-delivery orders out of the payment lane", () => {
    expect(
      queueLane({
        type: "order",
        status: "pending",
        payment_method: "cash_on_delivery",
        payment_verification_status: "not_required",
      })
    ).toBeNull();
  });

  it("does not re-queue a payment that has already been verified", () => {
    expect(
      queueLane({
        type: "order",
        status: "confirmed",
        payment_method: "mmqr",
        payment_verification_status: "verified",
      })
    ).toBeNull();
  });

  it("queues a shipped order whose delivery attempt failed", () => {
    expect(
      queueLane({ type: "order", status: "shipped", hasFailedDelivery: true })
    ).toBe("delivery_issue");
  });

  it("maps each help topic to its lane", () => {
    const lane = (topic: string) =>
      queueLane({ type: "help_case", topic, status: "open" });

    expect(lane("payment")).toBe("awaiting_payment_check");
    expect(lane("delivery")).toBe("delivery_issue");
    expect(lane("warranty")).toBe("warranty_repair");
    expect(lane("faulty_item")).toBe("return_review");
    // A cancellation is the same kind of work as reviewing a return.
    expect(lane("cancel_order")).toBe("return_review");
  });

  it("drops a resolved help case out of the queue", () => {
    expect(
      queueLane({ type: "help_case", topic: "delivery", status: "resolved" })
    ).toBeNull();
  });

  it("walks a return through review, inspection and refund", () => {
    const lane = (status: string) => queueLane({ type: "return_request", status });

    expect(lane("requested")).toBe("return_review");
    expect(lane("more_info_needed")).toBe("return_review");
    expect(lane("approved")).toBe("return_review");
    expect(lane("collected")).toBe("inspection");
    expect(lane("inspected")).toBe("refund_due");
    expect(lane("refund_approved")).toBe("refund_due");
  });

  it("takes finished and declined returns off the queue", () => {
    for (const status of ["completed", "declined", "cancelled"]) {
      expect(queueLane({ type: "return_request", status })).toBeNull();
    }
  });
});

describe("overdue flag", () => {
  it("flags only deadlines that have passed", () => {
    expect(isOverdue("2026-09-19T00:00:00Z", NOW)).toBe(true);
    expect(isOverdue("2026-09-21T00:00:00Z", NOW)).toBe(false);
  });

  it("treats a case with no deadline as not overdue", () => {
    expect(isOverdue(null, NOW)).toBe(false);
    expect(isOverdue(undefined, NOW)).toBe(false);
  });
});

vi.mock("../app/lib/supabase", async (importOriginal) => {
  const original = await importOriginal<typeof import("../app/lib/supabase")>();

  return {
    ...original,
    selectReturnRequestById: vi.fn(),
    updateReturnRequestService: vi.fn(),
    insertAuditLog: vi.fn(),
  };
});

const { advanceItemReturn } = await import("../app/lib/backend");
const { selectReturnRequestById, updateReturnRequestService, insertAuditLog } =
  await import("../app/lib/supabase");

function admin() {
  const profile = {
    id: "admin-1",
    email: "admin@example.com",
    full_name: "Admin",
    role: "admin" as const,
    wholesale_status: "not_applied" as const,
    price_list_id: null,
    phone: null,
  };

  return { id: "admin-1", email: profile.email, role: "admin" as const, profile, accessToken: "t" };
}

const approvedRefund = {
  id: "request-1",
  order_id: "order-1",
  order_item_id: "line-1",
  customer_id: "customer-1",
  quantity: 1,
  reason_code: "defective" as const,
  description: "Broken on arrival.",
  preferred_resolution: "refund" as const,
  resolution_granted: "refund" as const,
  collection_method: "store_dropoff" as const,
  pickup_address: null,
  status: "refund_approved",
  unboxing_video_confirmed: true,
  admin_decision_note: null,
  decided_by: null,
  decided_at: null,
  review_requested_at: null,
  review_request_note: null,
  refund_reference: null,
  created_at: "2026-09-16T00:00:00Z",
  updated_at: "2026-09-16T00:00:00Z",
};

beforeEach(() => {
  vi.mocked(selectReturnRequestById).mockReset().mockResolvedValue(approvedRefund as never);
  vi.mocked(updateReturnRequestService).mockReset().mockResolvedValue(approvedRefund as never);
  vi.mocked(insertAuditLog).mockReset().mockResolvedValue(undefined);
});

describe("payment reference is required before money is marked sent", () => {
  it("refuses to mark a refund sent with nothing to trace it by", async () => {
    await expect(
      advanceItemReturn(admin(), "request-1", { stage: "completed" })
    ).rejects.toMatchObject({ status: 400 });
    expect(updateReturnRequestService).not.toHaveBeenCalled();
  });

  it("records the reference when one is supplied", async () => {
    await advanceItemReturn(admin(), "request-1", {
      stage: "completed",
      refund_reference: "KBZ-8891234",
    });

    expect(updateReturnRequestService).toHaveBeenCalledWith(
      "request-1",
      expect.objectContaining({ status: "completed", refund_reference: "KBZ-8891234" })
    );
  });

  it("accepts a reference already stored on the request", async () => {
    vi.mocked(selectReturnRequestById).mockResolvedValue({
      ...approvedRefund,
      refund_reference: "AYA-5567",
    } as never);

    await advanceItemReturn(admin(), "request-1", { stage: "completed" });

    expect(updateReturnRequestService).toHaveBeenCalledWith(
      "request-1",
      expect.objectContaining({ refund_reference: "AYA-5567" })
    );
  });
});
