/**
 * The five steps a customer actually asks about, derived from the stored
 * return status. Pure and shared, so the customer's page and the admin inbox
 * can never disagree about where a refund has got to.
 *
 * Mirrors order-tracking.ts: `stage` lets a translated view look the label up
 * itself, and `label` stays for anything not translated yet.
 */

export const refundSteps = [
  "request_received",
  "under_review",
  "item_received",
  "refund_approved",
  "money_sent",
] as const;

export type RefundStep = (typeof refundSteps)[number];

export const refundStepLabels: Record<RefundStep, string> = {
  request_received: "Request received",
  under_review: "Under review",
  item_received: "Item received",
  refund_approved: "Refund approved",
  money_sent: "Money sent",
};

export type TrackableRefund = {
  status: string;
  expected_refund_at?: string | null;
  delay_reason?: string | null;
  refund_sent_at?: string | null;
};

// Several stored statuses share one customer-facing step: a customer does not
// care whether staff call it "collected" or "inspected", only that we have it.
const stepByStatus: Record<string, number> = {
  requested: 0,
  more_info_needed: 0,
  approved: 1,
  collected: 2,
  inspected: 2,
  refund_approved: 3,
  completed: 4,
};

export function refundTracking(request: TrackableRefund, now = Date.now()) {
  if (request.status === "declined" || request.status === "cancelled") {
    return {
      label: request.status === "declined" ? "Declined" : "Cancelled",
      stage: null,
      step: -1,
      stopped: true,
      expectedAt: null,
      delayReason: request.delay_reason ?? null,
      isLate: false,
    };
  }

  const step = stepByStatus[request.status] ?? 0;
  const stage = refundSteps[step];
  const expectedAt = request.expected_refund_at ?? null;

  // Only late while the money is still with us. Once it is sent, a date that
  // has passed is simply history.
  const isLate =
    step < 4 &&
    !request.refund_sent_at &&
    Boolean(expectedAt) &&
    now > Date.parse(expectedAt as string);

  return {
    label: refundStepLabels[stage],
    stage,
    step,
    stopped: false,
    expectedAt,
    delayReason: request.delay_reason ?? null,
    isLate,
  };
}
