/**
 * The ONE thing the customer has to do next, derived from the order.
 *
 * Nothing here is stored. Like order-tracking.ts and refund-tracking.ts this is
 * a pure function, so the customer's orders page and the admin list can never
 * disagree about what the customer has been told to do — the admin sees the
 * same sentence the customer is looking at.
 *
 * Money outranks delivery on purpose: if a payment is short or unclear, that is
 * the only thing the customer can actually act on, so it is what we say.
 */

export const RETURN_WINDOW_DAYS = 7;

export const nextStepKeys = [
  "pay_now",
  "checking_payment",
  "pay_again",
  "pay_remaining",
  "fix_slip",
  "overpaid",
  "payment_confirmed",
  "preparing",
  "prepare_cash",
  "on_the_way",
  "delivered_window",
  "delivered_done",
  "cancelled",
  "returned",
] as const;

export type NextStepKey = (typeof nextStepKeys)[number];

/** How loud the message should be: an instruction, a wait, or a closed order. */
export type NextStepTone = "action" | "waiting" | "done" | "stopped";

/** English fallback for anything not reading the bilingual dictionary. */
export const nextStepLabels: Record<NextStepKey, string> = {
  pay_now: "Upload your advance-payment receipt",
  checking_payment: "We are checking your payment",
  pay_again: "Upload a correct payment receipt",
  pay_remaining: "Send the remaining amount",
  fix_slip: "Send a clearer payment receipt",
  overpaid: "You paid more than the order total",
  payment_confirmed: "Payment confirmed — preparing your order",
  preparing: "We are preparing your order",
  prepare_cash: "Prepare cash for the delivery",
  on_the_way: "Your order is on the way",
  delivered_window: "Delivered — you can still return an item",
  delivered_done: "Delivered and closed",
  cancelled: "This order was cancelled",
  returned: "This order was returned",
};

export type NextStepOrder = {
  status: string;
  total_amount: number;
  payment_method?: string | null;
  payment_status?: string | null;
  payment_verification_status?: string | null;
  payment_amount_received?: number | null;
  payment_slips?: { id: string }[];
  delivered_at?: string | null;
};

export type NextStep = {
  key: NextStepKey;
  tone: NextStepTone;
  /** The figure to put in front of the customer, or null when there isn't one. */
  amount: number | null;
  /** Order total minus what actually arrived, never below zero. */
  outstanding: number;
  /** What arrived above the total, never below zero. */
  overpaid: number;
  label: string;
};

const prepaidMethods = new Set(["bank_transfer", "mmqr"]);

export function orderNextStep(order: NextStepOrder, now = Date.now()): NextStep {
  const total = Math.max(0, Number(order.total_amount || 0));
  const received = Math.max(0, Number(order.payment_amount_received ?? 0));
  const outstanding = Math.max(0, total - received);
  const overpaid = Math.max(0, received - total);

  const prepaid = prepaidMethods.has(order.payment_method ?? "");
  const verification =
    order.payment_verification_status ?? (prepaid ? "pending" : "not_required");
  const hasSlip = (order.payment_slips ?? []).length > 0;

  const step = (key: NextStepKey, tone: NextStepTone, amount: number | null = null): NextStep => ({
    key,
    tone,
    amount,
    outstanding,
    overpaid,
    label: nextStepLabels[key],
  });

  if (order.status === "cancelled") return step("cancelled", "stopped");
  if (order.status === "returned") return step("returned", "stopped");

  // A payment that needs fixing comes before anything about delivery.
  if (prepaid && verification === "correction_requested") {
    if (overpaid > 0) return step("overpaid", "waiting", overpaid);
    // Only promise a precise "remaining" when we actually recorded what landed.
    if (received > 0 && outstanding > 0) return step("pay_remaining", "action", outstanding);
    return step("fix_slip", "action", null);
  }
  if (prepaid && verification === "rejected") return step("pay_again", "action", outstanding);
  if (prepaid && verification === "pending") {
    return hasSlip ? step("checking_payment", "waiting") : step("pay_now", "action", outstanding);
  }

  if (order.status === "delivered") {
    const windowOpen =
      !order.delivered_at ||
      now <= Date.parse(order.delivered_at) + RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    return windowOpen ? step("delivered_window", "done") : step("delivered_done", "done");
  }

  // Cash on delivery: the single number to have ready at the door.
  if (!prepaid && order.payment_status !== "collected") {
    return step("prepare_cash", "action", total);
  }

  if (order.status === "shipped") return step("on_the_way", "waiting");
  if (order.status === "confirmed") return step("preparing", "waiting");
  return step("payment_confirmed", "waiting");
}
