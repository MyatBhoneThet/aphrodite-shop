import { describe, expect, it } from "vitest";
import { csvCell, csvDocument, csvRow } from "../app/lib/csv";
import { formatYangon, MAX_EXPORT_DAYS, parseExportRange } from "../app/lib/report-range";

describe("csv helpers", () => {
  it("quotes text and escapes quotes", () => {
    expect(csvCell('He said "hi", ok')).toBe('"He said ""hi"", ok"');
  });
  it("neutralises spreadsheet formulas in text", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    expect(csvCell("@cmd")).toBe(`"'@cmd"`);
    expect(csvCell("+959123")).toBe(`"'+959123"`);
  });
  it("writes real numbers raw, including negatives", () => {
    expect(csvCell(1821060)).toBe("1821060");
    expect(csvCell(-5)).toBe("-5");
  });
  it("blank for null/undefined and joins rows with a BOM", () => {
    expect(csvRow([null, undefined, "a"])).toBe('"","","a"');
    expect(csvDocument(["a", "b"])).toBe("﻿a\r\nb");
  });
});

describe("export date range", () => {
  it("covers whole Yangon days as a half-open UTC range", () => {
    // 2026-09-01 00:00 Yangon = 2026-08-31 17:30 UTC
    expect(parseExportRange("2026-09-01", "2026-09-30")).toEqual({
      startIso: "2026-08-31T17:30:00.000Z",
      endIso: "2026-09-30T17:30:00.000Z",
    });
  });
  it("accepts a single day", () => {
    const { startIso, endIso } = parseExportRange("2026-09-24", "2026-09-24");
    expect(Date.parse(endIso) - Date.parse(startIso)).toBe(24 * 3600 * 1000);
  });
  it("rejects bad input", () => {
    expect(() => parseExportRange(null, "2026-09-01")).toThrow();
    expect(() => parseExportRange("09/01/2026", "2026-09-02")).toThrow();
    expect(() => parseExportRange("2026-02-30", "2026-03-01")).toThrow();
    expect(() => parseExportRange("2026-09-10", "2026-09-01")).toThrow();
  });
  it("limits the range length", () => {
    expect(() => parseExportRange("2025-01-01", "2026-12-31")).toThrow(String(MAX_EXPORT_DAYS));
  });
  it("formats Yangon time", () => {
    expect(formatYangon("2026-09-24T15:30:00.000Z")).toBe("2026-09-24 22:00");
    expect(formatYangon(null)).toBe("");
  });
});
