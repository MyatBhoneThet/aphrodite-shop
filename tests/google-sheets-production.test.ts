import { describe, expect, it } from "vitest";
import {
  parseProductionSheets,
  type ProductionSheetsValues,
} from "../app/lib/google-sheets";

function row(size: number, values: Record<number, unknown>) {
  const cells = Array.from<unknown>({ length: size }).fill("");
  for (const [index, value] of Object.entries(values)) {
    cells[Number(index)] = value;
  }
  return cells;
}

function productionValues(): ProductionSheetsValues {
  const laptopHeader = row(17, {
    0: "Pur No.",
    1: "Date",
    2: "SN",
    3: "Warranty",
    4: "Brand",
    5: "Model No",
    6: "Model",
    7: "Specs (Detail)",
    8: "Qty",
    9: "Pur Cost",
    10: "Amount",
    11: "Status",
  });
  const accessoryHeader = row(37, {
    0: "Pur no",
    1: "Remark",
    2: "Stock status",
    3: "Pur Date",
    4: "Supplier",
    5: "Category",
    6: "S/N",
    7: "Model No",
    8: "Warranty",
    9: "Brand",
    10: "Model",
    11: "Specs",
    12: "OpeningQty",
    13: "OpeningPur Cost",
    15: "PurchasedQty",
    16: "PurchaseUnit Cost",
    18: "Sale Date",
    24: "ClosingQty",
    25: "ClosingUnit Cost",
    27: "Stock Status",
  });
  const pcPartsHeader = row(34, {
    0: "Pur no",
    1: "Remark",
    3: "Pur Date",
    4: "SN",
    5: "Pur No of PC Set up",
    6: "Supplier",
    7: "Category",
    8: "Brand",
    9: "Description",
    10: "JIB",
    11: "APD",
    12: "OpeningQty",
    13: "OpeningUnit Cost",
    15: "PurchasedQty",
    16: "PurchaseUnit Cost",
    18: "Sale Date",
    24: "ClosingQty",
    25: "ClosingUnit Cost",
    27: "Stock Status",
  });

  return {
    Laptops: [
      [],
      [],
      [],
      [],
      [],
      laptopHeader,
      [],
      [],
      row(17, {
        0: "S4",
        3: "1 year",
        4: "HP",
        5: "450J3EC",
        6: "HP ProBook 640 G8",
        7: "• Intel Core i5-1145G7 • 16 GB DDR4 • 512 GB NVMe SSD • 14 inch FHD display",
        8: 1,
        9: 1_000,
      }),
      row(17, {
        0: "S5",
        4: "HP",
        5: "450J3EC",
        6: "HP ProBook 640 G8",
        8: 2,
        9: 1_200,
      }),
    ],
    Accessories: [
      [],
      [],
      [],
      [],
      [],
      accessoryHeader,
      [],
      [],
      [],
      row(37, {
        0: "A3278",
        5: "Monitor",
        7: "LS32FG812SEXXT",
        8: "2 years",
        9: "Samsung",
        10: "Samsung Odyssey OLED G8",
        11: "32 inch OLED 4K 240Hz",
        24: 1,
        25: "32,500.00",
      }),
      row(37, {
        0: "A3279",
        5: "Monitor",
        7: "LS32FG812SEXXT",
        9: "Samsung",
        10: "Samsung Odyssey OLED G8",
        24: "-",
        25: "31,000.00",
      }),
    ],
    "PC Parts": [
      [],
      [],
      [],
      [],
      [],
      pcPartsHeader,
      [],
      [],
      [],
      row(34, {
        0: "A1584",
        7: "GPU",
        8: "ZOTAC",
        9: "ZOTAC Gaming GeForce RTX 5090",
        13: 70_000,
        24: 1,
        25: "-",
      }),
    ],
  };
}

