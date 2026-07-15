import { NextResponse, type NextRequest } from "next/server";
import { authenticate, getOrder, patchOrderStatus } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { firstIssueMessage, orderStatusSchema } from "@/app/lib/validation";

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
    const parsed = orderStatusSchema.safeParse(await request.json().catch(() => ({})));

    if (!parsed.success) {
      return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400 });
    }

    const order = await patchOrderStatus(user, id, parsed.data.status);

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    return handleRouteError("orders.update-status", error);
  }
}
