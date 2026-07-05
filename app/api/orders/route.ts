import { NextResponse, type NextRequest } from "next/server";
import {
  authenticate,
  createOrder,
  getOrders,
} from "@/app/lib/backend";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    return NextResponse.json({ orders: await getOrders(user) });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    const body = (await request.json()) as {
      shipping_name?: string;
      shipping_phone?: string;
      shipping_address?: string;
      notes?: string | null;
    };

    return NextResponse.json(
      { order: await createOrder(user, body) },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create order.";

    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 400 }
    );
  }
}
