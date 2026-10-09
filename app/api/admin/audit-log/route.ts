import { NextResponse, type NextRequest } from "next/server";
import { adminAuditLog, authenticate } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? 100);
    const limit = Number.isFinite(limitParam) ? limitParam : 100;

    return NextResponse.json({ entries: await adminAuditLog(user, limit) });
  } catch (error) {
    return handleRouteError("admin.audit-log", error);
  }
}
