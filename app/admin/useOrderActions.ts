"use client";

import { FormEvent, useState } from "react";
import { authHeaders } from "../lib/client-auth";
import { confirmAction } from "./confirm";
import { failedDeliveryAttempts } from "./order-helpers";
import { getErrorMessage } from "./product-form";
import type {
  AdminOrder,
  DeliveryProgressStage,
  OrderRequestDecision,
  OrderRequestType,
  OrderResolutionDraft,
  OrderWorkflowAction,
  OrderWorkflowDraft,
} from "./types";

type Options = {
  loadDashboardData: () => Promise<void>;
  setMessage: (message: string) => void;
  setError: (message: string) => void;
};

/**
 * Everything an admin can do to one order from the orders table: move it along
 * the delivery steps, resend the receipt, resolve a customer request, and the
 * cancel / refund / payment-check / return dialogs.
 */
export function useOrderActions({ loadDashboardData, setMessage, setError }: Options) {
  const [courierOrder, setCourierOrder] = useState<AdminOrder | null>(null);
  const [deliveryOrder, setDeliveryOrder] = useState<AdminOrder | null>(null);
  const [orderResolution, setOrderResolution] =
    useState<OrderResolutionDraft | null>(null);
  const [isResolvingOrder, setIsResolvingOrder] = useState(false);
  const [orderWorkflow, setOrderWorkflow] = useState<OrderWorkflowDraft | null>(null);
  const [isSavingWorkflow, setIsSavingWorkflow] = useState(false);
  const [resendingOrderId, setResendingOrderId] = useState<string | null>(null);

  async function handleOrderStatusChange(orderId: string, stage: DeliveryProgressStage) {
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "advance_delivery_progress", stage }),
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      await loadDashboardData();
      setMessage("Order status updated.");
    } catch (err) {
      // A failed request can still have saved the new status. Reload first so
      // the dropdown shows what the database really has -- otherwise it keeps
      // the old status and the admin clicks again. The reload clears the
      // error, so set it afterwards.
      await loadDashboardData();
      setError(err instanceof Error ? err.message : "Unable to update order.");
    }
  }

  async function handleResendReceipt(order: AdminOrder) {
    const recipient = order.profiles?.email ?? "the customer";
    const confirmed = await confirmAction({
      title: "Email the receipt?",
      subject: recipient,
      message: "The customer gets the full receipt for this order by email.",
      confirmLabel: "Send receipt",
      tone: "caution",
    });
    if (!confirmed) return;

    setMessage("");
    setError("");
    setResendingOrderId(order.id);

    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "resend_receipt" }),
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const data = (await response.json()) as {
        email?: { status: string; recipient: string | null; error: string | null };
      };
      await loadDashboardData();

      const status = data.email?.status;
      if (status === "sent") {
        setMessage(`Receipt email sent to ${data.email?.recipient ?? recipient}.`);
      } else if (status === "not_sent") {
        setError("Not sent: this customer turned off order emails in Settings.");
      } else if (status === "not_configured") {
        setError("Not sent: Gmail is not set up on the server, or this customer has no email address.");
      } else {
        setError(data.email?.error ?? "The receipt email could not be sent.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send the receipt email.");
    } finally {
      setResendingOrderId(null);
    }
  }

  function handleDeliveryUpdate(order: AdminOrder) {
    setError(""); setMessage(""); setDeliveryOrder(order);
  }

  function openOrderRequestResolution(
    orderId: string,
    requestType: OrderRequestType,
    decision: OrderRequestDecision
  ) {
    setMessage("");
    setError("");
    setOrderResolution({
      orderId,
      requestType,
      decision,
      adminNote: "",
    });
  }

  async function handleOrderRequestResolution(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!orderResolution) return;

    const { orderId, requestType, decision, adminNote } = orderResolution;
    setMessage("");
    setError("");
    setIsResolvingOrder(true);

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resolve_request",
          request_type: requestType,
          decision,
          admin_note: adminNote.trim() || null,
        }),
      });
      if (!response.ok) throw new Error(await getErrorMessage(response));

      setOrderResolution(null);
      await loadDashboardData();
      setMessage(
        `${requestType === "cancellation" ? "Cancellation" : "Return"} request ${decision === "approve" ? "approved" : "rejected"}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to resolve order request.");
    } finally {
      setIsResolvingOrder(false);
    }
  }

  function openOrderWorkflow(order: AdminOrder, action: OrderWorkflowAction) {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    tomorrow.setMinutes(tomorrow.getMinutes() - tomorrow.getTimezoneOffset());
    setMessage("");
    setError("");
    setOrderWorkflow({
      orderId: order.id,
      totalAmount: order.total_amount,
      action,
      reasonCode: "out_of_stock",
      reason: action === "admin_cancel" ? "Item is unavailable after stock verification." : "",
      scheduledFor: tomorrow.toISOString().slice(0, 16),
      instructions: "Please keep the machine, charger, accessories, and packaging together.",
      trackingNumber: "",
      inspectionNotes: "",
      restockApproved: "no",
      deliveryReason: "no_answer",
      nextAttemptAt: tomorrow.toISOString().slice(0, 16),
      failedAttempts: failedDeliveryAttempts(order),
      paymentDecision: "verified",
      paymentReference: order.payment_reference ?? "",
      amountReceived:
        typeof order.payment_amount_received === "number"
          ? String(order.payment_amount_received)
          : "",
      correctionReason: order.payment_correction_reason ?? "short_payment",
      refundMethod: "bank_transfer",
      refundReference: "",
      refundAmount: String(order.total_amount),
      refundBankName: order.cancellation_refund_bank_name ?? "",
      refundAccountName: order.cancellation_refund_account_name ?? "",
      refundAccountNumber: order.cancellation_refund_account_number ?? "",
      adminNote: "",
      confirmText: "",
    });
  }

  async function handleOrderWorkflow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orderWorkflow) return;

    let payload: Record<string, unknown>;
    if (orderWorkflow.action === "admin_cancel") {
      if (orderWorkflow.reason.trim().length < 3) {
        setError("Enter the reason for cancellation.");
        return;
      }
      payload = {
        action: "admin_cancel",
        reason_code: orderWorkflow.reasonCode,
        reason: orderWorkflow.reason.trim(),
        admin_note: orderWorkflow.adminNote.trim() || null,
        confirm: orderWorkflow.confirmText.trim(),
      };
    } else if (orderWorkflow.action === "schedule_pickup") {
      const scheduled = new Date(orderWorkflow.scheduledFor);
      if (!orderWorkflow.scheduledFor || Number.isNaN(scheduled.getTime())) {
        setError("Choose a valid pickup or drop-off date.");
        return;
      }
      payload = {
        action: "advance_return",
        stage: "schedule_pickup",
        scheduled_for: scheduled.toISOString(),
        instructions: orderWorkflow.instructions.trim() || null,
        tracking_number: orderWorkflow.trackingNumber.trim() || null,
        admin_note: orderWorkflow.adminNote.trim() || null,
      };
    } else if (orderWorkflow.action === "mark_received") {
      payload = {
        action: "advance_return",
        stage: "mark_received",
        inspection_notes: orderWorkflow.inspectionNotes.trim() || null,
        restock_approved: orderWorkflow.restockApproved === "yes",
        admin_note: orderWorkflow.adminNote.trim() || null,
      };
    } else if (orderWorkflow.action === "payment_review") {
      if (orderWorkflow.paymentDecision === "rejected" && orderWorkflow.reason.trim().length < 3) {
        setError("Tell the customer why the payment could not be confirmed.");
        return;
      }

      const correction = orderWorkflow.paymentDecision === "correction_requested";
      const typed = orderWorkflow.amountReceived.trim();
      // Empty stays null: "not counted" and "nothing arrived" read differently
      // to the customer, so they must not collapse into 0 here.
      const counted = correction && typed !== "" ? Number(typed) : null;
      const needsAmount =
        orderWorkflow.correctionReason === "short_payment" ||
        orderWorkflow.correctionReason === "overpaid";

      if (correction && orderWorkflow.reason.trim().length < 10) {
        setError("Explain the correction so the customer knows exactly what to send.");
        return;
      }
      if (correction && needsAmount && typed === "") {
        setError("Enter how much actually arrived so the customer sees the exact amount.");
        return;
      }
      if (counted !== null && (!Number.isInteger(counted) || counted < 0)) {
        setError("The amount received must be a whole number of kyat, or empty.");
        return;
      }
      if (counted !== null && counted === orderWorkflow.totalAmount) {
        setError(
          "That is the full order total — verify the payment instead of asking for a correction."
        );
        return;
      }

      payload = {
        action: "verify_payment",
        decision: orderWorkflow.paymentDecision,
        payment_reference: orderWorkflow.paymentReference.trim() || null,
        reason: orderWorkflow.reason.trim() || null,
        ...(correction
          ? { amount_received: counted, correction_reason: orderWorkflow.correctionReason }
          : {}),
      };
    } else if (orderWorkflow.action === "delivery_attempt") {
      const nextAttempt = orderWorkflow.nextAttemptAt
        ? new Date(orderWorkflow.nextAttemptAt)
        : null;
      if (nextAttempt && Number.isNaN(nextAttempt.getTime())) {
        setError("Choose a valid date for the next delivery attempt, or leave it empty.");
        return;
      }
      payload = {
        action: "delivery_attempt_failed",
        reason: orderWorkflow.deliveryReason,
        next_attempt_at: nextAttempt ? nextAttempt.toISOString() : null,
        admin_note: orderWorkflow.adminNote.trim() || null,
      };
    } else if (orderWorkflow.action === "complete_cancellation_refund") {
      const amount = Number(orderWorkflow.refundAmount);
      if (!Number.isInteger(amount) || amount <= 0 || amount > orderWorkflow.totalAmount) {
        setError("Refund amount must be a whole number between 1 and the order total.");
        return;
      }
      if (orderWorkflow.refundReference.trim().length < 3) {
        setError("Enter the real transfer reference before marking the refund sent.");
        return;
      }
      payload = {
        action: "complete_cancellation_refund",
        refund_method: orderWorkflow.refundMethod === "mobile_wallet" ? "mobile_wallet" : "bank_transfer",
        refund_reference: orderWorkflow.refundReference.trim(),
        refund_amount: amount,
        admin_note: orderWorkflow.adminNote.trim() || null,
        confirm: orderWorkflow.confirmText.trim(),
      };
    } else {
      const amount = Number(orderWorkflow.refundAmount);
      if (!Number.isInteger(amount) || amount < 0 || amount > orderWorkflow.totalAmount) {
        setError("Refund amount must be a whole number between 0 and the order total.");
        return;
      }
      payload = {
        action: "advance_return",
        stage: "complete_refund",
        refund_method: orderWorkflow.refundMethod,
        refund_reference: orderWorkflow.refundReference.trim() || null,
        refund_amount: amount,
        admin_note: orderWorkflow.adminNote.trim() || null,
        confirm: orderWorkflow.confirmText.trim(),
      };
    }

    setError("");
    setMessage("");
    setIsSavingWorkflow(true);
    try {
      const response = await fetch(`/api/orders/${orderWorkflow.orderId}`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await getErrorMessage(response));
      const completedAction = orderWorkflow.action;
      setOrderWorkflow(null);
      await loadDashboardData();
      setMessage(
        completedAction === "admin_cancel"
          ? "Order cancelled and reserved inventory restored. Prepaid orders now wait for customer refund details."
          : completedAction === "complete_cancellation_refund"
            ? "Refund marked sent and the customer was notified."
          : completedAction === "schedule_pickup"
            ? "Return pickup or drop-off scheduled."
            : completedAction === "mark_received"
              ? "Returned item inspected and received."
              : "Refund record completed."
      );
    } catch (workflowError) {
      setError(workflowError instanceof Error ? workflowError.message : "Unable to update the return workflow.");
    } finally {
      setIsSavingWorkflow(false);
    }
  }

  return {
    courierOrder,
    setCourierOrder,
    deliveryOrder,
    setDeliveryOrder,
    orderResolution,
    setOrderResolution,
    isResolvingOrder,
    orderWorkflow,
    setOrderWorkflow,
    isSavingWorkflow,
    resendingOrderId,
    handleOrderStatusChange,
    handleResendReceipt,
    handleDeliveryUpdate,
    openOrderRequestResolution,
    handleOrderRequestResolution,
    openOrderWorkflow,
    handleOrderWorkflow,
  };
}
