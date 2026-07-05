import { NextResponse, type NextRequest } from "next/server";
import {
  authenticate,
  changeCartItem,
  removeCartItem,
} from "@/app/lib/backend";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request);
    const { id } = await context.params;
    const body = (await request.json()) as { quantity?: number };

    return NextResponse.json(await changeCartItem(user, id, body.quantity));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update cart item.";

    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request);
    const { id } = await context.params;

    return NextResponse.json(await removeCartItem(user, id));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
