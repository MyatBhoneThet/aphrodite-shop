import { NextResponse, type NextRequest } from "next/server";
import {
  addWishlistItem,
  authenticate,
  getWishlist,
} from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { firstIssueMessage, wishlistInputSchema } from "@/app/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    return NextResponse.json({ items: await getWishlist(user) });
  } catch (error) {
    return handleRouteError("wishlist.list", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    const parsed = wishlistInputSchema.safeParse(await request.json().catch(() => ({})));

    if (!parsed.success) {
      return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400 });
    }

    const productId = parsed.data.product_id ?? parsed.data.productId;

    if (!productId) {
      return NextResponse.json({ error: "product_id is required." }, { status: 400 });
    }

    return NextResponse.json({ items: await addWishlistItem(user, productId) });
  } catch (error) {
    return handleRouteError("wishlist.add", error);
  }
}
