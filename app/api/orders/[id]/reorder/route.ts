import { NextResponse, type NextRequest } from "next/server";
import { authenticate, reorderToCart } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";

export const runtime = "nodejs";

/** "Buy again": adds a delivered order's items back to the signed-in customer's cart. */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request);
    const { id } = await context.params;
    return NextResponse.json(await reorderToCart(user, id));
  } catch (error) {
    return handleRouteError("orders.reorder", error);
  }
}
