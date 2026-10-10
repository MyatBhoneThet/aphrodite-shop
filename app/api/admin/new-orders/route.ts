import { NextResponse, type NextRequest } from "next/server";
import { getNewOrders } from "@/app/lib/admin-ops";
import { authenticate } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    return NextResponse.json(await getNewOrders(user, request.nextUrl.searchParams.get("since")), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return handleRouteError("admin.newOrders", error);
  }
}
