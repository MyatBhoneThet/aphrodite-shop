import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../app/lib/supabase", async (importOriginal) => {
  const original = await importOriginal<typeof import("../app/lib/supabase")>();
  return {
    ...original,
    selectOrderById: vi.fn(),
    insertPaymentSlip: vi.fn(),
    uploadPaymentSlipObject: vi.fn(),
    updateOrderPaymentService: vi.fn(),
    insertAuditLog: vi.fn(),
  };
});

import { addPaymentSlip, verifyOrderPayment } from "../app/lib/backend";
import { orderMutationSchema } from "../app/lib/validation";
import {
  insertAuditLog,
  insertPaymentSlip,
  selectOrderById,
  updateOrderPaymentService,
  uploadPaymentSlipObject,
  type CurrentUser,
  type OrderRow,
  type Profile,
} from "../app/lib/supabase";

const TOTAL = 500_000;

function user(role: "admin" | "normal" = "admin"): CurrentUser {
  const profile: Profile = {
    id: "user-1", email: "person@example.com", full_name: "Person", role,
    wholesale_status: "not_applied", price_list_id: null, phone: null,
  };
  return { id: "user-1", email: profile.email, role, profile, accessToken: "token" };
}

function order(overrides: Partial<OrderRow> = {}): OrderRow {
  return {
    id: "order-1", user_id: "user-1", status: "pending", total_amount: TOTAL,
    shipping_name: "Swan Yi", shipping_phone: "09420082522",
    shipping_address: "No. 9, Yangon", payment_method: "bank_transfer",
    payment_status: "unpaid", payment_account: "kbz",
    payment_verification_status: "pending",
    payment_slips: [{ id: "slip-1" }], cod_verification_status: "approved",
    cancellation_request_status: "none", return_request_status: "none",
    admin_order_note: null, notes: null,
    created_at: "2026-09-16T01:00:00Z", updated_at: "2026-09-16T01:00:00Z",
    ...overrides,
  } as unknown as OrderRow;
}

const correction = (extra: Record<string, unknown> = {}) => ({
  action: "verify_payment",
  decision: "correction_requested",
  correction_reason: "short_payment",
  reason: "We received 300,000 by KBZ. Please send the rest to the same account.",
  amount_received: 300_000,
  ...extra,
});

beforeEach(() => {
  vi.mocked(selectOrderById).mockReset().mockResolvedValue(order());
  vi.mocked(insertPaymentSlip).mockReset().mockResolvedValue({ id: "slip-2" } as never);
  vi.mocked(uploadPaymentSlipObject).mockReset().mockResolvedValue(undefined);
  vi.mocked(updateOrderPaymentService).mockReset().mockResolvedValue(null as never);
  vi.mocked(insertAuditLog).mockReset().mockResolvedValue(undefined);
});

describe("validating a correction request", () => {
  it("accepts a fully described short payment", () => {
    expect(orderMutationSchema.safeParse(correction()).success).toBe(true);
  });

  it("refuses a correction with no reason chosen", () => {
    const parsed = orderMutationSchema.safeParse(correction({ correction_reason: undefined }));
    expect(parsed.success).toBe(false);
  });

  it("refuses a correction the customer could not act on", () => {
    // A one-word explanation leaves the customer guessing.
    const parsed = orderMutationSchema.safeParse(correction({ reason: "wrong" }));
    expect(parsed.success).toBe(false);
  });

  it("refuses a short payment with no counted amount", () => {
    const parsed = orderMutationSchema.safeParse(correction({ amount_received: undefined }));
    expect(parsed.success).toBe(false);
  });

  it("allows an unreadable slip to carry no amount at all", () => {
    const parsed = orderMutationSchema.safeParse(
      correction({
        correction_reason: "unclear_slip",
        amount_received: undefined,
        reason: "The photo is too dark to read. Please send a clearer picture of the slip.",
      })
    );
    expect(parsed.success).toBe(true);
  });

  it("still refuses a negative amount", () => {
    expect(orderMutationSchema.safeParse(correction({ amount_received: -1 })).success).toBe(false);
  });
});

