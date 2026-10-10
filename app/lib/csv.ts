/**
 * CSV helpers shared by the admin reports.
 *
 * Text that starts with = + - @ (or a tab/CR) is prefixed with an apostrophe so
 * Excel/Sheets never run a customer-controlled value as a formula. Real
 * numbers are written as-is so negatives and totals stay numeric.
 */
export function csvCell(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function csvRow(values: unknown[]) {
  return values.map(csvCell).join(",");
}

/** UTF-8 BOM so Excel opens Burmese text correctly. */
export function csvDocument(lines: string[]) {
  return `﻿${lines.join("\r\n")}`;
}
