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
  /** Undefined = legacy sheet: preserve tiers. Null = explicitly not enabled. */
  sheetWholesale?: { unitPrice: number; minQuantity: number } | null;
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
  { sheet: "Laptops", range: "'Laptops'!A:AZ" },
  { sheet: "Accessories", range: "'Accessories'!A:AZ" },
  { sheet: "PC Parts", range: "'PC Parts'!A:AZ" },
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

import { normalizeGallery, sheetGallery } from "./product-gallery";

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

function requireInventoryColumn({
  values,
  headerIndex,
  headers,
  sheet,
  directAliases,
  groupPrefixes,
  subheaderAliases,
  label,
}: {
  values: unknown[][];
  headerIndex: number;
  headers: string[];
  sheet: "Accessories" | "PC Parts";
  directAliases: string[];
  groupPrefixes: string[];
  subheaderAliases: string[];
  label: string;
}) {
  const directIndex = headers.findIndex((header) =>
    directAliases.includes(header)
  );
  if (directIndex !== -1) return directIndex;

  const groupIndex = headers.findIndex((header) =>
    groupPrefixes.some(
      (prefix) => header === prefix || header.startsWith(`${prefix}_`)
    )
  );
  const subheaders = (values[headerIndex + 1] ?? []).map(normalizeHeader);
  const nextGroupIndex = headers.findIndex(
    (header, index) => index > groupIndex && Boolean(header)
  );
  const groupEnd = nextGroupIndex === -1 ? subheaders.length : nextGroupIndex;
  const groupedIndex = subheaders.findIndex(
    (header, index) =>
      index >= groupIndex &&
      index < groupEnd &&
      subheaderAliases.includes(header)
  );

  if (groupIndex === -1 || groupedIndex === -1) {
    throw badRequest(`${sheet}: required column "${label}" is missing.`);
  }

  return groupedIndex;
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

export function readSheetWholesale(headers: string[], cells: unknown[], retail: number): ProductSheetRow["sheetWholesale"] {
  const index = headers.indexOf("wholesale_price_mmk");
  if (index < 0) return undefined;
  const price = parsePrice(cells[index]);
  const minimum = Number(cells[headers.indexOf("wholesale_min_qty")]);
  const status = cleanText(cells[headers.indexOf("wholesale_status")]).toLowerCase();
  if (status !== "enabled" || !price || retail <= 0 || price > retail || !Number.isInteger(price) || price > 2147483647 || !Number.isInteger(minimum) || minimum < 3 || minimum > 10000) return null;
  return { unitPrice: price, minQuantity: minimum };
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
  sheetWholesale,
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
  sheetWholesale?: ProductSheetRow["sheetWholesale"];
}): ProductSheetRow {
  return {
    rowNumber,
    sourceRows: [rowNumber],
    rowQuantities: [{ row: rowNumber, quantity: stockQuantity }],
    sourceKey,
    sourceSheet,
    sheetWholesale,
    name,
    type,
    category,
    brand,
    price,
    image: normalizeGallery(fullSpecs.gallery)[0]?.url ?? DEFAULT_PRODUCT_IMAGE,
    stock: stockQuantity > 0 ? "In Stock" : "Out of Stock",
    stockQuantity,
    specs,
    fullSpecs,
  };
}

function parseLaptops(values: unknown[][]) {
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
  const retailMmkIndex = requireColumn(headers, sheet, "retail_price_mmk");
  const rows: SheetSourceRow[] = [];

  values.slice(headerIndex + 1).forEach((cells, offset) => {
    const rowNumber = headerIndex + offset + 2;
    const name = cleanText(cells[modelIndex]) || cleanText(cells[modelNumberIndex]);

    if (!name) return;

    // An explicit MMK column is authoritative. Blank/invalid means awaiting
    // pricing, NOT fallback to placeholder costs and NOT a free product.
    const price = parsePrice(cells[retailMmkIndex]) ?? 0;

    const brand = cleanText(cells[brandIndex]) || "Unknown";
    const modelNumber = cleanText(cells[modelNumberIndex]);
    const detail = cleanText(cells[specsIndex]);
    const warranty = cleanText(cells[warrantyIndex]);
    const stockQuantity = parseQuantity(cells[quantityIndex]);
    const { specs, fullSpecs } = laptopSpecifications(detail, warranty);
    Object.assign(fullSpecs, { gallery: sheetGallery(headers, cells), photoSource: cleanText(cells[headers.indexOf("photo_source_url")]) });

    rows.push({
      spec: detail,
      product: productRow({
        rowNumber,
        sourceKey: createSourceKey(sheet, [brand, modelNumber || name]),
        sourceSheet: sheet,
        name,
        sheetWholesale: readSheetWholesale(headers, cells, price),
        type: "laptop",
        category: "Laptop",
        brand,
        price,
        stockQuantity,
        specs,
        fullSpecs,
      }),
    });
  });

  return { rows, quantityColumnIndex: quantityIndex };
}

