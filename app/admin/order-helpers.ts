import { trackingSteps } from "../lib/order-tracking";
import type {
  AdminOrder,
  DeliveryAttemptReason,
  PaymentCorrectionReason,
} from "./types";

export const paymentMethodLabels: Record<string, string> = {
  cash_on_delivery: "Cash on delivery",
  bank_transfer: "Bank transfer",
  mmqr: "MMQR",
};
export const paymentCorrectionReasons: Record<PaymentCorrectionReason, string> = {
  short_payment: "Less money arrived than the order total",
  overpaid: "More money arrived than the order total",
  unclear_slip: "The slip is unreadable or incomplete",
  wrong_account: "Sent to the wrong account",
  other: "Something else to correct",
};
export const MAX_DELIVERY_ATTEMPTS = 3;
export const deliveryAttemptReasons: Record<DeliveryAttemptReason, string> = {
  no_answer: "No answer on the phone",
  phone_off: "Phone switched off or unreachable",
  address_problem: "Address could not be found",
  customer_rescheduled: "Customer asked to deliver later",
  nobody_home: "Nobody available to receive the order",
};

export function failedDeliveryAttempts(order: AdminOrder) {
  return (order.delivery_events ?? []).filter((event) => event.stage === "delivery_failed").length;
}

export function allowedDeliveryProgress(order: AdminOrder) {
  if (order.status === "cancelled" || order.status === "returned") return [order.status];
  return trackingSteps;
}

/**
 * Cancelling an order and recording a refund are the two places money or stock
 * moves for good, so the admin types a word first. The server checks the same
 * word (see validation.ts).
 */
export function workflowConfirmWord(action: string): string | null {
  if (action === "admin_cancel") return "CANCEL";
  if (action === "complete_refund" || action === "complete_cancellation_refund") return "REFUND";
  return null;
}
