import { createSign } from "crypto";
import type { Product, ProductType } from "../data/products";
import { badRequest } from "./errors";

type SheetsValuesResponse = {
  values?: unknown[][];
};

export type ProductSheetRow = Partial<Product> & {
  rowNumber: number;
};

const tokenUrl = "https://oauth2.googleapis.com/token";
const sheetsScope = "https://www.googleapis.com/auth/spreadsheets.readonly";

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
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const range = process.env.GOOGLE_SHEETS_PRODUCTS_RANGE ?? "Products!A:L";

  if (!clientEmail || !privateKey || !spreadsheetId) {
    throw badRequest("Google Sheets sync is not configured.");
  }

  return { clientEmail, privateKey, spreadsheetId, range };
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
  });

  if (!response.ok) {
    console.error("[google-sheets] token exchange failed", await response.text());
    throw badRequest("Unable to authenticate with Google Sheets. Check the service account configuration.");
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

function normalizeHeader(header: unknown) {
  return String(header ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function parseNumber(value: unknown, field: string, rowNumber: number) {
  if (value === "" || value === null || value === undefined) return undefined;

  const numberValue = Number(String(value).replace(/,/g, ""));

  if (!Number.isFinite(numberValue)) {
    throw badRequest(`Row ${rowNumber}: ${field} must be a number.`);
  }

  return Math.round(numberValue);
}

function parseProductType(value: unknown, rowNumber: number) {
  const type = String(value ?? "").trim().toLowerCase();

  if (type !== "laptop" && type !== "accessory") {
    throw badRequest(`Row ${rowNumber}: type must be "laptop" or "accessory".`);
  }

  return type as ProductType;
}

function parseStock(value: unknown, rowNumber: number) {
  const stock = String(value ?? "").trim();

  if (stock !== "In Stock" && stock !== "Out of Stock") {
    throw badRequest(`Row ${rowNumber}: stock must be "In Stock" or "Out of Stock".`);
  }

  return stock;
}

function parseJsonObject(value: unknown, field: string, rowNumber: number) {
  if (value === "" || value === null || value === undefined) return {};

  // Handle CSV-escaped format from Excel/Google Sheets import:
  // "{""key"":""value""}"  →  {"key":"value"}
  let str = String(value).trim();
  if (str.startsWith('"') && str.endsWith('"')) {
    str = str.slice(1, -1).replace(/""/g, '"');
  }

  try {
    const parsed = JSON.parse(str);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("not an object");
    }

    return parsed;
  } catch {
    throw badRequest(`Row ${rowNumber}: ${field} must be a JSON object.`);
  }
}

function requireText(
  row: Record<string, unknown>,
  field: string,
  rowNumber: number
) {
  const value = String(row[field] ?? "").trim();

  if (!value) {
    throw badRequest(`Row ${rowNumber}: ${field} is required.`);
  }

  return value;
}

export function parseProductsSheet(values: unknown[][]) {
  const [headers, ...rows] = values;

  if (!headers?.length) {
    throw badRequest("The Google Sheet needs a header row.");
  }

  const normalizedHeaders = headers.map(normalizeHeader);
  const products: ProductSheetRow[] = [];
  const skippedRows: number[] = [];

  rows.forEach((cells, index) => {
    const rowNumber = index + 2;

    if (!cells.some((cell) => String(cell ?? "").trim())) {
      skippedRows.push(rowNumber);
      return;
    }

    const row = normalizedHeaders.reduce<Record<string, unknown>>(
      (record, header, cellIndex) => {
        if (header) record[header] = cells[cellIndex];
        return record;
      },
      {}
    );

    const id = parseNumber(row.id, "id", rowNumber);
    const price = parseNumber(row.price, "price", rowNumber);

    if (price === undefined) {
      throw badRequest(`Row ${rowNumber}: price is required.`);
    }

    products.push({
      rowNumber,
      ...(id ? { id } : {}),
      name: requireText(row, "name", rowNumber),
      type: parseProductType(row.type, rowNumber),
      category: requireText(row, "category", rowNumber),
      brand: requireText(row, "brand", rowNumber),
      price,
      wholesalePrice: parseNumber(
        row.wholesale_price ?? row.wholesaleprice,
        "wholesale_price",
        rowNumber
      ),
      image: requireText(row, "image", rowNumber),
      model3D: String(row.model_3d ?? row.model3d ?? "").trim() || undefined,
      stock: parseStock(row.stock, rowNumber),
      specs: parseJsonObject(row.specs, "specs", rowNumber),
      fullSpecs: parseJsonObject(
        row.full_specs ?? row.fullspecs,
        "full_specs",
        rowNumber
      ),
    });
  });

  return { products, skippedRows };
}

export async function fetchProductsSheet() {
  const { spreadsheetId, range } = getGoogleSheetsConfig();
  const accessToken = await getAccessToken();
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      range
    )}`
  );

  url.searchParams.set("majorDimension", "ROWS");
  url.searchParams.set("valueRenderOption", "UNFORMATTED_VALUE");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    console.error("[google-sheets] sheet fetch failed", await response.text());
    throw badRequest("Unable to read the Google Sheet. Check the spreadsheet ID and sharing settings.");
  }

  const data = (await response.json()) as SheetsValuesResponse;
  return parseProductsSheet(data.values ?? []);
}
