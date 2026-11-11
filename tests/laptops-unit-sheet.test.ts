import { describe, expect, it, vi } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { allocatedSheetRows, buildSheetProductRow, decrementSheetQuantities, incrementSheetQuantities, parseProductionSheets, planSheetRestock, planSheetQuantitySet, type ProductionSheetsValues } from "../app/lib/google-sheets";
import { priceLine } from "../app/lib/pricing";

function workbook(): ProductionSheetsValues {
  return {
    Laptops: [
      ["Remark", "Code", "SN", "Model No.", "Warranty", "Grade", "Brand", "Model", "Specs ( Details )", "In-Stock\nStatus", "QTY", "Retail\nPrice", "B2B Price update", "Wholesale & SI Price update", "Status"],
      ["MOCK DATA - prices in MMK", "JET436", "1YF5KL11", "ANV15-51", "1 year", "Brand New", "Acer", "Nitro V 15", "Core i5-13420H / 16GB / 512GB SSD / RTX 4050 / 15.6 FHD 144Hz", "Y", 0, 3500000, 3400000, 3300000, "BKK"],
      ["MOCK DATA - prices in MMK", "JET437", "another-serial", "ANV15-51", "1 year", "Used - Grade A", "Acer", "Nitro V 15", "Core i5-13420H / 16GB / 512GB SSD / RTX 4050 / 15.6 FHD 144Hz", "N", 1, 3000000, 2900000, 2800000, "BKK"],
    ],
    Accessories: [["Pur no", "Category", "Brand", "Model No", "Model", "Specs", "Warranty", "ClosingQty", "Retail Price MMK"]],
    "PC Parts": [["Pur no", "Category", "Brand", "Description", "ClosingQty", "Retail Price MMK"]],
  };
}

