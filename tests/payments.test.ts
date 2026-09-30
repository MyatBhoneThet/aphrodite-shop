import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../app/lib/supabase", async (importOriginal) => {
  const original = await importOriginal<typeof import("../app/lib/supabase")>();
  return {
    ...original,
    selectOrderById: vi.fn(),
    insertPaymentSlip: vi.fn(),
    uploadPaymentSlipObject: vi.fn(),
    updateOrderPaymentService: vi.fn(),
    updateOrderStatus: vi.fn(),
    insertAuditLog: vi.fn(),
  };
});

import { addPaymentSlip, patchOrderStatus, verifyOrderPayment } from "../app/lib/backend";
import { orderInputSchema, orderMutationSchema } from "../app/lib/validation";
import {
  insertAuditLog,
  insertPaymentSlip,
  selectOrderById,
  updateOrderPaymentService,
  updateOrderStatus,
  uploadPaymentSlipObject,
  type CurrentUser,
  type OrderRow,
  type Profile,
} from "../app/lib/supabase";

function user(role: "admin" | "normal" = "admin"): CurrentUser {
  const profile: Profile = {
    id: "user-1", email: "person@example.com", full_name: "Person", role,
    wholesale_status: "not_applied", price_list_id: null, phone: null,
  };
  return { id: "user-1", email: profile.email, role, profile, accessToken: "token" };
}

function order(overrides: Partial<OrderRow> = {}): OrderRow {
  return {
    id: "order-1", user_id: "user-1", status: "pending", total_amount: 3_750_660,
    shipping_name: "Swan Yi", shipping_phone: "09420082522",
    shipping_address: "No. 9, Yangon", payment_method: "bank_transfer",
    payment_status: "unpaid", payment_account: "kbz",
    payment_verification_status: "pending", payment_slips: [],
    cod_verification_status: "approved", courier_name: "Royal Express",
    delivery_tracking_number: "RX-1", cancellation_request_status: "none",
    return_request_status: "none", admin_order_note: null, notes: null,
    created_at: "2026-09-16T01:00:00Z", updated_at: "2026-09-16T01:00:00Z",
    ...overrides,
  } as unknown as OrderRow;
}

const slipFile = (type = "image/png", size = 1024) =>
  new File([new Uint8Array(size)], "slip.png", { type });

beforeEach(() => {
  vi.mocked(selectOrderById).mockReset().mockResolvedValue(order());
  vi.mocked(insertPaymentSlip).mockReset().mockResolvedValue({ id: "slip-1" } as never);
  vi.mocked(uploadPaymentSlipObject).mockReset().mockResolvedValue(undefined);
  vi.mocked(updateOrderPaymentService).mockReset().mockResolvedValue(null as never);
  vi.mocked(updateOrderStatus).mockReset().mockResolvedValue(null as never);
  vi.mocked(insertAuditLog).mockReset().mockResolvedValue(undefined);
});

describe("uploading a transfer slip", () => {
  it("stores the file privately and puts the order back in the queue", async () => {
    vi.mocked(selectOrderById).mockResolvedValue(
      order({ payment_verification_status: "rejected" })
    );

    await addPaymentSlip(user("normal"), "order-1", slipFile(), "KBZ transfer");

    expect(uploadPaymentSlipObject).toHaveBeenCalled();
    expect(vi.mocked(insertPaymentSlip).mock.calls[0][0]).toMatchObject({
      order_id: "order-1", uploaded_by: "user-1", note: "KBZ transfer",
    });
    expect(vi.mocked(updateOrderPaymentService).mock.calls[0][1]).toMatchObject({
      payment_verification_status: "pending", payment_rejected_reason: null,
    });
  });

  it("refuses a cash-on-delivery order", async () => {
    vi.mocked(selectOrderById).mockResolvedValue(order({ payment_method: "cash_on_delivery" }));

    await expect(addPaymentSlip(user("normal"), "order-1", slipFile(), null)).rejects.toThrow(
      /cash on delivery/i
    );
    expect(uploadPaymentSlipObject).not.toHaveBeenCalled();
  });

  it("refuses a file that is not an image or PDF, and one that is too big", async () => {
    await expect(
      addPaymentSlip(user("normal"), "order-1", slipFile("text/plain"), null)
    ).rejects.toThrow(/JPG, PNG, WebP or PDF/);

    await expect(
      addPaymentSlip(user("normal"), "order-1", slipFile("image/png", 11 * 1024 * 1024), null)
    ).rejects.toThrow(/smaller than 10 MB/);
  });
});

