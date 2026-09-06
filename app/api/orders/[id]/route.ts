import { NextResponse, type NextRequest } from "next/server";
import {
  adminCancelOrder,
  advanceReturnWorkflow,
  authenticate,
  getOrder,
  patchOrderStatus,
  requestOrderAction,
  resolveOrderRequest,
  updateOrderDelivery,
} from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { readJsonBody } from "@/app/lib/request";
import { firstIssueMessage, orderMutationSchema } from "@/app/lib/validation";

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

    const order =
      "status" in parsed.data
        ? await patchOrderStatus(user, id, parsed.data.status)
        : parsed.data.action === "resolve_request"
          ? await resolveOrderRequest(user, id, parsed.data)
          : parsed.data.action === "admin_cancel"
            ? await adminCancelOrder(user, id, parsed.data)
            : parsed.data.action === "advance_return"
              ? await advanceReturnWorkflow(user, id, parsed.data)
              : parsed.data.action === "update_delivery"
                ? await updateOrderDelivery(user, id, parsed.data)
          : await requestOrderAction(user, id, parsed.data);

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    return handleRouteError("orders.update-status", error);
  }
}
