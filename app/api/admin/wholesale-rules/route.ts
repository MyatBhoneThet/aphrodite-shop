import { NextResponse, type NextRequest } from "next/server";
import { authenticate } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { readJsonBody } from "@/app/lib/request";
import { requireAdmin } from "@/app/lib/supabase";
import { getWholesaleRules, saveWholesaleRules } from "@/app/lib/wholesale-b2b";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  try {
    requireAdmin(await authenticate(request));
    return NextResponse.json({ rules: await getWholesaleRules() }, { headers });
  } catch (error) {
    return handleRouteError("admin.wholesale-rules.get", error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await authenticate(request);
    return NextResponse.json({ rules: await saveWholesaleRules(user, await readJsonBody(request)) }, { headers });
  } catch (error) {
    return handleRouteError("admin.wholesale-rules.save", error);
  }
}
