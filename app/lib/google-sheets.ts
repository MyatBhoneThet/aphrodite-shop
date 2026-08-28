import { createHash, createSign } from "crypto";
import type { Product, ProductType } from "../data/products";
import { badRequest } from "./errors";

type SheetsValueRange = {
  range?: string;
  values?: unknown[][];
};

type SheetsBatchGetResponse = {
  valueRanges?: SheetsValueRange[];
};

export type ProductionSheetName = "Laptops" | "Accessories" | "PC Parts";

export type ProductSheetRow = Omit<Product, "id"> & {
  rowNumber: number;
  sourceKey: string;
  sourceSheet: ProductionSheetName;
  sourceRows: number[];
  /** Per-source-row inventory, used to write order deductions back to the
   *  workbook's quantity cells. */
  rowQuantities: { row: number; quantity: number }[];
};

export type ProductionSkippedRow = {
  sheet: ProductionSheetName;
  rowNumber: number;
  reason: string;
};

export type ProductionSheetsValues = Record<ProductionSheetName, unknown[][]>;

const tokenUrl = "https://oauth2.googleapis.com/token";
// Read-write: checkout writes the reduced quantity back to the workbook.
const sheetsScope = "https://www.googleapis.com/auth/spreadsheets";
const DEFAULT_PRODUCTION_SPREADSHEET_ID =
  "1bQ3SVyRh5CD20JKCX-YWv0M30NdpTCafIfoDEI8NlN4";
// The production workbook spans several thousand inventory rows across three
// tabs, so allow enough time for one authenticated batch response.
const GOOGLE_API_TIMEOUT_MS = 30_000;
const DEFAULT_PRODUCT_IMAGE = "/products/production-placeholder.svg";

const productionRanges = [
  { sheet: "Laptops", range: "'Laptops'!A:Q" },
  { sheet: "Accessories", range: "'Accessories'!A:AK" },
  { sheet: "PC Parts", range: "'PC Parts'!A:AH" },
] as const satisfies readonly {
  sheet: ProductionSheetName;
  range: string;
}[];

function base64url(value: string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function getGoogleSheetsConfig() {
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.GOOGLE_SHEETS_PRIVATE_KEY);
  const spreadsheetId =
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() ||
    DEFAULT_PRODUCTION_SPREADSHEET_ID;

  if (!clientEmail || !privateKey) {
    throw badRequest("Google Sheets sync is not configured.");
  }

  return { clientEmail, privateKey, spreadsheetId };
}

function normalizePrivateKey(value?: string) {
  if (!value) return undefined;

  const trimmed = value.trim();
  const withoutOuterQuotes =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ? trimmed.slice(1, -1)
      : trimmed;
  const privateKey = withoutOuterQuotes.replace(/\\n/g, "\n");

  if (!privateKey.includes("-----BEGIN PRIVATE KEY-----")) {
    throw badRequest(
      "GOOGLE_SHEETS_PRIVATE_KEY must be a service-account PEM private key."
    );
  }

  return privateKey;
}

