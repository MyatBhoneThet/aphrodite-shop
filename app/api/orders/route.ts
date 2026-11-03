import { NextResponse, after, type NextRequest } from "next/server";
import {
  addPaymentSlip,
  assertPaymentSlipFile,
  authenticate,
  createOrder,
  getOrders,
  notifyOrderPlaced,
  notifyOrderPlacedInApp,
} from "@/app/lib/backend";
import { badRequest, handleRouteError } from "@/app/lib/errors";
import { isPrepaidMethod } from "@/app/lib/payment-accounts";
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

    // Cash on delivery sends plain JSON. Bank transfer and MMQR send a form:
    // the order as JSON in `order`, and the transfer slip in `slip`.
    let body: unknown;
    let slip: File | null = null;
    if ((request.headers.get("content-type") ?? "").toLowerCase().startsWith("multipart/form-data")) {
      const form = await request.formData();
      try {
        body = JSON.parse(String(form.get("order") ?? ""));
      } catch {
        throw badRequest("The order could not be read. Please try again.");
      }
      const file = form.get("slip");
      if (file instanceof File && file.size > 0) slip = file;
    } else {
      body = await readJsonBody(request);
    }

    const parsed = orderInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400 });
    }

    // A prepaid order needs its slip BEFORE it exists: this is checked first,
    // so a missing or unusable file never leaves an unpaid order behind.
    const prepaid = isPrepaidMethod(parsed.data.payment_method);
    if (prepaid) assertPaymentSlipFile(slip);

    const order = await createOrder(user, parsed.data);

    // Saved straight away. If storage fails here the order stays, and the
    // customer can upload the slip again from My orders (shipping still waits
    // for a verified payment either way).
    let slipSaved = !prepaid;
    if (prepaid && slip) {
      try {
        await addPaymentSlip(user, order.id, slip, null);
        slipSaved = true;
      } catch (error) {
        console.error("[orders] slip upload at checkout failed", {
          order_id: order.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

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

    return NextResponse.json({ order, slipSaved }, { status: 201 });
  } catch (error) {
    return handleRouteError("orders.create", error);
  }
}
