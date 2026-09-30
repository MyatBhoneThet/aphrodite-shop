import { NextResponse, type NextRequest } from "next/server";
import { authenticate, getPaymentSlipUrl } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";

/** Opens one slip through a short-lived signed URL (customer's own, or admin). */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; slipId: string }> }
) {
  try {
    const user = await authenticate(request);
    const { id, slipId } = await context.params;
    const url = await getPaymentSlipUrl(user, id, slipId);
    return NextResponse.redirect(url);
  } catch (error) {
    return handleRouteError("orders.payment-slip.open", error);
  }
}
