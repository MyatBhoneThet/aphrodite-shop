import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { authenticate } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { requireAdmin, getLocationShare } from "@/app/lib/supabase";

export async function GET(request: NextRequest, context: { params: Promise<{ userId: string }> }) {
  try {
    const user = await authenticate(request);
    requireAdmin(user);
    const { userId } = await context.params;
    if (!z.string().uuid().safeParse(userId).success) return NextResponse.json({ error: "Invalid customer." }, { status: 400 });
    return NextResponse.json({ location: await getLocationShare(userId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return handleRouteError("admin.customer-location", error); }
}