function signJwt({
  clientEmail,
  privateKey,
}: {
  clientEmail: string;
  privateKey: string;
}) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: clientEmail,
      scope: sheetsScope,
      aud: tokenUrl,
      iat: now,
      exp: now + 3600,
    })
  );
  const input = `${header}.${payload}`;
  const signature = createSign("RSA-SHA256").update(input).sign(privateKey);
  const encodedSignature = signature
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${input}.${encodedSignature}`;
}

async function getAccessToken() {
  const config = getGoogleSheetsConfig();
  const assertion = signJwt(config);
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(GOOGLE_API_TIMEOUT_MS),
  });

  if (!response.ok) {
    console.error("[google-sheets] token exchange failed", {
      status: response.status,
    });
    throw badRequest(
      "Unable to authenticate with Google Sheets. Check the service account configuration."
    );
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/\u200b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHeader(value: unknown) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value) : undefined;
  }

  const text = cleanText(value);
  if (!text || /^[-–—]$/.test(text)) return undefined;

  const numberValue = Number(text.replace(/,/g, ""));
  return Number.isFinite(numberValue) ? Math.round(numberValue) : undefined;
}

function parsePrice(value: unknown) {
  const price = parseNumber(value);
  return price !== undefined && price > 0 ? price : undefined;
}

function parseQuantity(value: unknown) {
  return Math.max(0, parseNumber(value) ?? 0);
}

function findHeaderRow(
  values: unknown[][],
  sheet: ProductionSheetName,
  requiredHeaders: string[]
) {
  const searchLimit = Math.min(values.length, 20);

  for (let index = 0; index < searchLimit; index += 1) {
    const headers = (values[index] ?? []).map(normalizeHeader);
    if (requiredHeaders.every((header) => headers.includes(header))) {
      return { headers, index };
    }
  }

  throw badRequest(
    `${sheet}: unable to find the expected production header row (${requiredHeaders.join(
      ", "
    )}).`
  );
}

function requireColumn(
  headers: string[],
  sheet: ProductionSheetName,
  header: string
) {
  const index = headers.indexOf(header);
  if (index === -1) {
    throw badRequest(`${sheet}: required column "${header}" is missing.`);
  }
  return index;
}

function requireOneOfColumns(
  headers: string[],
  sheet: ProductionSheetName,
  aliases: string[],
  label: string
) {
  const index = headers.findIndex((header) => aliases.includes(header));
  if (index === -1) {
    throw badRequest(`${sheet}: required column "${label}" is missing.`);
  }
  return index;
}

function createSourceKey(sheet: ProductionSheetName, identity: string[]) {
  const normalizedIdentity = identity
    .map((part) => cleanText(part).toLowerCase())
    .join("\u001f");
  const digest = createHash("sha256")
    .update(normalizedIdentity)
    .digest("hex")
    .slice(0, 24);
  const sheetSlug = sheet.toLowerCase().replace(/\s+/g, "-");

  return `production:${sheetSlug}:${digest}`;
}

function findSpecPart(parts: string[], pattern: RegExp) {
  return parts.find((part) => pattern.test(part));
}

function laptopSpecifications(detail: string, warranty: string) {
  const parts = detail
    .split("•")
    .map((part) => cleanText(part))
    .filter(Boolean);
  const cpu = findSpecPart(parts, /\b(intel|amd|apple|ryzen|core)\b/i);
  const ram = findSpecPart(parts, /\b(ram|memory|ddr\d*)\b/i);
  const storage = findSpecPart(parts, /\b(ssd|hdd|nvme|storage)\b/i);
  const display = findSpecPart(parts, /\b(display|screen|inch|fhd|qhd|uhd|oled)\b/i);
  const graphics = findSpecPart(parts, /\b(graphics|gpu|geforce|radeon|iris)\b/i);

  return {
    specs: {
      ...(cpu ? { cpu } : {}),
      ...(ram ? { ram } : {}),
      ...(storage ? { storage } : {}),
      ...(display ? { display } : {}),
      ...(detail ? { detail } : {}),
    },
    fullSpecs: {
      ...(cpu ? { processor: cpu } : {}),
      ...(ram ? { ram } : {}),
      ...(storage ? { storage } : {}),
      ...(display ? { display } : {}),
      ...(graphics ? { graphics } : {}),
      ...(warranty ? { warranty } : {}),
      ...(detail ? { detail } : {}),
    },
  } satisfies Pick<Product, "specs" | "fullSpecs">;
}

function detailSpecifications(detail: string, warranty = "") {
  return {
    specs: detail ? { detail } : {},
    fullSpecs: {
      ...(warranty ? { warranty } : {}),
      ...(detail ? { detail } : {}),
    },
  } satisfies Pick<Product, "specs" | "fullSpecs">;
}

function productRow({
  rowNumber,
  sourceKey,
  sourceSheet,
  name,
  type,
  category,
  brand,
  price,
  stockQuantity,
  specs,
  fullSpecs,
}: {
  rowNumber: number;
  sourceKey: string;
  sourceSheet: ProductionSheetName;
  name: string;
  type: ProductType;
  category: string;
  brand: string;
  price: number;
  stockQuantity: number;
  specs: Product["specs"];
  fullSpecs: Product["fullSpecs"];
}): ProductSheetRow {
  return {
    rowNumber,
    sourceRows: [rowNumber],
    rowQuantities: [{ row: rowNumber, quantity: stockQuantity }],
    sourceKey,
    sourceSheet,
    name,
    type,
    category,
    brand,
    price,
    image: DEFAULT_PRODUCT_IMAGE,
    stock: stockQuantity > 0 ? "In Stock" : "Out of Stock",
    stockQuantity,
    specs,
    fullSpecs,
  };
}

function addSkippedRow(
  skippedRows: ProductionSkippedRow[],
  sheet: ProductionSheetName,
  rowNumber: number,
  reason: string
) {
  skippedRows.push({ sheet, rowNumber, reason });
}

function parseLaptops(values: unknown[][], skippedRows: ProductionSkippedRow[]) {
  const sheet: ProductionSheetName = "Laptops";
  const { headers, index: headerIndex } = findHeaderRow(values, sheet, [
    "pur_no",
    "brand",
    "model",
    "qty",
  ]);
  const brandIndex = requireColumn(headers, sheet, "brand");
  const modelNumberIndex = requireColumn(headers, sheet, "model_no");
  const modelIndex = requireColumn(headers, sheet, "model");
  const specsIndex = requireColumn(headers, sheet, "specs_detail");
  const warrantyIndex = requireColumn(headers, sheet, "warranty");
  const quantityIndex = requireColumn(headers, sheet, "qty");
  const priceIndex = requireOneOfColumns(
    headers,
    sheet,
    ["pur_cost", "price"],
    "Pur Cost"
  );
  const products: ProductSheetRow[] = [];

  values.slice(headerIndex + 1).forEach((cells, offset) => {
    const rowNumber = headerIndex + offset + 2;
    const name = cleanText(cells[modelIndex]) || cleanText(cells[modelNumberIndex]);

    if (!name) return;

    const price = parsePrice(cells[priceIndex]);
    if (price === undefined) {
      addSkippedRow(
        skippedRows,
        sheet,
        rowNumber,
        "missing or invalid Pur Cost"
      );
      return;
    }

    const brand = cleanText(cells[brandIndex]) || "Unknown";
    const modelNumber = cleanText(cells[modelNumberIndex]);
    const detail = cleanText(cells[specsIndex]);
    const warranty = cleanText(cells[warrantyIndex]);
    const stockQuantity = parseQuantity(cells[quantityIndex]);
    const { specs, fullSpecs } = laptopSpecifications(detail, warranty);

    products.push(
      productRow({
        rowNumber,
        sourceKey: createSourceKey(sheet, [brand, modelNumber || name]),
        sourceSheet: sheet,
        name,
        type: "laptop",
        category: "Laptop",
        brand,
        price,
        stockQuantity,
        specs,
        fullSpecs,
      })
    );
  });

  return { products, quantityColumnIndex: quantityIndex };
}

function parseInventorySheet(
  values: unknown[][],
  sheet: "Accessories" | "PC Parts",
  skippedRows: ProductionSkippedRow[]
) {
  const requiredHeaders =
    sheet === "Accessories"
      ? ["pur_no", "category", "brand", "model"]
      : ["pur_no", "category", "brand", "description"];
  const { headers, index: headerIndex } = findHeaderRow(
    values,
    sheet,
    requiredHeaders
  );
  const categoryIndex = requireColumn(headers, sheet, "category");
  const brandIndex = requireColumn(headers, sheet, "brand");
  const nameIndex = requireColumn(
    headers,
    sheet,
    sheet === "Accessories" ? "model" : "description"
  );
  const modelNumberIndex =
    sheet === "Accessories"
      ? requireColumn(headers, sheet, "model_no")
      : undefined;
  const specsIndex =
    sheet === "Accessories" ? requireColumn(headers, sheet, "specs") : undefined;
  const warrantyIndex =
    sheet === "Accessories" ? requireColumn(headers, sheet, "warranty") : undefined;
  const openingCostIndex = requireOneOfColumns(
    headers,
    sheet,
    ["openingpur_cost", "openingunit_cost", "opening_pur_cost", "opening_unit_cost"],
    "Opening Pur/Unit Cost"
  );
  const purchaseCostIndex = requireOneOfColumns(
    headers,
    sheet,
    ["purchaseunit_cost", "purchase_unit_cost"],
    "Purchase Unit Cost"
  );
  const closingQuantityIndex = requireOneOfColumns(
    headers,
    sheet,
    ["closingqty", "closing_qty"],
    "Closing Qty"
  );
  const closingCostIndex = requireOneOfColumns(
    headers,
    sheet,
    ["closingunit_cost", "closing_unit_cost"],
    "Closing Unit Cost"
  );
  const products: ProductSheetRow[] = [];

  // The real production workbook uses one flattened header row. Summary and
  // spacer rows below it are ignored because they do not contain a name.
  values.slice(headerIndex + 1).forEach((cells, offset) => {
    const rowNumber = headerIndex + offset + 2;
    const name = cleanText(cells[nameIndex]);

    if (!name) return;

    const closingUnitCost = parsePrice(cells[closingCostIndex]);
    const purchaseUnitCost = parsePrice(cells[purchaseCostIndex]);
    const openingUnitCost = parsePrice(cells[openingCostIndex]);
    const price = closingUnitCost ?? purchaseUnitCost ?? openingUnitCost;

    if (price === undefined) {
      addSkippedRow(
        skippedRows,
        sheet,
        rowNumber,
        "missing or invalid inventory unit cost"
      );
      return;
    }

    const brand = cleanText(cells[brandIndex]) || "Unknown";
    const category = cleanText(cells[categoryIndex]) || sheet;
    const modelNumber =
      modelNumberIndex === undefined ? "" : cleanText(cells[modelNumberIndex]);
    const detail =
      specsIndex === undefined
        ? name
        : cleanText(cells[specsIndex]) || name;
    const warranty =
      warrantyIndex === undefined ? "" : cleanText(cells[warrantyIndex]);
    const stockQuantity = parseQuantity(cells[closingQuantityIndex]);
    const { specs, fullSpecs } = detailSpecifications(detail, warranty);

    products.push(
      productRow({
        rowNumber,
        sourceKey: createSourceKey(sheet, [
          brand,
          category,
          modelNumber || name,
        ]),
        sourceSheet: sheet,
        name,
        type: "accessory",
        category,
        brand,
        price,
        stockQuantity,
        specs,
        fullSpecs,
      })
    );
  });

  return { products, quantityColumnIndex: closingQuantityIndex };
}

function mergeProductRows(rows: ProductSheetRow[]) {
  const products = new Map<string, ProductSheetRow>();

  for (const row of rows) {
    const current = products.get(row.sourceKey);

    if (!current) {
      products.set(row.sourceKey, { ...row });
      continue;
    }

    current.sourceRows.push(...row.sourceRows);
    current.rowQuantities.push(...row.rowQuantities);
    current.stockQuantity =
      (current.stockQuantity ?? 0) + (row.stockQuantity ?? 0);
    current.stock = current.stockQuantity > 0 ? "In Stock" : "Out of Stock";
    current.price = Math.max(current.price, row.price);

    if ((row.specs.detail?.length ?? 0) > (current.specs.detail?.length ?? 0)) {
      current.specs = row.specs;
      current.fullSpecs = row.fullSpecs;
    }
  }

  return [...products.values()].sort((left, right) =>
    left.sourceKey.localeCompare(right.sourceKey)
  );
}

export function parseProductionSheets(values: ProductionSheetsValues) {
  const skippedRows: ProductionSkippedRow[] = [];
  const laptops = parseLaptops(values.Laptops, skippedRows);
  const accessories = parseInventorySheet(
    values.Accessories,
    "Accessories",
    skippedRows
  );
  const pcParts = parseInventorySheet(values["PC Parts"], "PC Parts", skippedRows);
  const sourceProducts = [
    ...laptops.products,
    ...accessories.products,
    ...pcParts.products,
  ];
  const quantityColumns: Record<ProductionSheetName, number> = {
    Laptops: laptops.quantityColumnIndex,
    Accessories: accessories.quantityColumnIndex,
    "PC Parts": pcParts.quantityColumnIndex,
  };
  const products = mergeProductRows(sourceProducts);
  const unknownBrandCount = products.filter(
    (product) => product.brand === "Unknown"
  ).length;
  const warnings = [
    "Storefront price is sourced from production Pur Cost/Unit Cost because the workbook has no separate retail-price column.",
    "Products without image data use the production placeholder; later manual image edits are preserved by sync.",
    ...(unknownBrandCount
      ? [`${unknownBrandCount} products have no production brand and use \"Unknown\".`]
      : []),
  ];

  return {
    products,
    skippedRows,
    warnings,
    quantityColumns,
    summary: {
      sourceRows: sourceProducts.length,
      products: products.length,
      skippedRows: skippedRows.length,
      bySheet: productionRanges.map(({ sheet }) => ({
        sheet,
        products: products.filter((product) => product.sourceSheet === sheet)
          .length,
      })),
    },
  };
}

