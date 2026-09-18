import { NextResponse, after, type NextRequest } from "next/server";
import {
  authenticate,
  createOrder,
  getOrders,
  notifyOrderPlaced,
} from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { readJsonBody } from "@/app/lib/request";
import { firstIssueMessage, orderInputSchema } from "@/app/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    const limit = request.nextUrl.searchParams.get("limit");
    const offset = request.nextUrl.searchParams.get("offset");

    return NextResponse.json({
      orders: await getOrders(user, {
        limit: limit ? Number(limit) : null,
        offset: offset ? Number(offset) : null,
      }),
    });
  } catch (error) {
    return handleRouteError("orders.list", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    const parsed = orderInputSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400 });
    }

    const order = await createOrder(user, parsed.data);

    // Runs after the response is sent: the customer is never kept waiting on
    // the mail server, and a mail failure cannot fail the checkout.
    after(() => notifyOrderPlaced(user, order.id));

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    return handleRouteError("orders.create", error);
  }
}