function parseInventorySheet(
  values: unknown[][],
  sheet: "Accessories" | "PC Parts"
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
  const retailMmkIndex = requireColumn(headers, sheet, "retail_price_mmk");
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
  const closingQuantityIndex = requireInventoryColumn({
    values,
    headerIndex,
    headers,
    sheet,
    directAliases: ["closingqty", "closing_qty"],
    groupPrefixes: ["closing_inv", "closing_inventory"],
    subheaderAliases: ["qty", "quantity"],
    label: "Closing Qty",
  });
  const rows: SheetSourceRow[] = [];

  // The live workbook uses a dated group header followed by Qty/Pur Cost/Amt
  // subheaders. The legacy flattened layout remains supported. Header and
  // spacer rows are ignored because they do not contain a product name.
  values.slice(headerIndex + 1).forEach((cells, offset) => {
    const rowNumber = headerIndex + offset + 2;
    const name = cleanText(cells[nameIndex]);

    if (!name) return;

    const price = parsePrice(cells[retailMmkIndex]) ?? 0;

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
    Object.assign(fullSpecs, { gallery: sheetGallery(headers, cells), photoSource: cleanText(cells[headers.indexOf("photo_source_url")]) });

    rows.push({
      // PC Parts has no specs column: its description is the name, which is
      // already part of the product's identity.
      spec: specsIndex === undefined ? "" : cleanText(cells[specsIndex]),
      product: productRow({
        rowNumber,
        sourceKey: createSourceKey(sheet, [
          brand,
          category,
          modelNumber || name,
        ]),
        sourceSheet: sheet,
        name,
        sheetWholesale: readSheetWholesale(headers, cells, price),
        type: "accessory",
        category,
        brand,
        price,
        stockQuantity,
        specs,
        fullSpecs,
      }),
    });
  });

  return { rows, quantityColumnIndex: closingQuantityIndex };
}

/** One workbook row, with the raw specs text used to tell versions apart. */
type SheetSourceRow = { product: ProductSheetRow; spec: string };

export type SpecVariantGroup = {
  sheet: ProductionSheetName;
  name: string;
  versions: { label: string; quantity: number; rows: number[] }[];
};

const VARIANT_KEY_SEPARATOR = ":v-";

