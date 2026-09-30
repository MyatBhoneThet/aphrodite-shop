import { describe, expect, it } from "vitest";
import type { Product } from "../app/data/products";
import {
  belongsToCatalogSection,
  shuffleProducts,
} from "../app/lib/catalog";

function product(overrides: Partial<Product>): Product {
  return {
    id: 1,
    name: "Product",
    type: "accessory",
    category: "Accessory",
    brand: "Aphrodite",
    price: 1_000,
    image: "/product.png",
    stock: "In Stock",
    specs: {},
    fullSpecs: {},
    ...overrides,
  };
}

describe("catalog section helpers", () => {
  it("keeps workbook tabs in separate storefront sections", () => {
    expect(
      belongsToCatalogSection(
        product({ sourceSheet: "Accessories" }),
        "Accessories"
      )
    ).toBe(true);
    expect(
      belongsToCatalogSection(product({ sourceSheet: "PC Parts" }), "PC Parts")
    ).toBe(true);
    expect(
      belongsToCatalogSection(product({ sourceSheet: "PC Parts" }), "Accessories")
    ).toBe(false);
  });

  it("shuffles a copy without mutating the API result", () => {
    const original = [1, 2, 3, 4];
    const shuffled = shuffleProducts(original, () => 0);

    expect(original).toEqual([1, 2, 3, 4]);
    expect(shuffled).toEqual([2, 3, 4, 1]);
  });
});