describe("the admin checking a payment", () => {
  it("records the money as collected when verified", async () => {
    vi.mocked(selectOrderById).mockResolvedValue(
      order({ payment_slips: [{ id: "slip-1" }] as never })
    );

    await verifyOrderPayment(user(), "order-1", {
      decision: "verified",
      payment_reference: "KBZ-99",
    });

    expect(vi.mocked(updateOrderPaymentService).mock.calls[0][1]).toMatchObject({
      payment_verification_status: "verified",
      payment_status: "collected",
      payment_reference: "KBZ-99",
      payment_verified_by: "user-1",
    });
    expect(vi.mocked(insertAuditLog).mock.calls[0][0].action).toBe("order.payment.verify");
  });

  it("keeps the order unpaid and records the reason when rejected", async () => {
    vi.mocked(selectOrderById).mockResolvedValue(
      order({ payment_slips: [{ id: "slip-1" }] as never })
    );

    await verifyOrderPayment(user(), "order-1", {
      decision: "rejected",
      reason: "The slip shows a different amount.",
    });

    expect(vi.mocked(updateOrderPaymentService).mock.calls[0][1]).toMatchObject({
      payment_verification_status: "rejected",
      payment_status: "unpaid",
      payment_rejected_reason: "The slip shows a different amount.",
    });
  });

  it("will not verify before a slip has been uploaded", async () => {
    await expect(
      verifyOrderPayment(user(), "order-1", { decision: "verified" })
    ).rejects.toThrow(/upload the transfer slip/i);
  });

  it("is admin only", async () => {
    await expect(
      verifyOrderPayment(user("normal"), "order-1", { decision: "verified" })
    ).rejects.toThrow();
  });
});

describe("shipping a prepaid order", () => {
  it("is blocked until the payment is verified", async () => {
    await expect(patchOrderStatus(user(), "order-1", "confirmed")).rejects.toThrow(
      /mark the payment verified/i
    );
    expect(updateOrderStatus).not.toHaveBeenCalled();
  });

  it("goes ahead once the payment is verified", async () => {
    vi.mocked(selectOrderById).mockResolvedValue(
      order({ payment_verification_status: "verified", payment_status: "collected" })
    );

    await patchOrderStatus(user(), "order-1", "confirmed");

    expect(updateOrderStatus).toHaveBeenCalled();
  });
});

describe("checkout payment choices", () => {
  const base = {
    shipping_name: "Swan Yi", shipping_phone: "09420082522",
    shipping_address_line1: "No. 9, Shwe Taung Tan Street", shipping_city: "Yangon",
    shipping_state: "Yangon", shipping_postal_code: "11181", shipping_country: "Myanmar",
  };

  it("takes a bank transfer with the account the customer paid into", () => {
    expect(
      orderInputSchema.safeParse({ ...base, payment_method: "bank_transfer", payment_account: "aya" }).success
    ).toBe(true);
  });

  it("still requires both COD promises for cash on delivery", () => {
    expect(orderInputSchema.safeParse({ ...base, payment_method: "cash_on_delivery" }).success).toBe(false);
    expect(
      orderInputSchema.safeParse({
        ...base, payment_method: "cash_on_delivery",
        cod_confirmation: true, cod_contact_confirmation: true,
      }).success
    ).toBe(true);
  });

  it("does not let a prepaid order skip the account, or mix MMQR with a bank", () => {
    expect(orderInputSchema.safeParse({ ...base, payment_method: "mmqr" }).success).toBe(false);
    expect(
      orderInputSchema.safeParse({ ...base, payment_method: "mmqr", payment_account: "kbz" }).success
    ).toBe(false);
    expect(
      orderInputSchema.safeParse({ ...base, payment_method: "bank_transfer", payment_account: "mmqr" }).success
    ).toBe(false);
  });

  it("accepts the admin's verify action", () => {
    expect(
      orderMutationSchema.safeParse({ action: "verify_payment", decision: "verified" }).success
    ).toBe(true);
    expect(
      orderMutationSchema.safeParse({ action: "verify_payment", decision: "maybe" }).success
    ).toBe(false);
  });
});
