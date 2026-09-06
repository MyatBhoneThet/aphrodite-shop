/** Review signals are operational checks, not proof of identity or a fraud score. */
export function codReviewError(input: {
  verification_status: string;
  callback_confirmed?: boolean;
  address_confirmed?: boolean;
  verification_note?: string | null;
  stage?: string | null;
  courier_name?: string | null;
  tracking_number?: string | null;
}) {
  if (input.verification_status === "deposit_verified") return "This cash-only workflow uses a phone callback, not deposit verification.";
  if (["phone_verified", "approved"].includes(input.verification_status)) {
    if (!input.callback_confirmed) return "Call the customer's order phone number and confirm the items and COD total first.";
    if (!input.verification_note || input.verification_note.trim().length < 10) return "Record a short callback note (at least 10 characters). Do not enter ID numbers or passwords.";
  }
  if (input.verification_status === "approved" && !input.address_confirmed) return "Confirm the township, address and courier service area before approving COD.";
  if (["packed", "handed_to_courier", "in_transit", "out_for_delivery", "delivered"].includes(input.stage ?? "") && input.verification_status !== "approved") return "Approve COD verification before recording fulfilment events.";
  if (input.stage === "verified" && !["phone_verified", "approved"].includes(input.verification_status)) return "Complete the callback before adding a verified event.";
  if (["handed_to_courier", "in_transit", "out_for_delivery", "delivered"].includes(input.stage ?? "") && (!input.courier_name?.trim() || !input.tracking_number?.trim())) return "Enter the courier and tracking/reference number first.";
  return null;
}

export function codReviewSignals(input: { total: number; delivered: number; open: number; cancelled: number; hasPin: boolean }) {
  const signals: string[] = [];
  if (!input.delivered) signals.push("No completed delivery history: confirm this order by phone.");
  if (input.open > 0) signals.push(`${input.open} other open order(s): check for accidental duplicates.`);
  if (input.cancelled > 0) signals.push(`${input.cancelled} previous cancellation(s): review the reasons; cancellation alone is not fraud.`);
  if (input.total >= 1_000_000) signals.push("High-value order (MMK 1,000,000+): confirm stock and the courier's COD collection limit.");
  if (!input.hasPin) signals.push("No shared map pin: verify the address by phone. A map pin is optional and is not identity proof.");
  return signals;
}
