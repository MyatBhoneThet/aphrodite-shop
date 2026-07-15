import { NextResponse, type NextRequest } from "next/server";
import { authenticate, getAdminStats } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    const stats = await getAdminStats(user);

    return NextResponse.json({ stats });
  } catch (error) {
    return handleRouteError("admin.stats", error);
  }
}
