import { badRequest } from "./errors";

// Myanmar Standard Time is UTC+6:30 all year (no daylight saving). Accounting
// days follow the shop's clock, not UTC.
const YANGON_OFFSET_MS = 6.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_EXPORT_DAYS = 366;

function startOfYangonDay(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw badRequest("Dates must look like 2026-09-30.");
  const [year, month, day] = match.slice(1).map(Number);
  const utc = Date.UTC(year, month - 1, day);
  const check = new Date(utc);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw badRequest("That date does not exist.");
  }
  return utc - YANGON_OFFSET_MS;
}

/** Inclusive Yangon-day range -> half-open UTC range [start, end). */
export function parseExportRange(from: string | null, to: string | null) {
  if (!from || !to) throw badRequest("Choose a start and end date.");
  const start = startOfYangonDay(from);
  const end = startOfYangonDay(to) + DAY_MS;
  if (end <= start) throw badRequest("The end date must not be before the start date.");
  if ((end - start) / DAY_MS > MAX_EXPORT_DAYS) {
    throw badRequest(`Choose a range of ${MAX_EXPORT_DAYS} days or fewer.`);
  }
  return { startIso: new Date(start).toISOString(), endIso: new Date(end).toISOString() };
}

/** "2026-09-24 22:00" in Yangon time. */
export function formatYangon(iso: string | null | undefined) {
  if (!iso) return "";
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "";
  return new Date(time + YANGON_OFFSET_MS).toISOString().slice(0, 16).replace("T", " ");
}
