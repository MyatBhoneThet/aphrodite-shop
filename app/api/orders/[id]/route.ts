import { NextResponse, type NextRequest } from "next/server";
import { authenticate, getOrder, patchOrderStatus } from "@/app/lib/backend";
import type { OrderRow } from "@/app/lib/supabase";

const orderStatuses = new Set<OrderRow["status"]>([
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
]);

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
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request);
    const { id } = await context.params;
    const body = (await request.json()) as { status?: OrderRow["status"] };

    if (!body.status || !orderStatuses.has(body.status)) {
      return NextResponse.json({ error: "Invalid order status." }, { status: 400 });
    }

    const order = await patchOrderStatus(user, id, body.status);

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update order.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
