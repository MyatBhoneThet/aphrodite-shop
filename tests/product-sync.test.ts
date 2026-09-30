import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../app/lib/google-sheets", async (importOriginal) => {
  const original = await importOriginal<typeof import("../app/lib/google-sheets")>();
  return {
    ...original,
    fetchProductsSheet: vi.fn(),
    hasGoogleSheetsConfig: vi.fn(() => true),
  };
});

vi.mock("../app/lib/supabase", async (importOriginal) => {
  const original = await importOriginal<typeof import("../app/lib/supabase")>();
  return {
    ...original,
    previewStockCorrections: vi.fn(),
    upsertProductionProducts: vi.fn(),
    syncSheetWholesale: vi.fn(),
    markRemovedProductsOutOfStock: vi.fn(),
  };
});

import { fetchProductsSheet } from "../app/lib/google-sheets";
import {
  autoSyncIntervalMinutes,
  autoSyncStatus,
  isAuthorizedCronRequest,
  runAutomaticProductSync,
  runProductSync,
} from "../app/lib/product-sync";
import { withSheetStockLock } from "../app/lib/sheet-stock-lock";
import {
  markRemovedProductsOutOfStock,
  previewStockCorrections,
  upsertProductionProducts,
} from "../app/lib/supabase";

function sheet(quantity: number) {
  return {
    products: [{ sourceKey: "production:laptops:dell-3420", name: "Dell Latitude 3420", stockQuantity: quantity }],
    skippedRows: [],
    summary: { bySheet: [] },
    warnings: [],
    quantityColumns: { Laptops: 8, Accessories: 9, "PC Parts": 9 },
  } as never;
}

beforeEach(() => {
  // Fresh automatic-sync memory for every test.
  delete (globalThis as Record<string, unknown>).__aphroditeProductAutoSync;
  vi.mocked(fetchProductsSheet).mockReset().mockResolvedValue(sheet(2));
  vi.mocked(previewStockCorrections)
    .mockReset()
    .mockResolvedValue({ aboveSheet: [], removedFromSheet: [], heldBack: [] });
  vi.mocked(upsertProductionProducts).mockReset().mockResolvedValue([{ id: 14 }] as never);
  vi.mocked(markRemovedProductsOutOfStock).mockReset().mockResolvedValue(undefined as never);
});

describe("automatic sync", () => {
  it("saves the sheet on the first check, then skips the database while the sheet is unchanged", async () => {
    expect((await runAutomaticProductSync()).lastResult).toBe("synced");
    expect((await runAutomaticProductSync()).lastResult).toBe("unchanged");
    expect(upsertProductionProducts).toHaveBeenCalledTimes(1);
    expect(fetchProductsSheet).toHaveBeenCalledTimes(2);
  });

  it("saves again as soon as the sheet changes", async () => {
    await runAutomaticProductSync();
    vi.mocked(fetchProductsSheet).mockResolvedValue(sheet(1));

    const status = await runAutomaticProductSync();

    expect(status.lastResult).toBe("synced");
    expect(upsertProductionProducts).toHaveBeenCalledTimes(2);
  });

  it("reports a failure and retries the same sheet on the next check", async () => {
    vi.mocked(upsertProductionProducts).mockRejectedValueOnce(new Error("Supabase is down"));

    const failed = await runAutomaticProductSync();
    expect(failed).toMatchObject({ lastResult: "failed", lastError: "Supabase is down", running: false });

    const retried = await runAutomaticProductSync();
    expect(retried).toMatchObject({ lastResult: "synced", lastError: null });
    expect(upsertProductionProducts).toHaveBeenCalledTimes(2);
  });

  it("does not redo a sheet the admin just synced by hand", async () => {
    await runProductSync({ dryRun: false });

    expect((await runAutomaticProductSync()).lastResult).toBe("unchanged");
    expect(upsertProductionProducts).toHaveBeenCalledTimes(1);
  });

  it("waits for a stock write already in progress before reading the sheet", async () => {
    let finishCheckout!: () => void;
    const checkout = withSheetStockLock(
      () => new Promise<void>((resolve) => { finishCheckout = resolve; })
    );

    const sync = runAutomaticProductSync();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(fetchProductsSheet).not.toHaveBeenCalled();

    finishCheckout();
    await checkout;
    expect((await sync).lastResult).toBe("synced");
  });
});

