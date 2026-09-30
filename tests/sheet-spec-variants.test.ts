import { generateKeyPairSync } from "node:crypto";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

// supabase.ts reads its connection settings once, at import time.
vi.hoisted(() => {
  vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("SUPABASE_ANON_KEY", "anon-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
});

import {
  decrementSheetQuantities,
  parseProductionSheets,
  specVariantBaseKey,
  type ProductionSheetsValues,
} from "../app/lib/google-sheets";
import { upsertProductionProducts } from "../app/lib/supabase";

afterEach(() => {
  vi.unstubAllGlobals();
});

afterAll(() => {
  vi.unstubAllEnvs();
});

const DELL_256 = "• Intel Core i7 11th Gen • 16 GB RAM • 256 GB SSD";
const DELL_512 = "• Intel Core i7 11th Gen • 16 GB RAM • 512 GB SSD";

/** Header on the first line, so array index + 1 is the sheet row number. */
function workbook(dellRow4Spec = DELL_512): ProductionSheetsValues {
  return {
    Laptops: [
      ["Pur No.", "Warranty", "Brand", "Model No", "Model", "Specs (Detail)", "Qty", "Retail Price MMK"],
      ["JU21", "", "Dell", "", "Dell Latitude 3420", DELL_256, 1, 2000],
      ["JU22", "", "Dell", "", "Dell Latitude 3420", DELL_256, 1, 2000],
      ["JU23", "", "Dell", "", "Dell Latitude 3420", dellRow4Spec, 1, 2500],
      ["JU24", "", "Dell", "", "Dell Latitude 3420", "", 2, 2000],
      ["S1", "", "HP", "450J3EC", "HP ProBook 640 G8", "•Intel Core i5 • 8GB RAM • 256GB SSD", 1, 900],
      ["S2", "", "HP", "450J3EC", "HP ProBook 640 G8", "• intel core i5 • 8 GB ram • 256 GB SSD", 1, 900],
    ],
    Accessories: [
      ["Pur no", "Category", "Brand", "Model No", "Model", "Specs", "Warranty", "ClosingQty", "Retail Price MMK"],
      ["A1", "Keyboard", "Logitech", "920-0001", "MX Keys", "Wireless • Black", "", 3, 400],
      ["A2", "Keyboard", "Logitech", "920-0001", "MX Keys", "Wireless • White", "", 0, 400],
    ],
    "PC Parts": [
      ["Pur no", "Category", "Brand", "Description", "ClosingQty", "Retail Price MMK"],
      ["P1", "SSD", "Kingston", "SSD 256GB M100", 0, 100],
      ["P2", "SSD", "Kingston", "SSD 256GB M100", 0, 100],
    ],
  };
}

function laptops(values: ProductionSheetsValues) {
  return parseProductionSheets(values).products.filter(
    (product) => product.sourceSheet === "Laptops"
  );
}

const dellKey = laptops(workbook(DELL_256)).find((product) =>
  product.name.startsWith("Dell")
)!.sourceKey;

describe("products with the same model but different specs", () => {
  it("gives each spec version its own product and stock", () => {
    const dell = laptops(workbook()).filter((product) => product.name.startsWith("Dell"));

    expect(dell).toHaveLength(2);
    expect(dell[0]).toMatchObject({
      name: "Dell Latitude 3420 (256 GB SSD)",
      sourceKey: dellKey,
      stockQuantity: 4,
      sourceRows: [2, 3, 5],
      price: 2000,
    });
    expect(dell[1]).toMatchObject({
      name: "Dell Latitude 3420 (512 GB SSD)",
      stockQuantity: 1,
      sourceRows: [4],
      rowQuantities: [{ row: 4, quantity: 1 }],
      price: 2500,
    });
    expect(dell[1].sourceKey.startsWith(`${dellKey}:v-`)).toBe(true);
    expect(dell[1].specs.storage).toBe("512 GB SSD");
  });

  it("tells the website both versions belong on one page, without exposing the key", () => {
    const dell = laptops(workbook()).filter((product) => product.name.startsWith("Dell"));
    const [small, large] = dell.map((product) => product.fullSpecs.variant as {
      group: string;
      model: string;
      label: string;
    });

    expect(small).toMatchObject({ model: "Dell Latitude 3420", label: "256 GB SSD" });
    expect(large).toMatchObject({ model: "Dell Latitude 3420", label: "512 GB SSD" });
    expect(small.group).toMatch(/^[a-f0-9]{16}$/);
    expect(large.group).toBe(small.group);
    expect(dellKey).not.toContain(small.group);

    const hp = laptops(workbook()).find((product) => product.brand === "HP")!;
    expect(hp.fullSpecs.variant).toBeUndefined();
  });

  it("keeps the product already on the website for the first row's version", () => {
    // Before the 512 GB change, all rows were one product with this same key.
    expect(dellKey).toBe(laptops(workbook()).find((p) => p.name.includes("256 GB"))!.sourceKey);
    expect(specVariantBaseKey(dellKey)).toBeNull();
    const version = laptops(workbook()).find((p) => p.name.includes("512 GB"))!;
    expect(specVariantBaseKey(version.sourceKey)).toBe(dellKey);
  });

  it("gives a version the same key on every sync", () => {
    const first = laptops(workbook()).map((product) => product.sourceKey);
    const second = laptops(workbook()).map((product) => product.sourceKey);
    expect(second).toEqual(first);
  });

  it("does not split when specs only differ in spacing, case or bullets", () => {
    const hp = laptops(workbook()).filter((product) => product.brand === "HP");
    expect(hp).toHaveLength(1);
    expect(hp[0]).toMatchObject({ name: "HP ProBook 640 G8", stockQuantity: 2 });
  });

  it("does not split identical rows, or tabs without a specs column", () => {
    const unsplit = laptops(workbook(DELL_256)).filter((p) => p.name.startsWith("Dell"));
    expect(unsplit).toHaveLength(1);
    expect(unsplit[0]).toMatchObject({ name: "Dell Latitude 3420", stockQuantity: 5 });

    const parts = parseProductionSheets(workbook()).products.filter(
      (product) => product.sourceSheet === "PC Parts"
    );
    expect(parts).toHaveLength(1);
    expect(parts[0].sourceRows).toEqual([2, 3]);
  });

  it("splits accessories too, naming each by what differs", () => {
    const keys = parseProductionSheets(workbook()).products.filter(
      (product) => product.sourceSheet === "Accessories"
    );
    expect(keys.map((product) => [product.name, product.stockQuantity])).toEqual([
      ["MX Keys (Black)", 3],
      ["MX Keys (White)", 0],
    ]);
  });

  it("tells the admin which rows became separate products", () => {
    const { warnings, specVariants } = parseProductionSheets(workbook());
    expect(specVariants).toHaveLength(2);
    expect(
      warnings.find((warning) => warning.startsWith("Dell Latitude 3420 (Laptops) has 2 versions"))
    ).toContain("256 GB SSD = 4 in stock (rows 2, 3, 5); 512 GB SSD = 1 in stock (rows 4)");
  });
});

describe("selling one version", () => {
  it("never deducts the other version's sheet rows", async () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    vi.stubEnv("GOOGLE_SHEETS_CLIENT_EMAIL", "shop@example.iam.gserviceaccount.com");
    vi.stubEnv(
      "GOOGLE_SHEETS_PRIVATE_KEY",
      privateKey.export({ type: "pkcs8", format: "pem" }).toString()
    );

    const values = workbook();
    const written: { range: string; values: number[][] }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.startsWith("https://oauth2.googleapis.com/token")) {
          return Response.json({ access_token: "token" });
        }
        if (url.includes("values:batchGet")) {
          return Response.json({
            valueRanges: (Object.keys(values) as (keyof ProductionSheetsValues)[]).map(
              (sheet) => ({ range: `'${sheet}'!A1:Z100`, values: values[sheet] })
            ),
          });
        }
        if (url.includes("values:batchUpdate")) {
          written.push(...JSON.parse(String(init?.body)).data);
          return Response.json({});
        }
        throw new Error(`unexpected request ${url}`);
      })
    );

    const [update] = await decrementSheetQuantities([{ sourceKey: dellKey, quantity: 3 }]);

    // Qty is column G. The 256 GB rows are 2, 3 and 5; row 4 is the 512 GB.
    expect(written.map((cell) => cell.range)).toEqual([
      "'Laptops'!G2",
      "'Laptops'!G3",
      "'Laptops'!G5",
    ]);
    expect(update).toMatchObject({ shortfall: 0, sheetQuantityAfter: 1 });
  });
});

