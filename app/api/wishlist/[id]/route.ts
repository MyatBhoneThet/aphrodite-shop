import { NextResponse, type NextRequest } from "next/server";
import {
  authenticate,
  removeWishlistItem,
} from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request);
    const { id } = await context.params;

    return NextResponse.json({
      items: await removeWishlistItem(user, id),
    });
  } catch (error) {
    return handleRouteError("wishlist.remove", error);
  }
}
