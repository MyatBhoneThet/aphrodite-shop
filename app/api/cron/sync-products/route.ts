import { NextResponse, after, type NextRequest } from "next/server";
import { runCartReminders } from "@/app/lib/cart-reminders";
import { handleRouteError } from "@/app/lib/errors";
import { isAuthorizedCronRequest, runAutomaticProductSync } from "@/app/lib/product-sync";

export const runtime = "nodejs";

/**
 * Automatic Google Sheet sync for hosting that pauses the server between
 * requests (Cloud Run). Cloud Scheduler calls this every 3 minutes with
 * "Authorization: Bearer <CRON_SECRET>". It saves to the database only when
 * the sheet changed since the last sync. The same call also sends the
 * (throttled) "you left items in your cart" reminders.
 */
export async function POST(request: NextRequest) {
  // Without the secret this route does not exist, so it cannot be probed.
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const status = await runAutomaticProductSync();
    // Rides on this scheduled call so there is no second job to set up. It is
    // throttled and never throws; after() keeps it off the sync's response time.
    after(() => runCartReminders());
    // A failure status lets Cloud Scheduler show the job as failed.
    return NextResponse.json(status, { status: status.lastResult === "failed" ? 500 : 200 });
  } catch (error) {
    return handleRouteError("cron.sync-products", error);
  }
}