describe("the Laptops tab's individual units", () => {
  it("imports Status separately from In-Stock Status and retains each pooled row's delivery origin", () => {
    const values = workbook();
    values.Laptops[1][10] = 1;
    const duplicate = [...values.Laptops[1]];
    duplicate[1] = "ANOTHER-CODE"; duplicate[2] = "ANOTHER-SN"; duplicate[14] = "YGN APD";
    values.Laptops.push(duplicate);
    const pool = parseProductionSheets(values).products.find(p => p.sourceRows.includes(2))!;
    expect(pool.fullSpecs.deliveryStockLocations).toEqual([{ status: "BKK", quantity: 1 }, { status: "YGN APD", quantity: 1 }]);
  });

  it("writes exactly the reserved serial cells for one or two units, including after rows move", async () => {
    const values = workbook();
    values.Laptops[1][10] = 1;
    const duplicate = [...values.Laptops[1]]; duplicate[1] = "JET438"; duplicate[2] = "other-sn";
    values.Laptops.push(duplicate);
    const pool = parseProductionSheets(values).products.find(p => p.sourceRows.includes(2))!;
    const writes: { range: string; values: number[][] }[][] = [];
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 1024 });
    vi.stubEnv("GOOGLE_SHEETS_CLIENT_EMAIL", "test@example.invalid");
    vi.stubEnv("GOOGLE_SHEETS_PRIVATE_KEY", privateKey.export({ type: "pkcs8", format: "pem" }).toString());
    vi.stubGlobal("fetch", vi.fn(async (url: unknown, init?: RequestInit) => {
      const address = String(url);
      if (address.includes("oauth2.googleapis.com")) return Response.json({ access_token: "test-token" });
      if (address.includes("values:batchGet")) return Response.json({ valueRanges: Object.entries(values).map(([sheet, rows]) => ({ range: `'${sheet}'!A1:Z99`, values: rows })) });
      if (address.includes("values:batchUpdate")) {
        writes.push(JSON.parse(String(init?.body)).data);
        return Response.json({});
      }
      throw new Error("Unexpected test request");
    }));
    try {
      await decrementSheetQuantities([{ sourceKey: pool.sourceKey, quantity: 1, units: [pool.sheetUnits![1]] }]);
      expect(writes.pop()).toEqual([{ range: "'Laptops'!K4", values: [[0]] }]);
      await decrementSheetQuantities([{ sourceKey: pool.sourceKey, quantity: 2, units: pool.sheetUnits }]);
      expect(writes.pop()).toEqual([{ range: "'Laptops'!K2", values: [[0]] }, { range: "'Laptops'!K4", values: [[0]] }]);
      values.Laptops = [values.Laptops[0], duplicate, values.Laptops[2], values.Laptops[1]];
      await decrementSheetQuantities([{ sourceKey: pool.sourceKey, quantity: 1, units: [pool.sheetUnits![1]] }]);
      expect(writes.pop()).toEqual([{ range: "'Laptops'!K2", values: [[0]] }]);
      values.Laptops[1][10] = 0;
      await incrementSheetQuantities([{ sourceKey: pool.sourceKey, quantity: 1, units: [pool.sheetUnits![1]] }]);
      expect(writes.pop()).toEqual([{ range: "'Laptops'!K2", values: [[1]] }]);
    } finally {
      vi.unstubAllGlobals(); vi.unstubAllEnvs();
    }
  });

  it("pools matching laptops into total stock and resolves reserved serials after rows move", () => {
    const values = workbook();
    values.Laptops[1][10] = 1;
    const second = [...values.Laptops[1]];
    second[1] = "JET438"; second[2] = "different-serial";
    values.Laptops.push(second);
    const product = parseProductionSheets(values).products.find(p => p.sourceRows.includes(2))!;
    expect(product.stockQuantity).toBe(2);
    expect(product.sourceRows).toEqual([2, 4]);
    expect(product.sheetUnits?.map(unit => unit.serialNumber)).toEqual(["1YF5KL11", "different-serial"]);
    const reserved = [product.sheetUnits![1]];
    values.Laptops = [values.Laptops[0], second, values.Laptops[2], values.Laptops[1]];
    const moved = parseProductionSheets(values).products.find(p => p.sourceKey === product.sourceKey)!;
    expect(allocatedSheetRows(moved, reserved, 1)).toEqual([{ row: 2, quantity: 1 }]);
    expect(allocatedSheetRows(moved, product.sheetUnits!, 2)).toHaveLength(2);
    expect(() => allocatedSheetRows(moved, [reserved[0], reserved[0]], 2)).toThrow("distinct laptop serial");
    expect(() => allocatedSheetRows(moved, [], 1)).toThrow("reserve one distinct");
    expect(planSheetQuantitySet([{ row: 2, quantity: 0 }, { row: 4, quantity: 0 }], 2, true).cells).toEqual([{ row: 2, from: 0, to: 1 }, { row: 4, from: 0, to: 1 }]);
    expect(() => planSheetQuantitySet([{ row: 2, quantity: 0 }], 2, true)).toThrow("Code/SN");
  });

  it("keeps identical models separate by Code/SN with retail, wholesale and binary availability", () => {
    const result = parseProductionSheets(workbook());
    expect(result.quantityColumns.Laptops).toBe(10);
    expect(result.products).toHaveLength(2);
    const first = result.products.find(p => p.rowNumber === 2)!;
    const second = result.products.find(p => p.rowNumber === 3)!;
    expect(first.sourceKey).not.toBe(second.sourceKey);
    expect(first).toMatchObject({ unitInventory: true, stockQuantity: 0, stock: "Out of Stock", price: 3500000, sheetWholesale: { unitPrice: 3300000, minQuantity: 1 }, sourceRows: [2] });
    expect(second).toMatchObject({ stockQuantity: 1, stock: "In Stock", price: 3000000, sheetWholesale: { unitPrice: 2800000, minQuantity: 1 }, sourceRows: [3] });
    expect(first.fullSpecs).toMatchObject({ processor: "Core i5-13420H", ram: "16GB", storage: "512GB SSD", graphics: "RTX 4050", display: "15.6 FHD 144Hz", warranty: "1 year", condition: "Brand New" });
    expect(second.fullSpecs.condition).toBe("Used - Grade A");
    const tier = { id: "sheet", price_list_id: "wholesale", product_id: 1, min_quantity: first.sheetWholesale!.minQuantity, unit_price: first.sheetWholesale!.unitPrice, is_active: true, effective_from: null, effective_to: null };
    expect(priceLine({ retailPrice: first.price, quantity: 1, tiers: [] }).unitPrice).toBe(3500000);
    expect(priceLine({ retailPrice: first.price, quantity: 1, tiers: [tier] }).unitPrice).toBe(3300000);
  });

  it("keeps unit keys stable when rows move, models or prices change", () => {
    const values = workbook();
    const before = parseProductionSheets(values).products.map(p => p.sourceKey).sort();
    values.Laptops[1][7] = "Renamed model";
    values.Laptops[1][11] = 3600000;
    values.Laptops = [values.Laptops[0], values.Laptops[2], values.Laptops[1]];
    expect(parseProductionSheets(values).products.map(p => p.sourceKey).sort()).toEqual(before);
  });

  it.each([2, -1, 0.5, "", "invalid"])("rejects non-binary QTY %s", quantity => {
    const values = workbook(); values.Laptops[1][10] = quantity;
    expect(() => parseProductionSheets(values)).toThrow("QTY must be 0");
  });

  it("rejects duplicate units and missing identifiers", () => {
    const values = workbook(); values.Laptops.push([...values.Laptops[1]]);
    expect(() => parseProductionSheets(values)).toThrow("duplicate Code and SN");
    values.Laptops.pop(); values.Laptops[1][2] = "";
    expect(() => parseProductionSheets(values)).toThrow("Code and SN are required");
  });

  it("never substitutes B2B or wholesale for missing retail and clears invalid wholesale", () => {
    const values = workbook(); values.Laptops[1][11] = ""; values.Laptops[2][13] = 4000000;
    const result = parseProductionSheets(values).products;
    expect(result.find(p => p.rowNumber === 2)).toMatchObject({ price: 0, sheetWholesale: null });
    expect(result.find(p => p.rowNumber === 3)).toMatchObject({ price: 3000000, sheetWholesale: null });
  });

  it("restores at most one unit and reports already available units as unrestored", () => {
    expect(planSheetRestock([{ row: 2, quantity: 0 }], 1, [], true)).toEqual({ cells: [{ row: 2, from: 0, to: 1 }], unrestored: 0 });
    expect(planSheetRestock([{ row: 2, quantity: 1 }], 1, [], true)).toEqual({ cells: [], unrestored: 1 });
    expect(planSheetRestock([{ row: 2, quantity: 0 }], 2, [], true)).toEqual({ cells: [{ row: 2, from: 0, to: 1 }], unrestored: 1 });
  });

  it("requires an identity and binary stock when the admin adds a laptop", () => {
    const input = { sheet: "Laptops" as const, name: "Laptop", brand: "Acer", category: "Laptop", price: 2000000, stockQuantity: 1 };
    expect(() => buildSheetProductRow(workbook().Laptops, input)).toThrow("Code and serialNumber");
    expect(() => buildSheetProductRow(workbook().Laptops, { ...input, stockQuantity: 2 })).toThrow("QTY must be 0");
    const { cells } = buildSheetProductRow(workbook().Laptops, { ...input, fullSpecs: { code: "NEW1", serialNumber: "SN1" } });
    expect(cells[1]).toBe("NEW1"); expect(cells[2]).toBe("SN1"); expect(cells[10]).toBe(1); expect(cells[11]).toBe(2000000);
  });
});
