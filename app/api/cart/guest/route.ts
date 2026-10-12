import { NextResponse, type NextRequest } from "next/server";
import { getGuestCart } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { checkRateLimit } from "@/app/lib/rate-limit";
import { readJsonBody } from "@/app/lib/request";
import { firstIssueMessage, guestCartInputSchema } from "@/app/lib/validation";

/**
 * Prices a visitor's browser cart so they can see totals before logging in.
 * Public and read-only: nothing is stored, and only retail prices are used.
 */
export async function POST(request: NextRequest) {
  try {
    if (!checkRateLimit(request, "cart-guest").allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 }
      );
    }

    const parsed = guestCartInputSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400 });
    }

    return NextResponse.json(
      await getGuestCart(
        parsed.data.items.map((item) => ({
          productId: item.product_id,
          quantity: item.quantity,
        }))
      )
    );
  } catch (error) {
    return handleRouteError("cart.guest", error);
  }
}
