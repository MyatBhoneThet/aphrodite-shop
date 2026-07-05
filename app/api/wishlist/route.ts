import { NextResponse, type NextRequest } from "next/server";
import {
  addWishlistItem,
  authenticate,
  getWishlist,
} from "@/app/lib/backend";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    return NextResponse.json({ items: await getWishlist(user) });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    const body = (await request.json()) as {
      product_id?: number;
      productId?: number;
    };

    return NextResponse.json({
      items: await addWishlistItem(user, Number(body.product_id ?? body.productId)),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update wishlist.";

    return NextResponse.json(
      { error: message },
      {
        status:
          message === "Unauthorized" ? 401 : message === "Already wishlisted." ? 409 : 400,
      }
    );
  }
}
