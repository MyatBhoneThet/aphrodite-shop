import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../app/lib/google-sheets", async (importOriginal) => {
  const original = await importOriginal<typeof import("../app/lib/google-sheets")>();
  return {
    ...original,
    hasGoogleSheetsConfig: vi.fn(() => true),
    setSheetProductQuantity: vi.fn(),
  };
});

vi.mock("../app/lib/supabase", async (importOriginal) => {
  const original = await importOriginal<typeof import("../app/lib/supabase")>();
  return {
    ...original,
    selectProductByIdService: vi.fn(),
    updateProduct: vi.fn(),
    setSheetStockBaselines: vi.fn(),
    insertAuditLog: vi.fn(),
  };
});

import { patchProduct } from "../app/lib/backend";
import {
  hasGoogleSheetsConfig,
  planSheetQuantitySet,
  setSheetProductQuantity,
} from "../app/lib/google-sheets";
import {
  insertAuditLog,
  selectProductByIdService,
  setSheetStockBaselines,
  updateProduct,
  type CurrentUser,
  type ProductRow,
  type Profile,
} from "../app/lib/supabase";

const KEY = "production:accessories:rog-ally";

function admin(): CurrentUser {
  const profile: Profile = {
    id: "admin-1", email: "admin@example.com", full_name: "Admin", role: "admin",
    wholesale_status: "not_applied", price_list_id: null, phone: null,
  };
  return { id: "admin-1", email: profile.email, role: "admin", profile, accessToken: "token" };
}

function productRow(overrides: Partial<ProductRow> = {}): ProductRow {
  return {
    id: 216, source_key: KEY, source_sheet: "Accessories",
    name: "ASUS ROG Ally (2023) RC71L-NH001W", type: "accessory", category: "Gaming Machine",
    brand: "Asus", price: 2_410_660, wholesale_price: null, image: "", model_3d: null,
    stock: "In Stock", stock_quantity: 2, specs: {}, full_specs: {},
    ...overrides,
  } as ProductRow;
}

beforeEach(() => {
  vi.mocked(hasGoogleSheetsConfig).mockReset().mockReturnValue(true);
  vi.mocked(selectProductByIdService).mockReset().mockResolvedValue(productRow());
  vi.mocked(updateProduct).mockReset().mockResolvedValue(productRow({ stock_quantity: 3 }));
  vi.mocked(setSheetProductQuantity).mockReset().mockResolvedValue({
    status: "updated", sheet: "Accessories",
    cells: [{ row: 40, from: 2, to: 3 }], sheetQuantityBefore: 2, sheetQuantityAfter: 3,
  });
  vi.mocked(setSheetStockBaselines).mockReset().mockResolvedValue(undefined);
  vi.mocked(insertAuditLog).mockReset().mockResolvedValue(undefined);
});

describe("planning the sheet cells for an admin stock change", () => {
  it("adds extra units to the product's first row", () => {
    expect(planSheetQuantitySet([{ row: 11, quantity: 2 }, { row: 12, quantity: 1 }], 5)).toEqual({
      cells: [{ row: 11, from: 2, to: 4 }],
      total: 3,
    });
  });

  it("removes units from rows top-down, like a sale", () => {
    // 3 → 1: both removed units come off row 11; row 12 is untouched.
    expect(planSheetQuantitySet([{ row: 11, quantity: 2 }, { row: 12, quantity: 1 }], 1).cells).toEqual([
      { row: 11, from: 2, to: 0 },
    ]);
  });

  it("changes nothing when the sheet already has that number", () => {
    expect(planSheetQuantitySet([{ row: 11, quantity: 2 }], 2).cells).toEqual([]);
  });

  it("never plans a negative cell", () => {
    const { cells } = planSheetQuantitySet([{ row: 11, quantity: 1 }, { row: 12, quantity: 1 }], -4);
    expect(cells.every((cell) => cell.to >= 0)).toBe(true);
    expect(cells).toEqual([
      { row: 11, from: 1, to: 0 },
      { row: 12, from: 1, to: 0 },
    ]);
  });
});

describe("admin saves a new stock quantity", () => {
  it("writes the sheet, saves the product, then records the sheet number for the next sync", async () => {
    const result = await patchProduct(admin(), 216, { stockQuantity: 3 });

    expect(setSheetProductQuantity).toHaveBeenCalledWith(KEY, 3);
    expect(updateProduct).toHaveBeenCalledWith(216, { stockQuantity: 3 });
    expect(setSheetStockBaselines).toHaveBeenCalledWith([{ sourceKey: KEY, sheetQuantity: 3 }]);
    expect(result?.sheetStock).toMatchObject({
      sheet: "Accessories", sheetQuantityBefore: 2, sheetQuantityAfter: 3, warning: null,
    });
    expect(vi.mocked(insertAuditLog).mock.calls[0][0].action).toBe("product.stock.sheet_write");

    const writeOrder = vi.mocked(setSheetProductQuantity).mock.invocationCallOrder[0];
    expect(writeOrder).toBeLessThan(vi.mocked(updateProduct).mock.invocationCallOrder[0]);
  });

  it("does not touch the sheet when only other fields changed", async () => {
    const result = await patchProduct(admin(), 216, { stockQuantity: 2, price: 2_500_000 });

    expect(setSheetProductQuantity).not.toHaveBeenCalled();
    expect(updateProduct).toHaveBeenCalled();
    expect(result?.sheetStock).toBeNull();
  });

  it("keeps products added by hand in admin website-only", async () => {
    vi.mocked(selectProductByIdService).mockResolvedValue(productRow({ source_key: null }));

    await patchProduct(admin(), 216, { stockQuantity: 9 });

    expect(setSheetProductQuantity).not.toHaveBeenCalled();
    expect(updateProduct).toHaveBeenCalledWith(216, { stockQuantity: 9 });
  });

  it("saves nothing when the sheet write fails", async () => {
    vi.mocked(setSheetProductQuantity).mockRejectedValue(new Error("Google said no"));

    await expect(patchProduct(admin(), 216, { stockQuantity: 3 })).rejects.toThrow(
      /could not be written to the Google Sheet/
    );
    expect(updateProduct).not.toHaveBeenCalled();
    expect(setSheetStockBaselines).not.toHaveBeenCalled();
  });

  it("refuses a stock change for a product that is no longer in the sheet", async () => {
    vi.mocked(setSheetProductQuantity).mockResolvedValue({ status: "not_in_sheet" });

    await expect(patchProduct(admin(), 216, { stockQuantity: 3 })).rejects.toThrow(
      /no longer in the Google Sheet/
    );
    expect(updateProduct).not.toHaveBeenCalled();
  });

  it("still saves, with a warning, when only the sync record fails", async () => {
    vi.mocked(setSheetStockBaselines).mockRejectedValue(new Error("db down"));

    const result = await patchProduct(admin(), 216, { stockQuantity: 3 });

    expect(updateProduct).toHaveBeenCalled();
    expect(result?.sheetStock?.warning).toMatch(/Sync Products/);
  });

  it("is website-only when the Google Sheet is not connected", async () => {
    vi.mocked(hasGoogleSheetsConfig).mockReturnValue(false);

    await patchProduct(admin(), 216, { stockQuantity: 3 });

    expect(selectProductByIdService).not.toHaveBeenCalled();
    expect(setSheetProductQuantity).not.toHaveBeenCalled();
    expect(updateProduct).toHaveBeenCalled();
  });
});
