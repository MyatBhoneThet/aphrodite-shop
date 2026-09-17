/**
 * Which lane a case belongs in, derived from its own state.
 *
 * Nothing here is stored. A stored lane would go stale the moment a payment
 * was verified or a refund was sent from somewhere else in the admin panel;
 * deriving it means the queue is always telling the truth. Same reasoning as
 * order-tracking.ts and refund-tracking.ts.
 */

export const queueLanes = [
  "awaiting_payment_check",
  "delivery_issue",
  "return_review",
  "inspection",
  "refund_due",
  "warranty_repair",
] as const;

export type QueueLane = (typeof queueLanes)[number];

export const queueLaneLabels: Record<QueueLane, string> = {
  awaiting_payment_check: "Awaiting payment check",
  delivery_issue: "Delivery issue",
  return_review: "Return review",
  inspection: "Inspection",
  refund_due: "Refund due",
  warranty_repair: "Warranty repair",
};

/** Shown as a placeholder until staff write their own next action. */
export const defaultNextAction: Record<QueueLane, string> = {
  awaiting_payment_check: "Match the slip against the bank statement",
  delivery_issue: "Call the customer and agree a new delivery time",
  return_review: "Review the evidence and decide",
  inspection: "Inspect the returned item and record the condition",
  refund_due: "Send the money and record the payment reference",
  warranty_repair: "Book the repair and tell the customer the timeline",
};

export type QueueSubject =
  | {
      type: "order";
      status: string;
      payment_method?: string | null;
      payment_verification_status?: string | null;
      hasFailedDelivery?: boolean;
    }
  | { type: "help_case"; topic: string; status: string }
  | { type: "return_request"; status: string };

/**
 * Returns the lane, or null when the case needs nothing from staff right now.
 * Null is the normal answer for most rows — the queue only shows open work.
 */
export function queueLane(subject: QueueSubject): QueueLane | null {
  if (subject.type === "order") {
    // A prepaid order sitting on an unchecked slip is money we have not
    // confirmed, so it outranks a delivery problem on the same order.
    if (
      subject.payment_method &&
      subject.payment_method !== "cash_on_delivery" &&
      subject.payment_verification_status === "pending"
    ) {
      return "awaiting_payment_check";
    }

    if (subject.hasFailedDelivery && subject.status === "shipped") {
      return "delivery_issue";
    }

    return null;
  }

  if (subject.type === "help_case") {
    // A resolved or closed case is not work.
    if (subject.status !== "open" && subject.status !== "waiting_customer") {
      return null;
    }

    switch (subject.topic) {
      case "payment":
        return "awaiting_payment_check";
      case "delivery":
        return "delivery_issue";
      case "warranty":
        return "warranty_repair";
      case "faulty_item":
      // A cancellation is a decision on the customer's request, which is the
      // same kind of work as reviewing a return.
      case "cancel_order":
        return "return_review";
      default:
        return null;
    }
  }

  switch (subject.status) {
    case "requested":
    case "more_info_needed":
    // Approved but not yet collected: still the returns desk's job.
    case "approved":
      return "return_review";
    case "collected":
      return "inspection";
    // Inspection is finished; what is outstanding is a refund decision or the
    // money itself, so both sit with whoever settles refunds.
    case "inspected":
    case "refund_approved":
      return "refund_due";
    default:
      return null;
  }
}

/** A case is overdue when it carries a deadline that has already passed. */
export function isOverdue(dueAt: string | null | undefined, now = Date.now()) {
  return Boolean(dueAt) && now > Date.parse(dueAt as string);
}
