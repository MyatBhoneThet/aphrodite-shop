import { NextResponse, type NextRequest } from "next/server";
import {
  authenticate,
  removeWishlistItem,
} from "@/app/lib/backend";

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
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
