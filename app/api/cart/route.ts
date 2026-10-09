import { NextResponse, type NextRequest } from "next/server";
import {
  addCartItem,
  authenticate,
  clearUserCart,
  getCart,
} from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { readJsonBody } from "@/app/lib/request";
import { cartItemInputSchema, firstIssueMessage } from "@/app/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    return NextResponse.json(await getCart(user));
  } catch (error) {
    return handleRouteError("cart.list", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    const parsed = cartItemInputSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400 });
    }

    const productId = parsed.data.product_id ?? parsed.data.productId;

    if (!productId) {
      return NextResponse.json({ error: "product_id is required." }, { status: 400 });
    }

    return NextResponse.json(await addCartItem(user, productId, parsed.data.quantity));
  } catch (error) {
    return handleRouteError("cart.add", error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await authenticate(request);
    return NextResponse.json(await clearUserCart(user));
  } catch (error) {
    return handleRouteError("cart.clear", error);
  }
}