function sheetNameFromRange(range: string | undefined) {
  return cleanText(range?.split("!")[0]).replace(/^'|'$/g, "");
}

export async function fetchProductsSheet() {
  const { spreadsheetId } = getGoogleSheetsConfig();
  const accessToken = await getAccessToken();
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet`
  );

  for (const { range } of productionRanges) {
    url.searchParams.append("ranges", range);
  }
  url.searchParams.set("majorDimension", "ROWS");
  url.searchParams.set("valueRenderOption", "UNFORMATTED_VALUE");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(GOOGLE_API_TIMEOUT_MS),
  });

  if (!response.ok) {
    console.error("[google-sheets] production sheet fetch failed", {
      status: response.status,
    });
    throw badRequest(
      "Unable to read the production Google Sheet. Check the spreadsheet ID, tab names, and sharing settings."
    );
  }

  const data = (await response.json()) as SheetsBatchGetResponse;
  const valuesBySheet = new Map(
    (data.valueRanges ?? []).map((valueRange) => [
      sheetNameFromRange(valueRange.range),
      valueRange.values ?? [],
    ])
  );
  const values = {} as ProductionSheetsValues;

  for (const { sheet } of productionRanges) {
    const sheetValues = valuesBySheet.get(sheet);
    if (!sheetValues) {
      throw badRequest(`The production workbook is missing the "${sheet}" tab.`);
    }
    values[sheet] = sheetValues;
  }

  return parseProductionSheets(values);
}

export function hasGoogleSheetsConfig() {
  return Boolean(
    process.env.GOOGLE_SHEETS_CLIENT_EMAIL &&
      process.env.GOOGLE_SHEETS_PRIVATE_KEY
  );
}

function columnLetter(index: number) {
  let letters = "";
  for (let i = index; i >= 0; i = Math.floor(i / 26) - 1) {
    letters = String.fromCharCode(65 + (i % 26)) + letters;
  }
  return letters;
}

export type SheetQuantityUpdate = {
  sourceKey: string;
  sheet: ProductionSheetName;
  cells: { row: number; from: number; to: number }[];
  /** Units that could not be deducted because the workbook rows held less
   *  stock than the storefront sold (workbook was already behind). */
  shortfall: number;
  /** The product's workbook total after this write. Callers persist it as the
   *  new sync baseline so the next import does not re-apply the deduction. */
  sheetQuantityAfter: number;
};

/**
 * Deducts ordered units from the workbook's quantity cells (Laptops "Qty",
 * Accessories/PC Parts "ClosingQty"). Rows are re-read at call time so the
 * deduction applies to the workbook's current numbers, walking a product's
 * source rows top-down until the ordered quantity is covered.
 *
 * Callers treat this as best-effort: the database transaction has already
 * committed, so a failure here must never fail the order.
 */
export async function decrementSheetQuantities(
  items: { sourceKey: string; quantity: number }[]
) {
  const wanted = items.filter((item) => item.quantity > 0);
  if (wanted.length === 0) return [];

  const { spreadsheetId } = getGoogleSheetsConfig();
  const { products, quantityColumns } = await fetchProductsSheet();
  const bySourceKey = new Map(
    products.map((product) => [product.sourceKey, product])
  );
  const updates: SheetQuantityUpdate[] = [];
  const data: { range: string; values: number[][] }[] = [];

  for (const item of wanted) {
    const product = bySourceKey.get(item.sourceKey);

    if (!product) {
      updates.push({
        sourceKey: item.sourceKey,
        sheet: "Laptops",
        cells: [],
        shortfall: item.quantity,
        sheetQuantityAfter: 0,
      });
      continue;
    }

    const column = columnLetter(quantityColumns[product.sourceSheet]);
    const cells: SheetQuantityUpdate["cells"] = [];
    let remaining = item.quantity;

    for (const rowQuantity of product.rowQuantities) {
      if (remaining <= 0) break;

      const deduction = Math.min(rowQuantity.quantity, remaining);
      if (deduction <= 0) continue;

      remaining -= deduction;
      cells.push({
        row: rowQuantity.row,
        from: rowQuantity.quantity,
        to: rowQuantity.quantity - deduction,
      });
      data.push({
        range: `'${product.sourceSheet}'!${column}${rowQuantity.row}`,
        values: [[rowQuantity.quantity - deduction]],
      });
    }

    updates.push({
      sourceKey: item.sourceKey,
      sheet: product.sourceSheet,
      cells,
      shortfall: remaining,
      sheetQuantityAfter: Math.max(
        0,
        (product.stockQuantity ?? 0) - (item.quantity - remaining)
      ),
    });
  }

  if (data.length > 0) {
    const accessToken = await getAccessToken();
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ valueInputOption: "RAW", data }),
        cache: "no-store",
        signal: AbortSignal.timeout(GOOGLE_API_TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      console.error("[google-sheets] quantity write-back failed", {
        status: response.status,
      });
      throw badRequest(
        "Unable to write order quantities back to the production Google Sheet."
      );
    }
  }

  return updates;
}
