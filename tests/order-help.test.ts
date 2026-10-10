import { describe, expect, it } from "vitest";
import {
  canCancelInstantly, canRequestCancellation, evidenceFileProblem, helpChoices, returnWindow, returnWindowText,
} from "../app/lib/order-help";

const NOW = new Date("2026-10-12T12:00:00Z");
const delivered = (hoursAgo: number) => ({ status: "delivered", delivered_at: new Date(NOW.getTime() - hoursAgo * 3600_000).toISOString() });

describe("return window", () => {
  it("counts whole days left, rounding up", () => {
    expect(returnWindow(delivered(1), NOW)).toMatchObject({ open: true, daysLeft: 7 });
    expect(returnWindow(delivered(24 * 5 + 1), NOW)).toMatchObject({ open: true, daysLeft: 2 });
  });
  it("says 'less than a day' and counts hours in the last day", () => {
    const window = returnWindow(delivered(24 * 7 - 5), NOW);
    expect(window).toMatchObject({ open: true, daysLeft: 1, hoursLeft: 5 });
    expect(returnWindowText(window)).toMatch(/Less than a day left.*5 hours/);
  });
  it("closes after seven days and for undelivered orders", () => {
    expect(returnWindow(delivered(24 * 7 + 1), NOW).open).toBe(false);
    expect(returnWindowText(returnWindow(delivered(24 * 8), NOW))).toMatch(/has ended/);
    expect(returnWindow({ status: "shipped" }, NOW).open).toBe(false);
    expect(returnWindowText(returnWindow({ status: "shipped" }, NOW))).toBe("");
  });
});

describe("instant cancellation", () => {
  it("is allowed for a pending COD order nobody has checked", () => {
    expect(canCancelInstantly({ status: "pending", payment_method: "cash_on_delivery" })).toBe(true);
  });
  it("is not allowed once the order is confirmed or beyond", () => {
    for (const status of ["confirmed", "shipped", "delivered", "cancelled"]) expect(canCancelInstantly({ status })).toBe(false);
  });
  it("is not allowed while a request is pending or after one was approved", () => {
    expect(canCancelInstantly({ status: "pending", cancellation_request_status: "requested" })).toBe(false);
    expect(canCancelInstantly({ status: "pending", cancellation_request_status: "approved" })).toBe(false);
    expect(canCancelInstantly({ status: "pending", cancellation_request_status: "rejected" })).toBe(true);
  });
  it("is not allowed for a bank transfer with a slip, or a verified payment (money may have moved)", () => {
    expect(canCancelInstantly({ status: "pending", payment_method: "bank_transfer", payment_slips: [{}] })).toBe(false);
    expect(canCancelInstantly({ status: "pending", payment_method: "bank_transfer", payment_verification_status: "verified" })).toBe(false);
    expect(canCancelInstantly({ status: "pending", payment_method: "bank_transfer", payment_slips: [] })).toBe(true);
  });
  it("a request is still possible for a confirmed order", () => {
    expect(canRequestCancellation({ status: "confirmed" })).toBe(true);
    expect(canRequestCancellation({ status: "shipped" })).toBe(false);
    expect(canRequestCancellation({ status: "confirmed", cancellation_request_status: "requested" })).toBe(false);
  });
});

describe("help choices", () => {
  const byId = (order: Parameters<typeof helpChoices>[0]) => Object.fromEntries(helpChoices(order, NOW).map((choice) => [choice.id, choice]));

  it("a new order: can cancel at once, cannot return or claim warranty", () => {
    const choices = byId({ status: "pending", payment_method: "cash_on_delivery" });
    expect(choices.cancel.enabled).toBe(true);
    expect(choices.cancel.detail).toMatch(/straight away/);
    expect(choices.return.enabled).toBe(false);
    expect(choices.warranty.enabled).toBe(false);
    expect(choices.not_arrived.enabled).toBe(true);
  });
  it("a checked order: cancelling is a request", () => {
    expect(byId({ status: "confirmed" }).cancel.detail).toMatch(/cancellation request/);
  });
  it("a delivered order inside the window can be returned and shows the days left", () => {
    const choices = byId(delivered(24));
    expect(choices.return.enabled).toBe(true);
    expect(choices.return.detail).toMatch(/days left/);
    expect(choices.cancel.enabled).toBe(false);
    expect(choices.warranty.enabled).toBe(true);
  });
  it("after the window the return is explained, and warranty remains", () => {
    const choices = byId(delivered(24 * 9));
    expect(choices.return.enabled).toBe(false);
    expect(choices.return.unavailable).toMatch(/Warranty help/);
    expect(choices.warranty.enabled).toBe(true);
  });
  it("a cancelled order still allows payment questions (refunds)", () => {
    const choices = byId({ status: "cancelled" });
    expect(choices.payment.enabled).toBe(true);
    expect(choices.not_arrived.enabled).toBe(false);
  });
});

describe("evidence files", () => {
  const mb = (n: number) => n * 1024 * 1024;
  it("accepts photos up to 10 MB and videos up to 25 MB", () => {
    expect(evidenceFileProblem({ name: "a.jpg", type: "image/jpeg", size: mb(9) })).toBeNull();
    expect(evidenceFileProblem({ name: "a.mp4", type: "video/mp4", size: mb(24) })).toBeNull();
  });
  it("explains a too-big video and offers the link alternative", () => {
    expect(evidenceFileProblem({ name: "box.mp4", type: "video/mp4", size: mb(60) })).toMatch(/60 MB.*25 MB.*link/);
  });
  it("explains a too-big photo and wrong types", () => {
    expect(evidenceFileProblem({ name: "p.png", type: "image/png", size: mb(11) })).toMatch(/up to 10 MB/);
    expect(evidenceFileProblem({ name: "x.pdf", type: "application/pdf", size: 10 })).toMatch(/not a photo/);
    expect(evidenceFileProblem({ name: "e.jpg", type: "image/jpeg", size: 0 })).toMatch(/empty/);
  });
});