describe("recording a correction request", () => {
  it("stores what arrived and keeps the money uncollected", async () => {
    await verifyOrderPayment(user(), "order-1", {
      decision: "correction_requested",
      correction_reason: "short_payment",
      amount_received: 300_000,
      reason: "We received 300,000 by KBZ.",
    });

    const fields = vi.mocked(updateOrderPaymentService).mock.calls[0][1];
    expect(fields).toMatchObject({
      payment_verification_status: "correction_requested",
      payment_amount_received: 300_000,
      payment_correction_reason: "short_payment",
      payment_status: "unpaid",
    });
    // Nothing is verified, so fulfilment stays blocked.
    expect(fields.payment_verified_at).toBeNull();
  });

  it("records an unreadable slip as not counted rather than as zero", async () => {
    await verifyOrderPayment(user(), "order-1", {
      decision: "correction_requested",
      correction_reason: "unclear_slip",
      reason: "The photo is too dark to read.",
    });

    expect(vi.mocked(updateOrderPaymentService).mock.calls[0][1].payment_amount_received).toBeNull();
  });

  it("refuses a correction that is actually the full total", async () => {
    await expect(
      verifyOrderPayment(user(), "order-1", {
        decision: "correction_requested",
        correction_reason: "short_payment",
        amount_received: TOTAL,
        reason: "Full amount arrived.",
      })
    ).rejects.toThrow(/verify the payment instead/i);
    expect(updateOrderPaymentService).not.toHaveBeenCalled();
  });

  it("refuses a correction before any slip exists", async () => {
    vi.mocked(selectOrderById).mockResolvedValue(order({ payment_slips: [] }));

    await expect(
      verifyOrderPayment(user(), "order-1", {
        decision: "correction_requested",
        correction_reason: "unclear_slip",
        reason: "Nothing to look at yet.",
      })
    ).rejects.toThrow(/no slip to correct/i);
  });

  it("refuses a correction on a cash-on-delivery order", async () => {
    vi.mocked(selectOrderById).mockResolvedValue(order({ payment_method: "cash_on_delivery" }));

    await expect(
      verifyOrderPayment(user(), "order-1", {
        decision: "correction_requested",
        correction_reason: "short_payment",
        amount_received: 1,
        reason: "Not applicable here.",
      })
    ).rejects.toThrow(/cash on delivery/i);
  });

  it("is refused for a customer", async () => {
    await expect(
      verifyOrderPayment(user("normal"), "order-1", {
        decision: "correction_requested",
        correction_reason: "short_payment",
        amount_received: 1,
        reason: "Customers cannot do this.",
      })
    ).rejects.toThrow();
    expect(updateOrderPaymentService).not.toHaveBeenCalled();
  });

  it("clears the correction when the payment is finally verified", async () => {
    vi.mocked(selectOrderById).mockResolvedValue(
      order({ payment_verification_status: "correction_requested", payment_amount_received: 300_000 })
    );

    await verifyOrderPayment(user(), "order-1", { decision: "verified" });

    expect(vi.mocked(updateOrderPaymentService).mock.calls[0][1]).toMatchObject({
      payment_verification_status: "verified",
      payment_status: "collected",
      payment_correction_reason: null,
      payment_rejected_reason: null,
    });
  });
});

describe("the customer answering a correction", () => {
  it("puts the order back in the queue but keeps what already arrived", async () => {
    vi.mocked(selectOrderById).mockResolvedValue(
      order({
        payment_verification_status: "correction_requested",
        payment_amount_received: 300_000,
        payment_correction_reason: "short_payment",
      })
    );

    await addPaymentSlip(
      user("normal"),
      "order-1",
      new File([new Uint8Array(1024)], "slip.png", { type: "image/png" }),
      "Remaining 200,000"
    );

    const fields = vi.mocked(updateOrderPaymentService).mock.calls[0][1];
    expect(fields).toMatchObject({
      payment_verification_status: "pending",
      payment_correction_reason: null,
      payment_rejected_reason: null,
    });
    // The admin adds the new slip to what was already counted, so the earlier
    // figure must survive this write.
    expect(fields).not.toHaveProperty("payment_amount_received");
  });
});
