import { createHash, timingSafeEqual } from "node:crypto";
import { serviceUnavailable } from "./errors";
import { fetchProductsSheet, hasGoogleSheetsConfig } from "./google-sheets";
import { withSheetStockLock } from "./sheet-stock-lock";
import {
  markRemovedProductsOutOfStock,
  previewStockCorrections,
  syncSheetWholesale,
  upsertProductionProducts,
  type StockCorrectionPlan,
} from "./supabase";

/**
 * Google Sheet -> website product sync. Used by the admin "Dry Run" and
 * "Sync Products" buttons, the automatic timer started in instrumentation.ts,
 * and /api/cron/sync-products (Cloud Scheduler on Cloud Run).
 */

type SheetSnapshot = Awaited<ReturnType<typeof fetchProductsSheet>>;

export const DEFAULT_AUTO_SYNC_MINUTES = 3;

/** Plain warnings for products that are missing from the sheet but were left alone. */
function heldBackWarnings(plan: StockCorrectionPlan | null) {
  if (!plan || plan.heldBack.length === 0) return [];

  const bySheet = new Map<string, number>();
  for (const item of plan.heldBack) {
    bySheet.set(item.sourceSheet, (bySheet.get(item.sourceSheet) ?? 0) + 1);
  }

  return [...bySheet].map(
    ([sheet, count]) =>
      `${count} products from the "${sheet}" tab are missing from the sheet but still in stock on the website. They were left unchanged because that many missing rows can mean the sheet did not load fully. Check the sheet, then sync again.`
  );
}

async function planSync(sheet: SheetSnapshot) {
  // Products the sync will bring back in line with the sheet. Computed for
  // the dry run too, so the admin can review before anything changes. A
  // failure here must never block the sync itself.
  let stockCorrections: StockCorrectionPlan | null = null;
  try {
    stockCorrections = await previewStockCorrections(sheet.products);
  } catch (previewError) {
    console.error("[product-sync] stock correction preview failed", {
      error: previewError instanceof Error ? previewError.message : String(previewError),
    });
  }

  return {
    stockCorrections,
    warnings: [...sheet.warnings, ...heldBackWarnings(stockCorrections)],
  };
}

/** Saves one sheet snapshot to the database. The caller holds the sheet stock lock. */
async function applySheetSnapshot(sheet: SheetSnapshot) {
  const { products, skippedRows, summary } = sheet;
  const { stockCorrections, warnings } = await planSync(sheet);

  let syncedProducts: Awaited<ReturnType<typeof upsertProductionProducts>>;
  let wholesale: Awaited<ReturnType<typeof syncSheetWholesale>> | null = null;
  try {
    syncedProducts = await upsertProductionProducts(products);
    const managed = products.filter((product) => product.sheetWholesale !== undefined);
    if (managed.length) {
      wholesale = await syncSheetWholesale(
        managed.map((product) => ({
          source_key: product.sourceKey,
          unit_price: product.sheetWholesale?.unitPrice ?? null,
          min_quantity: product.sheetWholesale?.minQuantity ?? null,
        }))
      );
    }
  } catch (syncError) {
    if (
      syncError instanceof Error &&
      syncError.message.trim().toLowerCase() === "unauthorized"
    ) {
      throw serviceUnavailable(
        "Supabase rejected the sync credential. Save the correct SUPABASE_SERVICE_ROLE_KEY in .env.local, stop the development server, and run npm run dev again."
      );
    }

    throw syncError;
  }

  // Stock above the sheet was already capped inside the upsert; products
  // deleted from the sheet are handled here.
  if (stockCorrections) {
    await markRemovedProductsOutOfStock(stockCorrections.removedFromSheet);
  }

  return {
    ok: true as const,
    wholesale,
    count: syncedProducts.length,
    skippedRows,
    summary,
    warnings,
    stockCorrections,
    productIds: syncedProducts.map((product) => product.id),
  };
}

/** The admin buttons. A dry run reads only; a real sync waits its turn with stock writes. */
export async function runProductSync({ dryRun }: { dryRun: boolean }) {
  if (dryRun) {
    const sheet = await fetchProductsSheet();
    const { stockCorrections, warnings } = await planSync(sheet);
    return {
      dryRun: true as const,
      count: sheet.products.length,
      skippedRows: sheet.skippedRows,
      summary: sheet.summary,
      warnings,
      stockCorrections,
      preview: sheet.products.slice(0, 25),
    };
  }

  return withSheetStockLock(async () => {
    const sheet = await fetchProductsSheet();
    const report = await applySheetSnapshot(sheet);
    // The automatic sync can skip this sheet: it is saved now.
    rememberSavedSheet(sheet, report.count);
    return report;
  });
}

// ---------------------------------------------------------------------------
// Automatic sync
// ---------------------------------------------------------------------------

export type AutoSyncStatus = {
  /** Minutes between checks by this server's timer; null when the timer is off. */
  intervalMinutes: number | null;
  /**
   * True when CRON_SECRET is configured, i.e. a scheduler (Cloud Scheduler on
   * Cloud Run) runs the sync. The last-check fields below only cover checks
   * this server instance handled, so they can be empty while syncs still run.
   */
  scheduled: boolean;
  running: boolean;
  lastCheckAt: string | null;
  lastResult: "synced" | "unchanged" | "failed" | null;
  /** Last time sheet changes were saved, by the automatic or the manual sync. */
  lastSyncAt: string | null;
  lastSyncCount: number | null;
  lastError: string | null;
};

