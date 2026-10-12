"use client";

import type { FormEvent } from "react";
import { useAdminText } from "../lib/useAdminText";
import type { OrderResolutionDraft } from "./types";

export default function OrderResolutionDialog({
  draft,
  isSubmitting,
  onNoteChange,
  onCancel,
  onSubmit,
}: {
  draft: OrderResolutionDraft;
  isSubmitting: boolean;
  onNoteChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const a = useAdminText();
  const isApproval = draft.decision === "approve";
  const requestLabel =
    draft.requestType === "cancellation" ? "cancellation" : "return";

  const explanation = isApproval
    ? draft.requestType === "cancellation"
      ? "The order will be cancelled and every ordered item will be restored to inventory."
      : "The return will be approved so pickup or drop-off can be scheduled. Inventory and payment stay unchanged until staff receives, inspects, and refunds the item."
    : `The ${requestLabel} request will be rejected. The order status and inventory will not change.`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/55 p-4"
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-resolution-title"
        className="my-auto w-full max-w-lg rounded-2xl bg-white p-4 shadow-2xl sm:p-6"
      >
        <h2 id="order-resolution-title" className="text-xl font-bold">
          {isApproval ? a("Approve") : a("Reject")} {requestLabel}  {a("request")} </h2>

        <p className="mt-2 text-sm leading-6 text-zinc-600">{explanation}</p>

        <form onSubmit={onSubmit} className="mt-5">
          <label
            htmlFor="admin-order-note"
            className="mb-2 block text-sm font-semibold"
          >
             {a("Note for the customer (optional)")} </label>
          <textarea
            id="admin-order-note"
            value={draft.adminNote}
            onChange={(event) => onNoteChange(event.target.value)}
            disabled={isSubmitting}
            maxLength={500}
            rows={4}
            autoFocus
            className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-red-500 disabled:bg-zinc-100"
            placeholder={
              isApproval
                ? "Example: Your request was approved."
                : "Example: The order has already been shipped."
            }
          />
          <p className="mt-1 text-right text-xs text-zinc-400">
            {draft.adminNote.length}/500
          </p>

          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="rounded-full border px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
            >
               {a("Go back")} </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:bg-zinc-400 ${
                isApproval ? "bg-green-600" : "bg-red-600"
              }`}
            >
              {isSubmitting
                ? a("Saving...")
                : `${isApproval ? a("Confirm approval") : a("Confirm rejection")}`}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
