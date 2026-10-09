import { NextResponse, type NextRequest } from "next/server";
import { authenticate } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { requireAdmin, listLocationShares } from "@/app/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    requireAdmin(user);
    return NextResponse.json({ locations: await listLocationShares() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return handleRouteError("admin.customer-locations", error); }
}