describe("dry run", () => {
  it("never writes to the database", async () => {
    const report = await runProductSync({ dryRun: true });

    expect(report).toMatchObject({ dryRun: true, count: 1 });
    expect(upsertProductionProducts).not.toHaveBeenCalled();
    expect(markRemovedProductsOutOfStock).not.toHaveBeenCalled();
  });
});

describe("sheet stock lock", () => {
  it("runs tasks one at a time, and a failed task does not block the next", async () => {
    const events: string[] = [];
    const first = withSheetStockLock(async () => {
      events.push("first:start");
      await new Promise((resolve) => setTimeout(resolve, 5));
      events.push("first:end");
      throw new Error("sheet unreachable");
    });
    const second = withSheetStockLock(async () => {
      events.push("second");
      return "ok";
    });

    await expect(first).rejects.toThrow("sheet unreachable");
    await expect(second).resolves.toBe("ok");
    expect(events).toEqual(["first:start", "first:end", "second"]);
  });
});

describe("how often it runs", () => {
  const env = (values: Record<string, string>) => values as unknown as NodeJS.ProcessEnv;

  it("checks every 3 minutes by default", () => {
    expect(autoSyncIntervalMinutes(env({}))).toBe(3);
  });

  it("can be changed or turned off", () => {
    expect(autoSyncIntervalMinutes(env({ SHEET_AUTO_SYNC_MINUTES: "5" }))).toBe(5);
    expect(autoSyncIntervalMinutes(env({ SHEET_AUTO_SYNC_MINUTES: "0" }))).toBeNull();
    expect(autoSyncIntervalMinutes(env({ SHEET_AUTO_SYNC_MINUTES: "soon" }))).toBe(3);
  });

  it("leaves the timer off on Cloud Run unless it is set explicitly", () => {
    expect(autoSyncIntervalMinutes(env({ K_SERVICE: "aphrodite-shop" }))).toBeNull();
    expect(
      autoSyncIntervalMinutes(env({ K_SERVICE: "aphrodite-shop", SHEET_AUTO_SYNC_MINUTES: "3" }))
    ).toBe(3);
  });
});

describe("scheduler authorization", () => {
  const secret = "a-long-random-cron-secret-value";

  it("accepts only the exact bearer secret", () => {
    expect(isAuthorizedCronRequest(`Bearer ${secret}`, secret)).toBe(true);
    expect(isAuthorizedCronRequest("Bearer wrong", secret)).toBe(false);
    expect(isAuthorizedCronRequest(null, secret)).toBe(false);
  });

  it("stays closed when no usable secret is configured", () => {
    expect(isAuthorizedCronRequest("Bearer ", undefined)).toBe(false);
    expect(isAuthorizedCronRequest("Bearer short", "short")).toBe(false);
  });
});

describe("status shown in admin", () => {
  const env = (values: Record<string, string>) => values as unknown as NodeJS.ProcessEnv;

  it("says the sync is scheduled when the scheduler secret is set, even before this server ran one", () => {
    const status = autoSyncStatus(env({ CRON_SECRET: "a-long-random-cron-secret-value" }));
    expect(status).toMatchObject({ scheduled: true, intervalMinutes: null, lastCheckAt: null });
  });

  it("is not scheduled without a usable secret", () => {
    expect(autoSyncStatus(env({})).scheduled).toBe(false);
    expect(autoSyncStatus(env({ CRON_SECRET: "short" })).scheduled).toBe(false);
  });
});
