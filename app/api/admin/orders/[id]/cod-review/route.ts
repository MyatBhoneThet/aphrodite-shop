import { NextResponse, type NextRequest } from "next/server";
import { authenticate } from "@/app/lib/backend";
import { requireAdmin, getCodReviewContext } from "@/app/lib/supabase";
import { handleRouteError } from "@/app/lib/errors";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await authenticate(request);
    requireAdmin(user);
    const { id } = await context.params;
    return NextResponse.json(await getCodReviewContext(user.id, id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return handleRouteError("admin.cod-review", error); }
}
