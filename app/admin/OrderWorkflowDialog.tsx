"use client";

import type { FormEvent } from "react";
import { formatCurrency } from "../lib/format";
import { useAdminText } from "../lib/useAdminText";
import { matchesConfirmText } from "./confirm";
import {
  MAX_DELIVERY_ATTEMPTS,
  deliveryAttemptReasons,
  paymentCorrectionReasons,
  workflowConfirmWord,
} from "./order-helpers";
import type {
  DeliveryAttemptReason,
  OrderWorkflowAction,
  OrderWorkflowDraft,
  PaymentCorrectionReason,
} from "./types";

export default function OrderWorkflowDialog({
  draft,
  isSubmitting,
  onChange,
  onCancel,
  onSubmit,
}: {
  draft: OrderWorkflowDraft;
  isSubmitting: boolean;
  onChange: (update: Partial<OrderWorkflowDraft>) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const a = useAdminText();
  // Cancelling and refunding move stock or money for good: type a word first.
  const confirmWord = workflowConfirmWord(draft.action);
  const unlocked = !confirmWord || matchesConfirmText(draft.confirmText, confirmWord);
  const titles: Record<OrderWorkflowAction, string> = {
    admin_cancel: "Cancel order",
    schedule_pickup: "Schedule return handover",
    mark_received: "Receive and inspect item",
    complete_refund: "Record completed refund",
    complete_cancellation_refund: "Send cancellation refund",
    delivery_attempt: "Delivery attempt failed",
    payment_review: "Check the transfer slip",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="workflow-title" className="my-auto w-full max-w-xl rounded-3xl bg-white p-4 sm:p-6 shadow-2xl">
        <h2 id="workflow-title" className="text-2xl font-black">{titles[draft.action]}</h2>
        <p className="mt-1 text-sm text-zinc-500">{a("Order #")}{draft.orderId.slice(0, 8)} · {formatCurrency(draft.totalAmount)}</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {draft.action === "admin_cancel" && <>
            <label className="block text-sm font-semibold">{a("Reason category")}<select value={draft.reasonCode} onChange={(event) => onChange({ reasonCode: event.target.value as OrderWorkflowDraft["reasonCode"] })} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 font-normal"><option value="out_of_stock">{a("Item out of stock")}</option><option value="pricing_error">{a("Pricing error")}</option><option value="customer_request">{a("Customer requested")}</option><option value="other">{a("Other")}</option></select></label>
            <label className="block text-sm font-semibold">{a("Reason shown in order")}<textarea value={draft.reason} onChange={(event) => onChange({ reason: event.target.value })} rows={3} maxLength={500} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" /></label>
            <p className="rounded-xl bg-red-50 p-3 text-xs leading-5 text-red-800">{a("Only pending or confirmed orders can be cancelled. Reserved product quantities are restored automatically.")}</p>
          </>}

          {draft.action === "schedule_pickup" && <>
            <label className="block text-sm font-semibold">{a("Pickup or drop-off date and time")}<input type="datetime-local" value={draft.scheduledFor} onChange={(event) => onChange({ scheduledFor: event.target.value })} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" /></label>
            <label className="block text-sm font-semibold">{a("Customer instructions")}<textarea value={draft.instructions} onChange={(event) => onChange({ instructions: event.target.value })} rows={3} maxLength={500} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" /></label>
            <label className="block text-sm font-semibold">{a("Courier / tracking number (optional)")}<input value={draft.trackingNumber} onChange={(event) => onChange({ trackingNumber: event.target.value })} maxLength={120} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" /></label>
          </>}

          {draft.action === "mark_received" && <>
            <label className="block text-sm font-semibold">{a("Inspection notes")}<textarea value={draft.inspectionNotes} onChange={(event) => onChange({ inspectionNotes: event.target.value })} rows={4} maxLength={500} placeholder={a("Model, serial, condition, accessories, fault test...")} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" /></label>
            <label className="block text-sm font-semibold">{a("Can this item be returned to sellable inventory?")}<select value={draft.restockApproved} onChange={(event) => onChange({ restockApproved: event.target.value as "yes" | "no" })} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 font-normal"><option value="no">{a("No — damaged, defective, or not sellable")}</option><option value="yes">{a("Yes — inspected and sellable")}</option></select></label>
            <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">{a("Inventory is restored only when “Yes” is selected. This avoids selling a faulty returned machine.")}</p>
          </>}

          {draft.action === "payment_review" && <>
            <label className="block text-sm font-semibold">{a("Decision")}<select value={draft.paymentDecision} onChange={(event) => onChange({ paymentDecision: event.target.value as OrderWorkflowDraft["paymentDecision"] })} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 font-normal"><option value="verified">{a("Payment received — verified")}</option><option value="correction_requested">{a("Ask the customer to correct it")}</option><option value="rejected">{a("Cannot confirm — rejected")}</option></select></label>

            {draft.paymentDecision === "correction_requested" && <>
              <label className="block text-sm font-semibold">{a("What needs correcting?")}<select value={draft.correctionReason} onChange={(event) => onChange({ correctionReason: event.target.value as PaymentCorrectionReason })} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 font-normal">{Object.entries(paymentCorrectionReasons).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="block text-sm font-semibold">{a("How much actually arrived?")}<input type="number" min={0} step={1} value={draft.amountReceived} onChange={(event) => onChange({ amountReceived: event.target.value })} placeholder={a("Leave empty if you could not read the slip")} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" /><span className="mt-1 block text-xs font-normal text-zinc-500">{a("The customer is shown this against the")} {formatCurrency(draft.totalAmount)}  {a("total, so they see the exact amount still to pay. Leave it empty if the slip is unreadable — an empty box is not the same as zero.")}</span></label>
            </>}

            <label className="block text-sm font-semibold">{a("Bank / transaction reference (optional)")}<input value={draft.paymentReference} onChange={(event) => onChange({ paymentReference: event.target.value })} maxLength={200} placeholder={a("Reference you matched against your bank statement")} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" /></label>
            <label className="block text-sm font-semibold">{draft.paymentDecision === "rejected" ? a("Why can it not be confirmed?") : draft.paymentDecision === "correction_requested" ? a("What should the customer do? (shown to them)") : a("Note (optional)")}<textarea value={draft.reason} onChange={(event) => onChange({ reason: event.target.value })} rows={2} maxLength={500} placeholder={draft.paymentDecision === "correction_requested" ? a("Example: We received 300,000 by KBZ on 16 Sept. Please send the rest to the same account and upload the new slip.") : ""} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" /></label>
            <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">{a("Check the slip against your own bank or MMQR record before verifying. Verifying marks the money as collected and lets the order move to confirmed and shipped. Asking for a correction keeps the order and the money already received, and shows the customer exactly what is still owed — use it for a short payment or an unclear slip. Reject only when the payment cannot be used at all.")}</p>
          </>}

          {draft.action === "delivery_attempt" && <>
            <label className="block text-sm font-semibold">{a("What happened?")}<select value={draft.deliveryReason} onChange={(event) => onChange({ deliveryReason: event.target.value as DeliveryAttemptReason })} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 font-normal">{Object.entries(deliveryAttemptReasons).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="block text-sm font-semibold">{a("Next attempt (optional)")}<input type="datetime-local" value={draft.nextAttemptAt} onChange={(event) => onChange({ nextAttemptAt: event.target.value })} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" /><span className="mt-1 block text-xs font-normal text-zinc-500">{a("Shown to the customer as the new estimated arrival. Clear it if you do not have a date yet.")}</span></label>
            <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">
               {a("This is attempt")} {draft.failedAttempts + 1}  {a("of")} {MAX_DELIVERY_ATTEMPTS}{a(". The order stays shipped and waits for the next attempt; nothing is cancelled and no stock is returned. The customer sees the update in English and Burmese, and gets an email if they have order emails switched on.")} {draft.failedAttempts + 1 >= MAX_DELIVERY_ATTEMPTS && a(" This is the last planned attempt — after this, consider cancelling the order so the stock goes back.")}
            </p>
          </>}

          {(draft.action === "complete_refund" || draft.action === "complete_cancellation_refund") && <>
            {draft.action === "complete_cancellation_refund" && <div className="rounded-xl bg-blue-50 p-3 text-sm text-blue-950"><p className="font-bold">{a("Customer refund destination")}</p><p className="mt-1">{draft.refundBankName} · {draft.refundAccountName}</p><p className="mt-1 break-all font-mono font-bold">{draft.refundAccountNumber}</p></div>}
            <label className="block text-sm font-semibold">{a("Refund method")}<select value={draft.refundMethod} onChange={(event) => onChange({ refundMethod: event.target.value as OrderWorkflowDraft["refundMethod"] })} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 font-normal"><option value="bank_transfer">{a("Bank transfer")}</option><option value="mobile_wallet">{a("Mobile wallet")}</option>{draft.action === "complete_refund" && <><option value="cash">{a("Cash")}</option><option value="store_credit">{a("Store credit")}</option></>}</select></label>
            <label className="block text-sm font-semibold">{a("Refund amount")}<input type="number" min={0} max={draft.totalAmount} step={1} value={draft.refundAmount} onChange={(event) => onChange({ refundAmount: event.target.value })} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" /></label>
            <label className="block text-sm font-semibold">{a("Payment reference (recommended)")}<input value={draft.refundReference} onChange={(event) => onChange({ refundReference: event.target.value })} maxLength={200} placeholder={a("Transfer ID, wallet reference, or cash voucher")} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" /></label>
            <p className="rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-900">{a("Complete the real cash, bank, or wallet payment first. This button records the completed refund; it does not move money by itself.")}</p>
          </>}

          <label className="block text-sm font-semibold">{a("Note for customer (optional)")}<textarea value={draft.adminNote} onChange={(event) => onChange({ adminNote: event.target.value })} rows={2} maxLength={500} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" /></label>
          {confirmWord && (
            <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4">
              <label htmlFor="workflow-confirm" className="block text-sm font-bold text-red-900">
                {draft.action === "admin_cancel"
                  ? a("This cancels the order and returns its stock. Type the word below to confirm.")
                  : a("This records that the money was really sent. Type the word below to confirm.")}
              </label>
              <p className="mt-2 inline-block rounded-lg bg-zinc-900 px-3 py-1 font-mono text-sm font-bold tracking-widest text-white">{confirmWord}</p>
              <input
                id="workflow-confirm"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                value={draft.confirmText}
                onChange={(event) => onChange({ confirmText: event.target.value })}
                className="mt-2 w-full rounded-xl border bg-white px-4 py-3 font-mono tracking-widest outline-none focus:border-red-500"
              />
            </div>
          )}
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end"><button type="button" onClick={onCancel} disabled={isSubmitting} className="rounded-full border px-5 py-3 text-sm font-bold disabled:opacity-50">{a("Go back")}</button><button type="submit" disabled={isSubmitting || !unlocked} className="rounded-full bg-red-600 px-6 py-3 text-sm font-bold text-white disabled:bg-zinc-400">{isSubmitting ? a("Saving...") : a("Confirm and save")}</button></div>
        </form>
      </section>
    </div>
  );
}
