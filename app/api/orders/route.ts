import { NextResponse, after, type NextRequest } from "next/server";
import {
  authenticate,
  createOrder,
  getOrders,
  notifyOrderPlaced,
  notifyOrderPlacedInApp,
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

    // The bell item and phone message go out before we answer, capped at a
    // couple of seconds, so a slow push service cannot hold the checkout up.
    // (After the response Cloud Run throttles the CPU, which is when the
    // notification used to stall.)
    await Promise.race([
      notifyOrderPlacedInApp(user, order.id),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);

    // The email runs after the response is sent: the customer is never kept
    // waiting on the mail server, and a mail failure cannot fail the checkout.
    after(() => notifyOrderPlaced(user, order.id));

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    return handleRouteError("orders.create", error);
  }
}
