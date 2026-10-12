import { NextResponse, type NextRequest } from "next/server";
import { checkHealth } from "@/app/lib/health";
import { isSupabaseConfigured, selectProductIdsForSitemap } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * `GET /api/health`          -- the server is up and configured (container check).
 * `GET /api/health?deep=1`   -- also reads one row from the database (uptime alert).
 *
 * 200 when healthy, 503 otherwise. No details beyond pass/fail are returned.
 */
export async function GET(request: NextRequest) {
  const report = await checkHealth({
    deep: request.nextUrl.searchParams.get("deep") === "1",
    configured: isSupabaseConfigured({ requireServiceRole: true }),
    // A one-row read of public product ids: exercises the real database path
    // without touching anything private.
    pingDatabase: () => selectProductIdsForSitemap(1),
  });

  return NextResponse.json(report, {
    status: report.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
