import { NextResponse, after, type NextRequest } from "next/server";
import {
  adminCancelOrder,
  completeCancellationRefund,
  advanceOrderDeliveryProgress,
  advanceReturnWorkflow,
  authenticate,
  getOrder,
  notifyDeliveryAttemptFailed,
  notifyCancellationRefundSent,
  notifyOrderCancelled,
  notifyOrderDelivered,
  notifyOrderProgress,
  recordFailedDeliveryAttempt,
  patchOrderStatus,
  requestOrderAction,
  submitCancellationRefundDetails,
  resendOrderReceipt,
  resolveOrderRequest,
  verifyOrderPayment,
  updateOrderDelivery,
} from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import type { OrderProgressEmailStage } from "@/app/lib/receipt-email";
import { readJsonBody } from "@/app/lib/request";
import { firstIssueMessage, orderMutationSchema } from "@/app/lib/validation";

const EMAILED_PROGRESS_STAGES = new Set<OrderProgressEmailStage>([
  "verified",
  "packed",
  "handed_to_courier",
  "out_for_delivery",
  "delivered",
]);

function isEmailedProgressStage(stage: string | null | undefined): stage is OrderProgressEmailStage {
  return Boolean(stage && EMAILED_PROGRESS_STAGES.has(stage as OrderProgressEmailStage));
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request);
    const { id } = await context.params;
    const order = await getOrder(user, id);

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    return handleRouteError("orders.get", error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request);
    const { id } = await context.params;
    const parsed = orderMutationSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400 });
    }

    // Sent while the admin waits, so the order list can say whether it went out.
    if ("action" in parsed.data && parsed.data.action === "resend_receipt") {
      const resent = await resendOrderReceipt(user, id);
      if (!resent) {
        return NextResponse.json({ error: "Order not found." }, { status: 404 });
      }
      return NextResponse.json(resent);
    }

    // The admin's decision on a transfer slip: not a status change, so it also
    // sits outside the ladder below.
    if ("action" in parsed.data && parsed.data.action === "verify_payment") {
      const verified = await verifyOrderPayment(user, id, parsed.data);
      if (!verified) {
        return NextResponse.json({ error: "Order not found." }, { status: 404 });
      }
      return NextResponse.json({ order: verified });
    }

    if ("action" in parsed.data && parsed.data.action === "advance_delivery_progress") {
      const stage = parsed.data.stage;
      const order = await advanceOrderDeliveryProgress(user, id, stage);
      if (!order) {
        return NextResponse.json({ error: "Order not found." }, { status: 404 });
      }

      if (stage === "delivered") {
        after(() => notifyOrderDelivered(user, id));
      } else {
        after(() => notifyOrderProgress(user, id, stage));
      }
      return NextResponse.json({ order });
    }

    // A failed delivery attempt keeps the order shipped, so it never goes
    // through the status ladder below.
    if ("action" in parsed.data && parsed.data.action === "delivery_attempt_failed") {
      // Held in a local const: the narrowed type would be lost inside after().
      const attempt = parsed.data;
      const recorded = await recordFailedDeliveryAttempt(user, id, attempt);
      if (!recorded) {
        return NextResponse.json({ error: "Order not found." }, { status: 404 });
      }

      after(() =>
        notifyDeliveryAttemptFailed(user, id, attempt.reason, attempt.next_attempt_at ?? null)
      );

      return NextResponse.json(recorded);
    }

    const order =
      "status" in parsed.data
        ? await patchOrderStatus(user, id, parsed.data.status)
        : parsed.data.action === "resolve_request"
          ? await resolveOrderRequest(user, id, parsed.data)
          : parsed.data.action === "admin_cancel"
            ? await adminCancelOrder(user, id, parsed.data)
            : parsed.data.action === "submit_cancellation_refund_details"
              ? await submitCancellationRefundDetails(user, id, parsed.data)
              : parsed.data.action === "complete_cancellation_refund"
                ? await completeCancellationRefund(user, id, parsed.data)
            : parsed.data.action === "advance_return"
              ? await advanceReturnWorkflow(user, id, parsed.data)
              : parsed.data.action === "update_delivery"
                ? await updateOrderDelivery(user, id, parsed.data)
          : await requestOrderAction(user, id, parsed.data);

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    // The paid receipt goes out after the response, so marking an order
    // delivered never waits on, or fails because of, the mail server.
    if ("status" in parsed.data && parsed.data.status === "delivered") {
      after(() => notifyOrderDelivered(user, id));
    }

    // Admin cancellation (including "out of stock") is saved first, then the
    // customer is notified without making the admin wait on the mail server.
    if ("action" in parsed.data && parsed.data.action === "admin_cancel") {
      after(() => notifyOrderCancelled(user, id));
    }
    if (
      "action" in parsed.data &&
      parsed.data.action === "complete_cancellation_refund"
    ) {
      after(() => notifyCancellationRefundSent(user, id));
    }

    // Saving a customer-visible delivery milestone sends a bilingual update.
    // This runs after the response so the admin UI remains fast even if the
    // configured mail provider is slow or temporarily unavailable.
    if (
      "action" in parsed.data &&
      parsed.data.action === "update_delivery" &&
      isEmailedProgressStage(parsed.data.stage)
    ) {
      const stage = parsed.data.stage;
      after(() => notifyOrderProgress(user, id, stage));
    }

    return NextResponse.json({ order });
  } catch (error) {
    return handleRouteError("orders.update-status", error);
  }
}
