import { NextResponse, type NextRequest } from "next/server";
import {
  addCartItem,
  authenticate,
  clearUserCart,
  getCart,
} from "@/app/lib/backend";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    return NextResponse.json(await getCart(user));
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
      quantity?: number;
    };

    return NextResponse.json(
      await addCartItem(user, Number(body.product_id ?? body.productId), body.quantity)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to add item.";

    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await authenticate(request);
    return NextResponse.json(await clearUserCart(user));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
