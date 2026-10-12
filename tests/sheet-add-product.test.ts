import { describe, expect, it } from "vitest";
import {
  buildSheetProductRow,
  parseProductionSheets,
  specsToSheetDetail,
  type ProductionSheetsValues,
  type SheetProductInput,
} from "../app/lib/google-sheets";

function row(values: Record<number, unknown>) {
  const cells: unknown[] = [];
  for (const [index, value] of Object.entries(values)) {
    while (cells.length <= Number(index)) cells.push("");
    cells[Number(index)] = value;
  }
  return cells;
}

function workbook(): ProductionSheetsValues {
  return {
    Laptops: [
      row({ 0: "Pur No.", 3: "Warranty", 4: "Brand", 5: "Model No", 6: "Model", 7: "Specs (Detail)", 8: "Qty", 17: "Retail Price MMK" }),
      row({ 0: "S1", 4: "Dell", 6: "Latitude 5420", 7: "• Intel Core i5 • 16GB RAM", 8: 4, 17: 900000 }),
    ],
    Accessories: [
      row({ 0: "Pur no", 1: "Remark", 5: "Category", 7: "Model No", 8: "Warranty", 9: "Brand", 10: "Model", 11: "Specs", 24: "ClosingQty", 33: "Retail Price MMK" }),
      row({ 0: "A1", 5: "Mouse", 9: "Logitech", 10: "M90", 24: 3, 33: 20000 }),
    ],
    "PC Parts": [
      row({ 0: "Pur no", 1: "Remark", 7: "Category", 8: "Brand", 9: "Description", 24: "ClosingQty", 33: "Retail Price MMK" }),
      row({ 0: "P1", 7: "SSD", 8: "WD", 9: "WD Green 240GB", 24: 5, 33: 90000 }),
    ],
  };
}

/** Parses the workbook as it would be after the new row is written. */
function addAndParse(input: SheetProductInput) {
  const values = workbook();
  const { rowNumber, cells } = buildSheetProductRow(values[input.sheet], input);
  const parsed = parseProductionSheets({
    ...values,
    [input.sheet]: [...values[input.sheet], cells],
  });
  return {
    rowNumber,
    cells,
    product: parsed.products.find(
      (product) => product.sourceSheet === input.sheet && product.sourceRows.includes(rowNumber)
    ),
  };
}

describe("adding a product to the Google Sheet from the admin panel", () => {
  it("writes a laptop row the sync reads back as the same product", () => {
    const { rowNumber, product } = addAndParse({
      sheet: "Laptops",
      name: "Modern A15",
      brand: "MSI",
      category: "Laptop",
      price: 1990000,
      stockQuantity: 25,
      fullSpecs: { processor: "AMD Ryzen 5", ram: "8GB", storage: "512GB SSD", warranty: "1 year" },
    });

    expect(rowNumber).toBe(3);
    expect(product).toMatchObject({
      name: "Modern A15",
      brand: "MSI",
      type: "laptop",
      price: 1990000,
      stockQuantity: 25,
      stock: "In Stock",
      sourceRows: [3],
    });
    expect(product?.fullSpecs).toMatchObject({
      processor: "AMD Ryzen 5",
      ram: "8GB RAM",
      storage: "512GB SSD",
      warranty: "1 year",
    });
  });

  it("writes accessories and PC parts into their own columns", () => {
    const accessory = addAndParse({
      sheet: "Accessories", name: "G102", brand: "Logitech", category: "Mouse", price: 45000, stockQuantity: 2,
    });
    expect(accessory.product).toMatchObject({ name: "G102", category: "Mouse", price: 45000, stockQuantity: 2 });

    const part = addAndParse({
      sheet: "PC Parts", name: "Kingston 16GB DDR4", brand: "Kingston", category: "RAM", price: 0, stockQuantity: 0,
    });
    expect(part.product).toMatchObject({
      name: "Kingston 16GB DDR4", category: "RAM", price: 0, stock: "Out of Stock",
    });
  });

  it("merges into the existing product when the sheet already has it", () => {
    const { product } = addAndParse({
      sheet: "Accessories", name: "M90", brand: "Logitech", category: "Mouse", price: 20000, stockQuantity: 1,
    });
    // appendSheetProduct refuses this: more than one row means "already there".
    expect(product?.sourceRows).toEqual([2, 3]);
  });

  it("never writes empty cells, so formulas in other columns are untouched", () => {
    const { cells } = addAndParse({
      sheet: "Laptops", name: "X1", brand: "Lenovo", category: "Laptop", price: 0, stockQuantity: 1,
    });
    expect(cells.filter((cell) => cell === "")).toEqual([]);
    expect(cells[17] ?? null).toBeNull();
  });
});

describe("specsToSheetDetail", () => {
  it("keeps an existing detail text as it is", () => {
    expect(specsToSheetDetail({}, { detail: "• Intel Core i7 • 16GB" })).toBe("• Intel Core i7 • 16GB");
  });

  it("labels values and leaves out website-only fields", () => {
    expect(
      specsToSheetDetail(
        { cpu: "Intel Core i5" },
        { processor: "Intel Core i5", display: "14-inch FHD", color: "Black", gallery: [], warranty: "1 year" }
      )
    ).toBe("• Intel Core i5 • 14-inch FHD • Color: Black");
  });
});
