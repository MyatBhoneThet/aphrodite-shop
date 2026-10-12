import { NextResponse, type NextRequest } from "next/server";
import { authenticate, getAttentionSummary } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";

export const dynamic = "force-dynamic";

/** The dashboard's "needs attention today" counts. Back-office accounts only. */
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    return NextResponse.json(
      { attention: await getAttentionSummary(user) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return handleRouteError("admin.attention", error);
  }
}
