import { NextResponse, type NextRequest } from "next/server";
import { authenticate } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { autoSyncStatus, runProductSync } from "@/app/lib/product-sync";
import { requireAdmin } from "@/app/lib/supabase";
import { readJsonBody } from "@/app/lib/request";

export const runtime = "nodejs";

/** Automatic sync status for the admin sync card. */
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    requireAdmin(user);

    return NextResponse.json({ automatic: autoSyncStatus() });
  } catch (error) {
    return handleRouteError("admin.sync-products.status", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    requireAdmin(user);

    const body = (await readJsonBody(request)) as {
      dryRun?: boolean;
    } | null;

    return NextResponse.json(await runProductSync({ dryRun: Boolean(body?.dryRun) }));
  } catch (error) {
    return handleRouteError("admin.sync-products", error);
  }
}
