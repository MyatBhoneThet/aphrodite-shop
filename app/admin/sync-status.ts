import { authHeaders } from "../lib/client-auth";
import { formatDateTime } from "../lib/format";
import type { AutoSyncStatus } from "./types";

/** Informational only: null when the status cannot be loaded. */
export async function fetchAutoSyncStatus(): Promise<AutoSyncStatus | null> {
  try {
    const response = await fetch("/api/admin/sync-products", {
      headers: authHeaders(),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { automatic?: AutoSyncStatus };
    return data.automatic ?? null;
  } catch {
    return null;
  }
}

export function describeAutoSync(status: AutoSyncStatus | null) {
  if (!status) return "Checking automatic sync…";

  const parts = [
    status.intervalMinutes
      ? `Automatic sync is on: this server checks the sheet every ${status.intervalMinutes} min and saves only when it changed.`
      : status.scheduled
        ? "Automatic sync is on: Google Cloud Scheduler checks the sheet and saves only when it changed."
        : "Automatic sync is off on this server. Click Sync Products after editing the sheet.",
  ];
  if (status.lastCheckAt) {
    const outcome =
      status.lastResult === "synced"
        ? "sheet changes saved"
        : status.lastResult === "unchanged"
          ? "no changes"
          : "failed";
    parts.push(`Last check ${formatDateTime(status.lastCheckAt)}: ${outcome}.`);
  }
  if (status.lastSyncAt) parts.push(`Last saved ${formatDateTime(status.lastSyncAt)}.`);

  return parts.join(" ");
}