function useGroupedInventoryHeaders(values: ProductionSheetsValues) {
  const accessoryGroupHeader = row(37, {
    0: "Pur no",
    1: "Remark",
    2: "Stock status",
    3: "Pur Date",
    4: "Supplier",
    5: "Category",
    6: "S/N",
    7: "Model No",
    8: "Warranty",
    9: "Brand",
    10: "Model",
    11: "Specs",
    12: "Opening Inv Jul'2026",
    15: "Pur of Jul'2026",
    18: "Cost of Sales",
    24: "Closing Inv (31.07.2026)",
    27: "Stock Status",
  });
  const pcPartsGroupHeader = row(34, {
    0: "Pur no",
    1: "Remark",
    3: "Pur Date",
    4: "SN",
    5: "Pur No of PC Set up",
    6: "Supplier",
    7: "Category",
    8: "Brand",
    9: "Description",
    10: "JIB",
    11: "APD",
    12: "Opening Inv Jul'2026",
    15: "Pur of Jul'2026",
    18: "Cost of Sales",
    24: "Closing Inv (31.07.2026)",
    27: "Stock Status",
  });
  const inventorySubheader = row(37, {
    12: "Qty",
    13: "Pur Cost",
    14: "Amt",
    15: "Qty",
    16: "Pur Cost",
    17: "Amount",
    24: "Qty",
    25: "Pur Cost",
    26: "Amount",
  });

  values.Accessories[5] = accessoryGroupHeader;
  values.Accessories.splice(6, 0, inventorySubheader);
  values["PC Parts"][5] = pcPartsGroupHeader;
  values["PC Parts"].splice(6, 0, inventorySubheader.slice(0, 34));
  return values;
}

describe("production Google Sheets parser", () => {
  it("parses all production tabs and groups repeated model rows", () => {
    const result = parseProductionSheets(productionValues());

    expect(result.products).toHaveLength(3);
    expect(result.summary.sourceRows).toBe(5);
    expect(result.skippedRows).toEqual([]);

    const laptop = result.products.find(
      (product) => product.sourceSheet === "Laptops"
    );
    expect(laptop).toMatchObject({
      name: "HP ProBook 640 G8",
      type: "laptop",
      category: "Laptop",
      brand: "HP",
      price: 1_200,
      stock: "In Stock",
      stockQuantity: 3,
      image: "/products/production-placeholder.svg",
    });
    expect(laptop?.sourceRows).toEqual([9, 10]);
    expect(laptop?.specs).toMatchObject({
      cpu: "Intel Core i5-1145G7",
      ram: "16 GB DDR4",
      storage: "512 GB NVMe SSD",
      display: "14 inch FHD display",
    });

    const accessory = result.products.find(
      (product) => product.sourceSheet === "Accessories"
    );
    expect(accessory).toMatchObject({
      name: "Samsung Odyssey OLED G8",
      price: 32_500,
      stockQuantity: 1,
      stock: "In Stock",
    });

    const pcPart = result.products.find(
      (product) => product.sourceSheet === "PC Parts"
    );
    expect(pcPart).toMatchObject({
      name: "ZOTAC Gaming GeForce RTX 5090",
      price: 70_000,
      stockQuantity: 1,
      type: "accessory",
    });
  });

  it("skips named rows that have no usable price", () => {
    const values = productionValues();
    values.Laptops.push(
      row(17, {
        0: "S6",
        4: "Acer",
        5: "NX.TEST",
        6: "Acer Test Laptop",
        8: 1,
      })
    );

    const result = parseProductionSheets(values);

    expect(result.products).toHaveLength(3);
    expect(result.skippedRows).toContainEqual({
      sheet: "Laptops",
      rowNumber: 11,
      reason: "missing or invalid Pur Cost",
    });
  });

  it("parses the live workbook's grouped inventory headers", () => {
    const result = parseProductionSheets(
      useGroupedInventoryHeaders(productionValues())
    );

    expect(result.products).toHaveLength(3);
    expect(result.quantityColumns).toMatchObject({
      Laptops: 8,
      Accessories: 24,
      "PC Parts": 24,
    });
    expect(
      result.products.find((product) => product.sourceSheet === "Accessories")
    ).toMatchObject({ price: 32_500, stockQuantity: 1 });
    expect(
      result.products.find((product) => product.sourceSheet === "PC Parts")
    ).toMatchObject({ price: 70_000, stockQuantity: 1 });
  });

  it("fails closed when a production structural header is renamed", () => {
    const values = productionValues();
    values.Accessories[5][24] = "Inventory Remaining";

    expect(() => parseProductionSheets(values)).toThrow(
      'Accessories: required column "Closing Qty" is missing.'
    );
  });
});
