import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// supabase.ts reads its connection settings once, at import time.
vi.hoisted(() => {
  vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("SUPABASE_ANON_KEY", "anon-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
});

vi.mock("../app/lib/supabase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/supabase")>()),
  selectProductByIdService: vi.fn(),
  selectDeletedProducts: vi.fn(),
  patchProductColumns: vi.fn(),
  deleteProduct: vi.fn(),
  insertAuditLog: vi.fn(),
}));

import {
  eraseDeletedProduct,
  listDeletedProducts,
  purgeExpiredDeletedProducts,
  removeProduct,
  restoreProduct,
} from "../app/lib/backend";
import {
  DELETED_PRODUCT_DAYS,
  daysLeft,
  deletedSpecs,
  isPurgeDue,
  keptHiddenSpecs,
  purgeDate,
  readDeletedMarker,
  restoredSpecs,
  type DeletedMarker,
} from "../app/lib/deleted-products";
import * as db from "../app/lib/supabase";
import type { CurrentUser } from "../app/lib/supabase";
import { parseProductionSheets, type ProductionSheetsValues } from "../app/lib/google-sheets";

const fresh = {
  id: "admin-1",
  role: "admin",
  mfa: { realRole: "admin", enrolled: true, aal: "aal2", pending: null, recentSignIn: true, factors: [], fresh: true },
} as unknown as CurrentUser;

const marker = (overrides: Partial<DeletedMarker> = {}): DeletedMarker => ({
  at: "2026-10-01T00:00:00.000Z",
  by: "admin-1",
  stock: "In Stock",
  stock_quantity: 7,
  was_archived: false,
  ...overrides,
});

describe("the 30-day rule", () => {
  it("keeps a deleted product for 30 days, then it is due", () => {
    const m = marker();
    expect(DELETED_PRODUCT_DAYS).toBe(30);
    expect(purgeDate(m).toISOString()).toBe("2026-10-31T00:00:00.000Z");
    expect(isPurgeDue(m, new Date("2026-10-30T23:59:59.000Z"))).toBe(false);
    expect(isPurgeDue(m, new Date("2026-10-31T00:00:00.000Z"))).toBe(true);
  });

  it("counts whole days left and never goes below zero", () => {
    const m = marker();
    expect(daysLeft(m, new Date("2026-10-01T00:00:00.000Z"))).toBe(30);
    expect(daysLeft(m, new Date("2026-10-30T12:00:00.000Z"))).toBe(1);
    expect(daysLeft(m, new Date("2026-12-01T00:00:00.000Z"))).toBe(0);
  });

  it("reads only a well-formed marker", () => {
    expect(readDeletedMarker(null)).toBeNull();
    expect(readDeletedMarker({})).toBeNull();
    expect(readDeletedMarker({ deleted: { at: "not a date" } })).toBeNull();
    expect(readDeletedMarker({ deleted: marker() })).toEqual(marker());
  });
});

describe("hiding and restoring specs", () => {
  it("deleting archives the product and notes what to put back", () => {
    const specs = deletedSpecs({ gallery: ["a"] }, marker());
    expect(specs).toMatchObject({ gallery: ["a"], archived: true, deleted: marker() });
  });

  it("restoring removes both marks, unless it was already hidden before", () => {
    const hidden = deletedSpecs({ gallery: ["a"] }, marker());
    expect(restoredSpecs(hidden, marker())).toEqual({ gallery: ["a"] });
    expect(restoredSpecs(hidden, marker({ was_archived: true }))).toEqual({ gallery: ["a"], archived: true });
  });

  it("erasing a product that has orders keeps it hidden and no longer restorable", () => {
    const hidden = deletedSpecs({ gallery: ["a"] }, marker());
    expect(keptHiddenSpecs(hidden)).toEqual({ gallery: ["a"], archived: true });
  });
});

