import { describe, expect, it } from "vitest";
import { reconcileStockQuantity } from "../app/lib/supabase";

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
