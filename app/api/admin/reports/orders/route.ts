import { NextResponse, type NextRequest } from "next/server";
import { buildExportCsv } from "@/app/lib/admin-reports";
import { authenticate } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    const params = request.nextUrl.searchParams;
    const kind = params.get("kind");
    const from = params.get("from");
    const to = params.get("to");
    const csv = await buildExportCsv(user, kind, from, to);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="aphrodite-${kind}-${from}-to-${to}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleRouteError("admin.reports.orders", error);
  }
}