describe("deleting, restoring and erasing a product", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(db.insertAuditLog).mockResolvedValue(undefined);
    vi.mocked(db.patchProductColumns).mockResolvedValue(undefined);
    vi.mocked(db.deleteProduct).mockResolvedValue(undefined);
  });

  it("delete moves the product to Recently deleted instead of removing it", async () => {
    vi.mocked(db.selectProductByIdService).mockResolvedValue({
      id: 5, name: "RTX Laptop", price: 100, stock: "In Stock", stock_quantity: 7, full_specs: { gallery: [] },
    } as never);

    const result = await removeProduct(fresh, 5);

    expect(db.deleteProduct).not.toHaveBeenCalled();
    expect(db.patchProductColumns).toHaveBeenCalledWith(5, {
      stock: "Out of Stock",
      stock_quantity: 0,
      full_specs: expect.objectContaining({
        archived: true,
        deleted: expect.objectContaining({ by: "admin-1", stock: "In Stock", stock_quantity: 7 }),
      }),
    });
    expect(result.restorableUntil).toBeTruthy();
  });

  it("a product that is already in Recently deleted is not deleted twice", async () => {
    vi.mocked(db.selectProductByIdService).mockResolvedValue({
      id: 5, name: "X", price: 1, full_specs: deletedSpecs({}, marker()),
    } as never);
    await expect(removeProduct(fresh, 5)).rejects.toMatchObject({ status: 409 });
    expect(db.patchProductColumns).not.toHaveBeenCalled();
  });

  it("restore puts back the stock the product had and clears the marks", async () => {
    vi.mocked(db.selectProductByIdService).mockResolvedValue({
      id: 5, name: "X", price: 1, full_specs: deletedSpecs({ gallery: ["a"] }, marker({ stock_quantity: 7 })),
    } as never);

    await restoreProduct(fresh, 5);

    expect(db.patchProductColumns).toHaveBeenCalledWith(5, {
      stock: "In Stock",
      stock_quantity: 7,
      full_specs: { gallery: ["a"] },
    });
  });

  it("restore refuses a product that was not deleted", async () => {
    vi.mocked(db.selectProductByIdService).mockResolvedValue({ id: 5, name: "X", full_specs: {} } as never);
    await expect(restoreProduct(fresh, 5)).rejects.toMatchObject({ status: 404 });
    expect(db.patchProductColumns).not.toHaveBeenCalled();
  });

  it("delete forever only works on a product already in Recently deleted", async () => {
    vi.mocked(db.selectProductByIdService).mockResolvedValue({ id: 5, name: "X", full_specs: {} } as never);
    await expect(eraseDeletedProduct(fresh, 5)).rejects.toMatchObject({ status: 404 });
    expect(db.deleteProduct).not.toHaveBeenCalled();
  });

  it("delete forever removes the row", async () => {
    vi.mocked(db.selectProductByIdService).mockResolvedValue({
      id: 5, name: "X", price: 1, full_specs: deletedSpecs({}, marker()),
    } as never);
    await expect(eraseDeletedProduct(fresh, 5)).resolves.toMatchObject({ outcome: "deleted" });
    expect(db.deleteProduct).toHaveBeenCalledWith(5);
  });

  it("a product with orders is kept, hidden, instead of failing", async () => {
    vi.mocked(db.selectProductByIdService).mockResolvedValue({
      id: 5, name: "X", price: 1, full_specs: deletedSpecs({ gallery: ["a"] }, marker()),
    } as never);
    vi.mocked(db.deleteProduct).mockRejectedValue(new Error('violates foreign key constraint "order_items_product_id_fkey"'));

    await expect(eraseDeletedProduct(fresh, 5)).resolves.toMatchObject({ outcome: "has_orders" });
    expect(db.patchProductColumns).toHaveBeenCalledWith(5, { full_specs: { gallery: ["a"], archived: true } });
  });

  it("lists what is deleted with the days left", async () => {
    vi.mocked(db.selectDeletedProducts).mockResolvedValue([
      {
        id: 5, name: "X", brand: "B", category: "C", image: null, price: 1,
        source_sheet: "Laptops", source_key: "k", deleted: marker(),
      },
    ]);
    const [item] = await listDeletedProducts(fresh, new Date("2026-10-11T00:00:00.000Z"));
    expect(item).toMatchObject({ id: 5, days_left: 20, stock_quantity: 7, deleted_at: "2026-10-01T00:00:00.000Z" });
  });
});

