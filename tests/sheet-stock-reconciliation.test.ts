import { describe, expect, it } from "vitest";
import {
  planStockCorrections,
  reconcileStockQuantity,
  type SyncedStockRow,
} from "../app/lib/supabase";

// Inventory is written by two systems: the production workbook (restocks) and
// checkout (sales). A sync must merge them, not let the workbook overwrite
// sales it has not been told about yet.
describe("reconcileStockQuantity", () => {
  it("uses the workbook quantity for a product that is new to the store", () => {
    expect(reconcileStockQuantity(5, undefined)).toBe(5);
  });

  it("keeps a sale that the workbook does not know about", () => {
    // Workbook still says 3; the storefront sold one and write-back failed.
    expect(
      reconcileStockQuantity(3, { stock_quantity: 2, sheet_stock_quantity: 3 })
    ).toBe(2);
  });

  it("does not double-count a sale the workbook already recorded", () => {
    // Write-back succeeded: both the workbook and the baseline dropped to 2.
    expect(
      reconcileStockQuantity(2, { stock_quantity: 2, sheet_stock_quantity: 2 })
    ).toBe(2);
  });

  it("applies a restock entered in the workbook", () => {
    expect(
      reconcileStockQuantity(10, { stock_quantity: 2, sheet_stock_quantity: 3 })
    ).toBe(9);
  });

  it("applies a correction that lowers the workbook quantity", () => {
    expect(
      reconcileStockQuantity(1, { stock_quantity: 5, sheet_stock_quantity: 6 })
    ).toBe(0);
  });

  it("never returns negative inventory", () => {
    expect(
      reconcileStockQuantity(0, { stock_quantity: 1, sheet_stock_quantity: 9 })
    ).toBe(0);
  });

  it("treats a row with no baseline as unchanged so the first sync is a no-op", () => {
    // Rows that predate delta tracking must not jump back to the workbook
    // number the first time this runs.
    expect(
      reconcileStockQuantity(3, { stock_quantity: 2, sheet_stock_quantity: null })
    ).toBe(2);
  });
});

// Real cases from the live catalogue on 2026-09-15: an order was cancelled
// before cancellations updated the sheet, so the website kept extra units the
// sheet never received -- and the delta rule alone could never remove them.
describe("the website never shows more stock than the sheet", () => {
  it("a sheet quantity of 0 is out of stock even if the website had drifted to 1", () => {
    expect(
      reconcileStockQuantity(0, { stock_quantity: 1, sheet_stock_quantity: 0 })
    ).toBe(0);
  });

  it("brings a drifted quantity back down to the sheet", () => {
    expect(
      reconcileStockQuantity(1, { stock_quantity: 3, sheet_stock_quantity: 1 })
    ).toBe(1);
    expect(
      reconcileStockQuantity(11, { stock_quantity: 13, sheet_stock_quantity: 11 })
    ).toBe(11);
  });

  it("still applies a sheet restock, capped at the sheet", () => {
    expect(
      reconcileStockQuantity(5, { stock_quantity: 3, sheet_stock_quantity: 1 })
    ).toBe(5);
  });
});

function dbRow(overrides: Partial<SyncedStockRow>): SyncedStockRow {
  return {
    id: 1,
    name: "Product",
    source_sheet: "Laptops",
    source_key: "key-1",
    stock_quantity: 1,
    sheet_stock_quantity: 1,
    ...overrides,
  };
}

describe("planStockCorrections", () => {
  const sheet = (sourceKey: string, stockQuantity: number, sourceSheet = "Laptops") => ({
    sourceKey,
    sourceSheet,
    name: sourceKey,
    stockQuantity,
  });

  it("lists products the website shows above the sheet, and nothing else", () => {
    const plan = planStockCorrections(
      [sheet("above", 0), sheet("below", 3), sheet("equal", 2)],
      [
        dbRow({ id: 12, source_key: "above", stock_quantity: 1, sheet_stock_quantity: 0 }),
        dbRow({ id: 13, source_key: "below", stock_quantity: 2, sheet_stock_quantity: 3 }),
        dbRow({ id: 14, source_key: "equal", stock_quantity: 2, sheet_stock_quantity: 2 }),
      ]
    );

    expect(plan.aboveSheet).toEqual([
      expect.objectContaining({ id: 12, websiteQuantity: 1, sheetQuantity: 0 }),
    ]);
    expect(plan.removedFromSheet).toEqual([]);
  });

  it("marks an in-stock product deleted from the sheet as removed", () => {
    const plan = planStockCorrections(
      [sheet("kept", 1)],
      [
        dbRow({ id: 1, source_key: "kept" }),
        dbRow({ id: 195, source_key: "deleted", stock_quantity: 1 }),
        dbRow({ id: 196, source_key: "deleted-and-empty", stock_quantity: 0 }),
      ]
    );

    expect(plan.removedFromSheet.map((item) => item.id)).toEqual([195]);
    expect(plan.heldBack).toEqual([]);
  });

  it("holds back when too many rows vanish at once", () => {
    const rows = Array.from({ length: 10 }, (_, index) =>
      dbRow({ id: index + 1, source_key: `gone-${index}`, stock_quantity: 2 })
    );
    const plan = planStockCorrections([sheet("still-here", 1)], [
      ...rows,
      dbRow({ id: 99, source_key: "still-here" }),
    ]);

    expect(plan.removedFromSheet).toEqual([]);
    expect(plan.heldBack).toHaveLength(10);
  });

  it("holds back a whole tab that did not load at all", () => {
    const plan = planStockCorrections(
      [sheet("laptop", 1)],
      [
        dbRow({ id: 1, source_key: "laptop" }),
        dbRow({ id: 2, source_key: "mouse", source_sheet: "Accessories", stock_quantity: 4 }),
      ]
    );

    expect(plan.removedFromSheet).toEqual([]);
    expect(plan.heldBack.map((item) => item.id)).toEqual([2]);
  });
});