/** "16 GB RAM" and "16gb ram" are the same spec; spacing, case and bullets are ignored. */
function specFingerprint(spec: string) {
  return spec.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function specParts(spec: string) {
  return spec
    .split(/[•|;,\n]/)
    .map((part) => cleanText(part))
    .filter(Boolean);
}

/**
 * The key of the product a spec version was split from, or null when the key
 * is not a version. A new version copies that product's photos.
 */
export function specVariantBaseKey(sourceKey: string) {
  const index = sourceKey.indexOf(VARIANT_KEY_SEPARATOR);
  return index === -1 ? null : sourceKey.slice(0, index);
}

/**
 * Rows of the same model whose specs differ (e.g. 256 GB vs 512 GB SSD) become
 * separate products, so each version has its own stock and a sale of one never
 * deducts the other.
 *
 * - The version in the model's first row keeps the model's existing key, so
 *   the product already on the website (photos, wishlists, orders) stays
 *   attached to it. Other versions get a key derived from their specs.
 * - A row with blank specs is not a version of its own; it joins that first
 *   version, as it always did.
 * - Models whose rows all share one spec are untouched.
 */
function splitSpecVariants(sourceRows: SheetSourceRow[]) {
  const byModel = new Map<string, SheetSourceRow[]>();
  for (const row of sourceRows) {
    const list = byModel.get(row.product.sourceKey) ?? [];
    list.push(row);
    byModel.set(row.product.sourceKey, list);
  }

  const groups: SpecVariantGroup[] = [];

  for (const [baseKey, modelRows] of byModel) {
    const versions = new Map<string, SheetSourceRow[]>();
    for (const row of modelRows) {
      const fingerprint = specFingerprint(row.spec);
      if (!fingerprint) continue;
      versions.set(fingerprint, [...(versions.get(fingerprint) ?? []), row]);
    }
    if (versions.size < 2) continue;

    const blankRows = modelRows.filter((row) => !specFingerprint(row.spec));
    const entries = [...versions.entries()];
    entries[0][1].push(...blankRows);

    const partSets = entries.map(([, rows]) =>
      specParts(rows[0].spec).map((part) => ({ part, key: specFingerprint(part) }))
    );
    const model = modelRows[0].product;
    const group: SpecVariantGroup = { sheet: model.sourceSheet, name: model.name, versions: [] };
    // Shared by every version so the website can show them on one page. It is
    // public, so it is derived from -- never equal to -- the server-only key.
    const variantGroup = createHash("sha256")
      .update(`variant-group:${baseKey}`)
      .digest("hex")
      .slice(0, 16);

    entries.forEach(([fingerprint, rows], index) => {
      // Name each version by the parts the other versions do not share.
      const unique = partSets[index]
        .filter(({ key }) => !partSets.every((parts) => parts.some((other) => other.key === key)))
        .map(({ part }) => part)
        .join(" · ");
      const label = truncateLabel(unique || rows[0].spec);
      const sourceKey =
        index === 0
          ? baseKey
          : `${baseKey}${VARIANT_KEY_SEPARATOR}${createHash("sha256").update(fingerprint).digest("hex").slice(0, 12)}`;

      for (const row of rows) {
        row.product.sourceKey = sourceKey;
        row.product.name = `${row.product.name} (${label})`;
        row.product.fullSpecs = {
          ...row.product.fullSpecs,
          variant: { group: variantGroup, model: group.name, label },
        };
      }
      group.versions.push({
        label,
        quantity: rows.reduce((sum, row) => sum + (row.product.stockQuantity ?? 0), 0),
        rows: rows.map((row) => row.product.rowNumber).sort((a, b) => a - b),
      });
    });

    groups.push(group);
  }

  return groups;
}

function truncateLabel(label: string) {
  return label.length > 60 ? `${label.slice(0, 57).trim()}…` : label;
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
    // Conflicting duplicate-row terms are not silently combined into a deal.
    if (JSON.stringify(current.sheetWholesale) !== JSON.stringify(row.sheetWholesale)) current.sheetWholesale = null;

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
  const laptops = parseLaptops(values.Laptops);
  const accessories = parseInventorySheet(
    values.Accessories,
    "Accessories"
  );
  const pcParts = parseInventorySheet(values["PC Parts"], "PC Parts");
  const sourceRows = [...laptops.rows, ...accessories.rows, ...pcParts.rows];
  const specVariants = splitSpecVariants(sourceRows);
  const sourceProducts = sourceRows.map((row) => row.product);
  const quantityColumns: Record<ProductionSheetName, number> = {
    Laptops: laptops.quantityColumnIndex,
    Accessories: accessories.quantityColumnIndex,
    "PC Parts": pcParts.quantityColumnIndex,
  };
  const products = mergeProductRows(sourceProducts);
  const unknownBrandCount = products.filter(
    (product) => product.brand === "Unknown"
  ).length;
  const distinctPrices = new Set(products.map((product) => product.price));
  const pendingPrices = products.filter((product) => product.price <= 0).length;
  const warnings = [
    ...(pendingPrices ? [`${pendingPrices} products have no positive Retail Price MMK. They will show Price pending and cannot be purchased until priced.`] : []),
    "Products without image data use the production placeholder; later manual image edits are preserved by sync.",
    ...(unknownBrandCount
      ? [`${unknownBrandCount} products have no production brand and use \"Unknown\".`]
      : []),
    ...specVariants.map(
      (group) =>
        `${group.name} (${group.sheet}) has ${group.versions.length} versions with different specs, shown on one page with version buttons and separate stock: ${group.versions
          .map((version) => `${version.label} = ${version.quantity} in stock (rows ${version.rows.join(", ")})`)
          .join("; ")}. If they are the same laptop, make the specs text match in the sheet.`
    ),
    ...(products.length > 10 && distinctPrices.size === 1
      ? [
          `All ${products.length} imported products currently use the same workbook price (${products[0]?.price.toLocaleString()}). Confirm that this is intentional before syncing.`,
        ]
      : []),
  ];

  return {
    products,
    skippedRows,
    warnings,
    specVariants,
    quantityColumns,
    summary: {
      sourceRows: sourceProducts.length,
      products: products.length,
      skippedRows: skippedRows.length,
      bySheet: productionRanges.map(({ sheet }) => ({
        sheet,
        products: products.filter((product) => product.sourceSheet === sheet)
          .length,
        priced: products.filter(product => product.sourceSheet === sheet && product.price > 0).length,
        pendingPrices: products.filter(product => product.sourceSheet === sheet && product.price <= 0).length,
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

  await writeQuantityCells(
    spreadsheetId,
    data,
    "Unable to write order quantities back to the production Google Sheet."
  );

  return updates;
}

/** Writes quantity cells in one batch. Shared by deduction and restock. */
async function writeQuantityCells(
  spreadsheetId: string,
  data: { range: string; values: number[][] }[],
  failureMessage: string
) {
  if (data.length === 0) return;

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
    throw badRequest(failureMessage);
  }
}

// ---------------------------------------------------------------------------
// Restocking a cancelled order
// ---------------------------------------------------------------------------

/** Units to put back for one product, optionally naming the rows they came from. */
export type SheetRestockItem = {
  sourceKey: string;
  quantity: number;
  rows?: { row: number; quantity: number }[];
};

export type SheetDeductionRecord = { items: SheetRestockItem[] };

/**
 * What a checkout actually removed from the workbook, per product and row.
 * Stored in the audit log so a cancellation can put back exactly those units
 * -- and nothing, if the deduction never reached the sheet.
 */
export function sheetDeductionRecord(
  updates: SheetQuantityUpdate[]
): SheetDeductionRecord {
  return {
    items: updates
      .filter((update) => update.cells.length > 0)
      .map((update) => {
        const rows = update.cells.map((cell) => ({
          row: cell.row,
          quantity: cell.from - cell.to,
        }));
        return {
          sourceKey: update.sourceKey,
          quantity: rows.reduce((sum, row) => sum + row.quantity, 0),
          rows,
        };
      })
      .filter((item) => item.quantity > 0),
  };
}

/** Reads a stored deduction record back, dropping anything malformed. */
export function readSheetDeductionRecord(value: unknown): SheetRestockItem[] {
  const items = (value as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return [];

  return items.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const { sourceKey, quantity, rows } = item as Record<string, unknown>;

    if (
      typeof sourceKey !== "string" ||
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      return [];
    }

    const safeRows = Array.isArray(rows)
      ? rows.flatMap((entry) => {
          const row = (entry ?? {}) as Record<string, unknown>;
          return typeof row.row === "number" &&
            Number.isInteger(row.row) &&
            typeof row.quantity === "number" &&
            Number.isInteger(row.quantity) &&
            row.quantity > 0
            ? [{ row: row.row, quantity: row.quantity }]
            : [];
        })
      : undefined;

    return [{ sourceKey, quantity, rows: safeRows }];
  });
}

/**
 * Decides which cells receive restored units: first the rows the units were
 * taken from (while they still belong to the product), then any remainder on
 * the product's first row. Pure, so it can be tested without Google.
 */
export function planSheetRestock(
  currentRows: { row: number; quantity: number }[],
  quantity: number,
  preferredRows: { row: number; quantity: number }[] = []
) {
  const additions = new Map<number, number>();
  const knownRows = new Set(currentRows.map((row) => row.row));
  let remaining = Math.max(0, Math.floor(quantity));

  for (const preferred of preferredRows) {
    if (remaining <= 0) break;
    // The sheet may have been edited since checkout; never write to a row that
    // no longer belongs to this product.
    if (!knownRows.has(preferred.row)) continue;

    const amount = Math.min(preferred.quantity, remaining);
    if (amount <= 0) continue;

    additions.set(preferred.row, (additions.get(preferred.row) ?? 0) + amount);
    remaining -= amount;
  }

  if (remaining > 0 && currentRows.length > 0) {
    const firstRow = currentRows[0].row;
    additions.set(firstRow, (additions.get(firstRow) ?? 0) + remaining);
    remaining = 0;
  }

  const cells = currentRows.flatMap((row) => {
    const added = additions.get(row.row);
    return added
      ? [{ row: row.row, from: row.quantity, to: row.quantity + added }]
      : [];
  });

  return { cells, unrestored: remaining };
}

/**
 * Adds a cancelled order's units back to the workbook's quantity cells.
 *
 * Rows are re-read at call time so the addition applies to the sheet's current
 * numbers. In the returned updates, `shortfall` is the units that could NOT be
 * put back (the product is no longer in the sheet).
 *
 * Callers treat this as best-effort: the cancellation has already committed.
 */
export async function incrementSheetQuantities(items: SheetRestockItem[]) {
  // One entry per product, so two cells are never planned from the same
  // stale snapshot.
  const grouped = new Map<string, SheetRestockItem>();
  for (const item of items) {
    if (item.quantity <= 0) continue;
    const current = grouped.get(item.sourceKey);
    grouped.set(
      item.sourceKey,
      current
        ? {
            sourceKey: item.sourceKey,
            quantity: current.quantity + item.quantity,
            rows: [...(current.rows ?? []), ...(item.rows ?? [])],
          }
        : { ...item }
    );
  }

  if (grouped.size === 0) return [];

  const { spreadsheetId } = getGoogleSheetsConfig();
  const { products, quantityColumns } = await fetchProductsSheet();
  const bySourceKey = new Map(
    products.map((product) => [product.sourceKey, product])
  );
  const updates: SheetQuantityUpdate[] = [];
  const data: { range: string; values: number[][] }[] = [];

  for (const item of grouped.values()) {
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
    const { cells, unrestored } = planSheetRestock(
      product.rowQuantities,
      item.quantity,
      item.rows
    );

    for (const cell of cells) {
      data.push({
        range: `'${product.sourceSheet}'!${column}${cell.row}`,
        values: [[cell.to]],
      });
    }

    updates.push({
      sourceKey: item.sourceKey,
      sheet: product.sourceSheet,
      cells,
      shortfall: unrestored,
      sheetQuantityAfter:
        (product.stockQuantity ?? 0) + (item.quantity - unrestored),
    });
  }

  await writeQuantityCells(
    spreadsheetId,
    data,
    "Unable to add cancelled order quantities back to the production Google Sheet."
  );

  return updates;
}

// ---------------------------------------------------------------------------
// Admin sets a product's stock quantity
// ---------------------------------------------------------------------------

/**
 * Changes a product's rows so they add up to `target`. Units added go on the
 * first row (like a restock); units removed come off rows top-down (like a
 * sale). Only cells that change are returned. Pure, so it can be tested
 * without Google.
 */
export function planSheetQuantitySet(
  currentRows: { row: number; quantity: number }[],
  target: number
) {
  const wanted = Math.max(0, Math.floor(target));
  const total = currentRows.reduce((sum, row) => sum + Math.max(0, row.quantity), 0);
  const cells: { row: number; from: number; to: number }[] = [];

  if (currentRows.length === 0 || wanted === total) return { cells, total };

  if (wanted > total) {
    const first = currentRows[0];
    cells.push({
      row: first.row,
      from: first.quantity,
      to: Math.max(0, first.quantity) + (wanted - total),
    });
    return { cells, total };
  }

  let remaining = total - wanted;
  for (const row of currentRows) {
    if (remaining <= 0) break;
    const removal = Math.min(Math.max(0, row.quantity), remaining);
    if (removal <= 0) continue;
    remaining -= removal;
    cells.push({ row: row.row, from: row.quantity, to: row.quantity - removal });
  }

  return { cells, total };
}

export type SheetQuantitySetResult =
  | { status: "not_in_sheet" }
  | {
      status: "updated";
      sheet: ProductionSheetName;
      cells: { row: number; from: number; to: number }[];
      /** The product's sheet total before the write (may include unsynced edits). */
      sheetQuantityBefore: number;
      sheetQuantityAfter: number;
    };

/**
 * Makes a product's quantity cells in the workbook add up to exactly the
 * number the admin entered. Rows are re-read at call time. Unlike the order
 * write-backs this is NOT best-effort: it throws when the write fails, so the
 * caller can refuse to save a stock number the sheet does not have (the next
 * sync would undo it).
 */
export async function setSheetProductQuantity(
  sourceKey: string,
  target: number
): Promise<SheetQuantitySetResult> {
  const { spreadsheetId } = getGoogleSheetsConfig();
  const { products, quantityColumns } = await fetchProductsSheet();
  const product = products.find((item) => item.sourceKey === sourceKey);

  if (!product) return { status: "not_in_sheet" };

  const column = columnLetter(quantityColumns[product.sourceSheet]);
  const { cells, total } = planSheetQuantitySet(product.rowQuantities, target);

  await writeQuantityCells(
    spreadsheetId,
    cells.map((cell) => ({
      range: `'${product.sourceSheet}'!${column}${cell.row}`,
      values: [[cell.to]],
    })),
    "Unable to write the new stock quantity to the production Google Sheet."
  );

  return {
    status: "updated",
    sheet: product.sourceSheet,
    cells,
    sheetQuantityBefore: total,
    sheetQuantityAfter: Math.max(0, Math.floor(target)),
  };
}
