/**
 * Runs once when the Next.js server starts.
 *
 * Starts the automatic Google Sheet sync: every 3 minutes by default, and
 * SHEET_AUTO_SYNC_MINUTES=0 turns it off. On Cloud Run it stays off unless
 * that variable is set, because Cloud Scheduler calls /api/cron/sync-products
 * there instead (see app/lib/product-sync.ts).
 */
export async function register() {
  // The import must sit INSIDE this if-block, as in the Next.js docs. Next also
  // compiles this file for the edge runtime, where the check is replaced by a
  // constant; the bundler drops a dead if-block, but not code after an early
  // return, so the edge build would try to bundle Node's `crypto` and fail.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NEXT_PHASE === "phase-production-build") return;

    const { startAutomaticProductSync } = await import("./app/lib/product-sync");
    startAutomaticProductSync();
  }
}
