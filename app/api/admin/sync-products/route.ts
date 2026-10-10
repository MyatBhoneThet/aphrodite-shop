import { NextResponse, type NextRequest } from "next/server";
import { recordAdminAction } from "@/app/lib/admin-audit";
import { authenticate } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { autoSyncStatus, runProductSync } from "@/app/lib/product-sync";
import { requireBackoffice } from "@/app/lib/supabase";
import { readJsonBody } from "@/app/lib/request";

export const runtime = "nodejs";

/** Automatic sync status for the admin sync card. */
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    requireBackoffice(user);

    return NextResponse.json({ automatic: autoSyncStatus() });
  } catch (error) {
    return handleRouteError("admin.sync-products.status", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    requireBackoffice(user);

    const body = (await readJsonBody(request)) as {
      dryRun?: boolean;
    } | null;

    const result = await runProductSync({ dryRun: Boolean(body?.dryRun) });
    if (!body?.dryRun) {
      await recordAdminAction({ actorId: user.id, action: "product.sync", targetType: "product_sync", targetId: "google-sheet", next: { products: result.count } });
    }
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError("admin.sync-products", error);
  }
}
