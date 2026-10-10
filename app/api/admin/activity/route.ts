import { NextResponse, type NextRequest } from "next/server";
import { listActivity } from "@/app/lib/admin-ops";
import { authenticate } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    const params = request.nextUrl.searchParams;
    return NextResponse.json(await listActivity(user, params.get("category"), params.get("offset")), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return handleRouteError("admin.activity", error);
  }
}