describe("syncing a new version to the website", () => {
  it("starts with its model's photos but keeps its own stock", async () => {
    const photo = "https://project.supabase.co/storage/v1/object/public/product-photos/laptops/dell-3420-front.png";
    const dell = laptops(workbook()).filter((product) => product.name.startsWith("Dell"));
    const posted: Record<string, unknown>[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if ((init?.method ?? "GET") === "GET") {
          // Only the original product is on the website so far.
          return Response.json([
            {
              source_key: dellKey,
              stock_quantity: 5,
              sheet_stock_quantity: 5,
              image: photo,
              full_specs: { gallery: [{ url: photo, label: "Front" }], galleryManagedBy: "admin" },
            },
          ]);
        }
        posted.push(...JSON.parse(String(init?.body)));
        return Response.json([]);
      })
    );

    await upsertProductionProducts(dell);

    const [original, version] = posted as {
      name: string;
      image: string;
      stock_quantity: number;
      full_specs: { gallery: unknown };
    }[];
    expect(original).toMatchObject({ name: "Dell Latitude 3420 (256 GB SSD)", stock_quantity: 4 });
    expect(version).toMatchObject({
      name: "Dell Latitude 3420 (512 GB SSD)",
      image: photo,
      stock_quantity: 1,
      full_specs: { gallery: [{ url: photo, label: "Front" }] },
    });
  });
});
