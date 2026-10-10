import { NextResponse, type NextRequest } from "next/server";
import { getLowStockProducts } from "@/app/lib/admin-reports";
import { authenticate } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    const result = await getLowStockProducts(user, request.nextUrl.searchParams.get("threshold"));
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return handleRouteError("admin.lowStock", error);
  }
}