type AutoSyncState = Omit<AutoSyncStatus, "scheduled"> & {
  fingerprint: string | null;
  timer: ReturnType<typeof setInterval> | null;
};

// On globalThis for the same reason as the stock lock: instrumentation and
// route handlers may load separate copies of this module.
const STATE_KEY = "__aphroditeProductAutoSync";

function autoSyncState(): AutoSyncState {
  const store = globalThis as typeof globalThis & { [STATE_KEY]?: AutoSyncState };
  store[STATE_KEY] ??= {
    intervalMinutes: null,
    running: false,
    lastCheckAt: null,
    lastResult: null,
    lastSyncAt: null,
    lastSyncCount: null,
    lastError: null,
    fingerprint: null,
    timer: null,
  };
  return store[STATE_KEY];
}

export function autoSyncStatus(env: NodeJS.ProcessEnv = process.env): AutoSyncStatus {
  const { intervalMinutes, running, lastCheckAt, lastResult, lastSyncAt, lastSyncCount, lastError } =
    autoSyncState();
  return {
    intervalMinutes,
    scheduled: hasUsableCronSecret(env.CRON_SECRET),
    running,
    lastCheckAt,
    lastResult,
    lastSyncAt,
    lastSyncCount,
    lastError,
  };
}

/** Identifies a sheet's content, so an unchanged sheet costs no database writes. */
export function sheetFingerprint(sheet: Pick<SheetSnapshot, "products">) {
  return createHash("sha256").update(JSON.stringify(sheet.products)).digest("hex");
}

function rememberSavedSheet(sheet: SheetSnapshot, count: number) {
  const state = autoSyncState();
  state.fingerprint = sheetFingerprint(sheet);
  state.lastSyncAt = new Date().toISOString();
  state.lastSyncCount = count;
}

/**
 * One automatic check: reads the sheet and saves it only if it changed since
 * the last successful sync. A failed save is retried on the next check. Never
 * throws; the outcome is in the returned status.
 */
export async function runAutomaticProductSync(): Promise<AutoSyncStatus> {
  const state = autoSyncState();
  if (state.running) return autoSyncStatus();
  state.running = true;

  try {
    await withSheetStockLock(async () => {
      const sheet = await fetchProductsSheet();

      if (sheetFingerprint(sheet) === state.fingerprint) {
        state.lastResult = "unchanged";
        return;
      }

      const report = await applySheetSnapshot(sheet);
      rememberSavedSheet(sheet, report.count);
      state.lastResult = "synced";
      console.log(`[product-sync] automatic sync saved sheet changes (${report.count} products)`);
    });
    state.lastError = null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Every few minutes: log a repeated failure once, not on every check.
    if (message !== state.lastError) {
      console.error(`[product-sync] automatic sync failed: ${message}`);
    }
    state.lastResult = "failed";
    state.lastError = message;
  } finally {
    state.running = false;
    state.lastCheckAt = new Date().toISOString();
  }

  return autoSyncStatus();
}

/**
 * Minutes between automatic checks, or null for off.
 *
 * SHEET_AUTO_SYNC_MINUTES overrides the 3-minute default; 0 turns it off. On
 * Cloud Run (K_SERVICE is set) the timer is off unless that variable is set:
 * Cloud Run pauses the CPU between requests, so a timer there cannot be
 * trusted -- Cloud Scheduler calls /api/cron/sync-products instead.
 */
export function autoSyncIntervalMinutes(env: NodeJS.ProcessEnv = process.env): number | null {
  const raw = env.SHEET_AUTO_SYNC_MINUTES?.trim().toLowerCase();

  if (raw === "0" || raw === "off" || raw === "false") return null;
  if (raw) {
    const minutes = Number(raw);
    return Number.isFinite(minutes) && minutes >= 1
      ? Math.min(minutes, 24 * 60)
      : DEFAULT_AUTO_SYNC_MINUTES;
  }

  return env.K_SERVICE ? null : DEFAULT_AUTO_SYNC_MINUTES;
}

/** Starts this server's timer once. Returns whether a timer is running. */
export function startAutomaticProductSync(env: NodeJS.ProcessEnv = process.env) {
  const state = autoSyncState();
  if (state.timer) return true;

  const minutes = hasGoogleSheetsConfig() ? autoSyncIntervalMinutes(env) : null;
  state.intervalMinutes = minutes;
  if (minutes === null) return false;

  const check = () => {
    void runAutomaticProductSync();
  };
  state.timer = setInterval(check, minutes * 60_000);
  state.timer.unref?.();
  // First check shortly after start-up rather than during it.
  setTimeout(check, 30_000).unref?.();

  console.log(`[product-sync] automatic Google Sheet sync every ${minutes} min`);
  return true;
}

/** A short or missing secret is treated as not configured. */
function hasUsableCronSecret(secret: string | undefined): secret is string {
  return typeof secret === "string" && secret.length >= 16;
}

/** Checks the "Authorization: Bearer <CRON_SECRET>" header of a scheduler call. */
export function isAuthorizedCronRequest(authorization: string | null, secret: string | undefined) {
  if (!hasUsableCronSecret(secret) || !authorization) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(authorization);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
