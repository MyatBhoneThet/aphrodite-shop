import { describe, expect, it } from "vitest";
import {
  assertTypedConfirmation,
  matchesConfirmText,
  requireTypedConfirmation,
  typedConfirmation,
} from "../app/lib/typed-confirmation";
import {
  adminOrderCancellationSchema,
  adminReturnWorkflowSchema,
  completeCancellationRefundSchema,
} from "../app/lib/validation";

function deleteRequest(body?: unknown) {
  return new Request("https://shop.test/api/products/5", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("the typed word is checked on the server", () => {
  it("matches the word in any case with stray spaces, and nothing else", () => {
    expect(matchesConfirmText(" delete ", "DELETE")).toBe(true);
    expect(matchesConfirmText("DELET", "DELETE")).toBe(false);
  });

  it("a bare DELETE request with no body is refused", async () => {
    await expect(requireTypedConfirmation(deleteRequest(), "DELETE")).rejects.toMatchObject({ status: 400 });
  });

  it("a wrong word is refused, the right word passes", async () => {
    await expect(requireTypedConfirmation(deleteRequest({ confirm: "REMOVE" }), "DELETE")).rejects.toMatchObject({ status: 400 });
    await expect(requireTypedConfirmation(deleteRequest({ confirm: "delete" }), "DELETE")).resolves.toBeUndefined();
  });

  it("assertTypedConfirmation refuses anything that is not a string", () => {
    expect(() => assertTypedConfirmation(undefined, "CHANGE")).toThrow(/CHANGE/);
    expect(() => assertTypedConfirmation(42, "CHANGE")).toThrow(/CHANGE/);
    expect(() => assertTypedConfirmation("CHANGE", "CHANGE")).not.toThrow();
  });

  it("the zod field names the word that is missing", () => {
    const result = typedConfirmation("CANCEL").safeParse("nope");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe("Type CANCEL to confirm.");
  });
});

describe("cancelling and refunding an order need the word in the request", () => {
  const cancel = { action: "admin_cancel", reason_code: "out_of_stock", reason: "Item is unavailable after verification." };

  it("admin_cancel needs CANCEL", () => {
    expect(adminOrderCancellationSchema.safeParse(cancel).success).toBe(false);
    expect(adminOrderCancellationSchema.safeParse({ ...cancel, confirm: "REFUND" }).success).toBe(false);
    expect(adminOrderCancellationSchema.safeParse({ ...cancel, confirm: "cancel" }).success).toBe(true);
  });

  it("sending a cancellation refund needs REFUND", () => {
    const refund = {
      action: "complete_cancellation_refund",
      refund_method: "bank_transfer",
      refund_reference: "TXN-12345",
      refund_amount: 50000,
    };
    expect(completeCancellationRefundSchema.safeParse(refund).success).toBe(false);
    expect(completeCancellationRefundSchema.safeParse({ ...refund, confirm: "REFUND" }).success).toBe(true);
  });

  it("completing a return refund needs REFUND, other return steps do not", () => {
    const refund = { action: "advance_return", stage: "complete_refund", refund_method: "cash", refund_amount: 1000 };
    expect(adminReturnWorkflowSchema.safeParse(refund).success).toBe(false);
    expect(adminReturnWorkflowSchema.safeParse({ ...refund, confirm: "REFUND" }).success).toBe(true);
    expect(
      adminReturnWorkflowSchema.safeParse({ action: "advance_return", stage: "mark_received", restock_approved: false }).success
    ).toBe(true);
  });
});
