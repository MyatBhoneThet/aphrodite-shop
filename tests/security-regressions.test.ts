import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { productDTO } from "../app/lib/backend";
import { mapProductPatchToRow } from "../app/lib/supabase";
import type { Product } from "../app/data/products";

const product: Product = {
  id: 1,
  name: "Test laptop",
  type: "laptop",
  category: "Laptop",
  brand: "Test",
  price: 50_000,
  wholesalePrice: 40_000,
  image: "/products/test.png",
  stock: "In Stock",
  stockQuantity: 25,
  specs: {},
  fullSpecs: {},
};

describe("confidential product fields", () => {
  it("redacts wholesale price and exact inventory for public viewers", () => {
    const dto = productDTO(product, null);

    expect(dto.wholesalePrice).toBeUndefined();
    expect(dto.stockQuantity).toBeUndefined();
  });

  it("keeps confidential fields for an authenticated admin DTO", () => {
    const dto = productDTO(product, {
      id: "admin-1",
      email: "admin@example.com",
      role: "admin",
      accessToken: "test-token",
      profile: {
        id: "admin-1",
        email: "admin@example.com",
        full_name: "Admin",
        role: "admin",
        wholesale_status: "not_applied",
        price_list_id: null,
        phone: null,
      },
    });

    expect(dto.wholesalePrice).toBe(40_000);
    expect(dto.stockQuantity).toBe(25);
  });

  it("schema revokes table-wide product reads before granting public columns", () => {
    const schema = readFileSync("supabase/schema.sql", "utf8");

    expect(schema).toContain(
      "revoke select on public.products from anon, authenticated"
    );
    expect(schema).not.toContain(
      "grant select on public.products to anon, authenticated"
    );
  });
});

describe("partial product updates", () => {
  it("maps only fields that were actually supplied", () => {
    expect(mapProductPatchToRow({ price: 42_000 })).toEqual({ price: 42_000 });
  });

  it("can deliberately clear a nullable field", () => {
    expect(mapProductPatchToRow({ model3D: undefined })).toEqual({
      model_3d: null,
    });
  });
});
