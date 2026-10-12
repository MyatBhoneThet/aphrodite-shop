"use client";

import { useAdminText } from "../lib/useAdminText";
import { describeAutoSync } from "./sync-status";
import type { AutoSyncStatus, SheetSyncReport } from "./types";

type Props = {
  isSyncing: boolean;
  autoSync: AutoSyncStatus | null;
  sheetSyncReport: SheetSyncReport | null;
  onSync: (dryRun: boolean) => void;
};

/** Google Sheet product sync: dry run, real sync, and what the last run did. */
export default function SheetSyncPanel({ isSyncing, autoSync, sheetSyncReport, onSync: handleSyncProducts }: Props) {
  const a = useAdminText();

  return (
      <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-100">
        <h2 className="text-xl font-bold">{a("Google Sheet Product Sync")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-zinc-500">
           {a("Imports the production Laptops, Accessories, and PC Parts tabs. Dry run validates and groups inventory rows without saving. Real sync imports the resulting products into Supabase.")} </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => handleSyncProducts(true)}
            disabled={isSyncing}
            className="rounded-full border px-5 py-3 font-semibold disabled:bg-zinc-100"
          >
             {a("Dry Run")} </button>

          <button
            onClick={() => handleSyncProducts(false)}
            disabled={isSyncing}
            className="rounded-full bg-red-600 px-5 py-3 font-semibold text-white disabled:bg-zinc-400"
          >
             {a("Sync Products")} </button>
        </div>

        <p className="mt-4 max-w-2xl text-sm text-zinc-600">
          {a(describeAutoSync(autoSync))}
        </p>
        {autoSync?.lastResult === "failed" && autoSync.lastError && (
          <p className="mt-1 max-w-2xl text-sm font-semibold text-red-700">
             {a("Last automatic sync failed:")} {autoSync.lastError}
          </p>
        )}

        {sheetSyncReport && (
          <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
            <p className="font-bold">
              {sheetSyncReport.dryRun ? a("Dry-run result") : a("Last sync")}: {" "}
              {sheetSyncReport.count.toLocaleString()}  {a("products")} </p>
            {sheetSyncReport.bySheet.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2 text-sm">
                {sheetSyncReport.bySheet.map((entry) => (
                  <li
                    key={entry.sheet}
                    className="rounded-full bg-white px-3 py-1 ring-1 ring-zinc-200"
                  >
                    {entry.sheet}: {entry.products.toLocaleString()}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-sm text-zinc-600">
              {sheetSyncReport.skippedCount.toLocaleString()}  {a("source rows skipped.")} </p>
            {sheetSyncReport.warnings.length > 0 && (
              <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                <p className="font-bold">{a("Review before syncing")}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {sheetSyncReport.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
            {sheetSyncReport.stockCorrections &&
              (sheetSyncReport.stockCorrections.aboveSheet.length > 0 ||
                sheetSyncReport.stockCorrections.removedFromSheet.length > 0) && (
                <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
                  <p className="font-bold">
                    {sheetSyncReport.dryRun
                      ? a("Stock that will be corrected to match the sheet")
                      : a("Stock corrected to match the sheet")}
                  </p>
                  <p className="mt-1 text-xs text-sky-800">
                     {a("The website never shows more units than the Google Sheet.")} </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {sheetSyncReport.stockCorrections.aboveSheet.map((item) => (
                      <li key={`above-${item.sourceKey}`}>
                        <span className="font-semibold">{item.name}</span> ({item.sourceSheet}{a("): website")} {item.websiteQuantity}  {a("→ sheet")} {item.sheetQuantity}
                        {item.sheetQuantity === 0 ? a(" · Out of Stock") : ""}
                      </li>
                    ))}
                    {sheetSyncReport.stockCorrections.removedFromSheet.map((item) => (
                      <li key={`removed-${item.sourceKey}`}>
                        <span className="font-semibold">{item.name}</span> ({item.sourceSheet}{a("): no longer in the sheet → removed from the website")} </li>
                    ))}
                  </ul>
                </div>
              )}
          </div>
        )}
      </section>
  );
}