describe("the scheduled clean-up", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(db.insertAuditLog).mockResolvedValue(undefined);
    vi.mocked(db.patchProductColumns).mockResolvedValue(undefined);
    vi.mocked(db.deleteProduct).mockResolvedValue(undefined);
  });

  const row = (id: number, at: string) => ({
    id, name: `P${id}`, brand: "B", category: "C", image: null, price: 1,
    source_sheet: null, source_key: null, deleted: marker({ at }),
  });

  it("erases only the products whose 30 days are up", async () => {
    vi.mocked(db.selectDeletedProducts).mockResolvedValue([
      row(1, "2026-08-01T00:00:00.000Z"),
      row(2, "2026-10-10T00:00:00.000Z"),
    ]);
    vi.mocked(db.selectProductByIdService).mockImplementation(
      async (id: number) => ({ id, name: `P${id}`, price: 1, full_specs: deletedSpecs({}, marker()) }) as never
    );

    const erased = await purgeExpiredDeletedProducts(new Date("2026-10-13T00:00:00.000Z"));

    expect(erased).toBe(1);
    expect(db.deleteProduct).toHaveBeenCalledTimes(1);
    expect(db.deleteProduct).toHaveBeenCalledWith(1);
  });

  it("never throws, even when the list cannot be read", async () => {
    vi.mocked(db.selectDeletedProducts).mockRejectedValue(new Error("database down"));
    await expect(purgeExpiredDeletedProducts()).resolves.toBe(0);
  });
});

describe("the sheet sync leaves a deleted product alone", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not put a product that is in Recently deleted back on sale", async () => {
    const values: ProductionSheetsValues = {
      Laptops: [
        ["Pur No.", "Warranty", "Brand", "Model No", "Model", "Specs (Detail)", "Qty", "Retail Price MMK"],
        ["JU21", "", "Dell", "", "Dell Latitude 3420", "• Intel Core i7 • 16 GB RAM • 256 GB SSD", 4, 2000],
        ["S1", "", "HP", "450J3EC", "HP ProBook 640 G8", "• Intel Core i5 • 8 GB RAM • 256 GB SSD", 2, 900],
      ],
      Accessories: [["Pur no", "Category", "Brand", "Model No", "Model", "Specs", "Warranty", "ClosingQty", "Retail Price MMK"]],
      "PC Parts": [["Pur no", "Category", "Brand", "Description", "ClosingQty", "Retail Price MMK"]],
    };
    const products = parseProductionSheets(values).products.filter((p) => p.sourceSheet === "Laptops");
    const deleted = products.find((p) => p.brand === "Dell")!;
    const { upsertProductionProducts } = await vi.importActual<typeof import("../app/lib/supabase")>("../app/lib/supabase");

    const posted: { source_key: string }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if ((init?.method ?? "GET") === "GET") {
          return Response.json([
            {
              source_key: deleted.sourceKey,
              stock_quantity: 0,
              sheet_stock_quantity: 4,
              image: "x",
              full_specs: deletedSpecs({}, marker({ stock_quantity: 4 })),
            },
          ]);
        }
        posted.push(...JSON.parse(String(init?.body)));
        return Response.json([]);
      })
    );

    await upsertProductionProducts(products);

    expect(posted.map((row) => row.source_key)).not.toContain(deleted.sourceKey);
    expect(posted).toHaveLength(1);
  });
});
