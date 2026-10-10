import { NextResponse, type NextRequest } from "next/server";
import { listSiteFeedback } from "@/app/lib/admin-reports";
import { authenticate } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    return NextResponse.json(await listSiteFeedback(user), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return handleRouteError("admin.feedback", error);
  }
}
