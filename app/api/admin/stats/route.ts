import { NextResponse, type NextRequest } from "next/server";
import { authenticate, getAdminStats, type SalesPeriod } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    const requested = request.nextUrl.searchParams.get("period");
    const period: SalesPeriod = requested === "week" || requested === "quarter" || requested === "year"
      ? requested
      : "month";
    const stats = await getAdminStats(user, period);

    return NextResponse.json({ stats });
  } catch (error) {
    return handleRouteError("admin.stats", error);
  }
}
