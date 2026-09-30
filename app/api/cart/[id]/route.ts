import { NextResponse, type NextRequest } from "next/server";
import {
  authenticate,
  changeCartItem,
  removeCartItem,
} from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { readJsonBody } from "@/app/lib/request";
import { cartQuantityUpdateSchema, firstIssueMessage } from "@/app/lib/validation";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request);
    const { id } = await context.params;
    const parsed = cartQuantityUpdateSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400 });
    }

    return NextResponse.json(await changeCartItem(user, id, parsed.data.quantity));
  } catch (error) {
    return handleRouteError("cart.update", error);
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
  } catch (error) {
    return handleRouteError("cart.remove", error);
  }
}
