import { NextResponse, type NextRequest } from "next/server";
import { authenticate } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { readJsonBody } from "@/app/lib/request";
import { requireAdmin } from "@/app/lib/supabase";
import { assertTypedConfirmation } from "@/app/lib/typed-confirmation";
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
    const body = await readJsonBody(request);
    // These terms apply to every wholesale order from the next one on.
    assertTypedConfirmation((body as { confirm?: unknown } | null)?.confirm, "CHANGE");
    return NextResponse.json({ rules: await saveWholesaleRules(user, body) }, { headers });
  } catch (error) {
    return handleRouteError("admin.wholesale-rules.save", error);
  }
}
