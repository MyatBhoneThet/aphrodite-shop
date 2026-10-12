"use client";

import { useEffect, useState } from "react";
import { authHeaders } from "../lib/client-auth";
import { fetchAutoSyncStatus } from "./sync-status";
import type { AutoSyncStatus, SheetSyncReport } from "./types";

type Options = {
  /** True while the sync panel is on screen: the status refreshes only then. */
  active: boolean;
  loadDashboardData: () => Promise<void>;
  setMessage: (message: string) => void;
  setError: (message: string) => void;
};

/** The Google Sheet sync panel: dry run, real sync, and the automatic-sync status. */
export function useSheetSync({ active, loadDashboardData, setMessage, setError }: Options) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [sheetSyncReport, setSheetSyncReport] =
    useState<SheetSyncReport | null>(null);
  const [autoSync, setAutoSync] = useState<AutoSyncStatus | null>(null);

  // While the sync panel is open, refresh the automatic sync status every 30 s.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    async function refresh() {
      const status = await fetchAutoSyncStatus();
      if (!cancelled && status) setAutoSync(status);
    }

    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [active]);

  async function handleSyncProducts(dryRun: boolean) {
    setMessage("");
    setError("");
    setIsSyncing(true);

    try {
      const response = await fetch("/api/admin/sync-products", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ dryRun }),
      });

      const data = (await response.json().catch(() => null)) as {
        dryRun?: boolean;
        count?: number;
        skippedRows?: unknown[];
        warnings?: string[];
        stockCorrections?: SheetSyncReport["stockCorrections"];
        summary?: { bySheet?: { sheet: string; products: number }[] };
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to sync products.");
      }

      if (!dryRun) {
        await loadDashboardData();
        const status = await fetchAutoSyncStatus();
        if (status) setAutoSync(status);
      }

      const skippedCount = data?.skippedRows?.length ?? 0;
      const warningCount = data?.warnings?.length ?? 0;
      const stockCorrections = data?.stockCorrections ?? null;
      const correctionCount =
        (stockCorrections?.aboveSheet.length ?? 0) +
        (stockCorrections?.removedFromSheet.length ?? 0);
      const details = `${skippedCount} rows skipped; ${warningCount} warnings; ${correctionCount} stock ${
        dryRun ? "corrections to make" : "corrections made"
      }.`;

      setSheetSyncReport({
        dryRun,
        count: data?.count ?? 0,
        skippedCount,
        warnings: data?.warnings ?? [],
        bySheet: data?.summary?.bySheet ?? [],
        stockCorrections,
      });

      setMessage(
        dryRun
          ? `Dry run complete. ${data?.count ?? 0} products found; ${details}`
          : `Sync complete. ${data?.count ?? 0} products updated; ${details}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sync products.");
    } finally {
      setIsSyncing(false);
    }
  }

  return { isSyncing, sheetSyncReport, autoSync, handleSyncProducts };
}
