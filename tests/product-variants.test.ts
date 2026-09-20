import { describe, expect, it } from "vitest";
import type { Product } from "../app/data/products";
import { recommendLaptops, type QuizAnswers } from "../app/lib/laptop-quiz";
import {
  groupProductVariants,
  isSameVariantGroup,
  productVariant,
  variantOptions,
} from "../app/lib/product-variants";

const GROUP = "0123456789abcdef";

function laptop(
  id: number,
  overrides: Partial<Product> = {},
  variant?: { label: string; group?: string }
): Product {
  return {
    id,
    name: variant ? `Dell Latitude 3420 (${variant.label})` : `Laptop ${id}`,
    type: "laptop",
    sourceSheet: "Laptops",
    category: "Laptop",
    brand: "Dell",
    price: 3_750_660,
    image: "/products/production-placeholder.svg",
    stock: "In Stock",
    specs: { cpu: "Intel Core i7 11th Gen", ram: "16 GB RAM", storage: variant?.label ?? "256 GB SSD" },
    fullSpecs: variant
      ? { variant: { group: variant.group ?? GROUP, model: "Dell Latitude 3420", label: variant.label } }
      : {},
    ...overrides,
  };
}

describe("grouping versions of one model", () => {
  it("shows one card for all versions, linking to the first in stock", () => {
    const products = [
      laptop(1),
      laptop(217, {}, { label: "512 GB SSD" }),
      laptop(2),
      laptop(14, { stock: "Out of Stock" }, { label: "256 GB SSD" }),
    ];

    const groups = groupProductVariants(products);

    expect(groups.map((group) => group.product.id)).toEqual([1, 217, 2]);
    expect(groups[1]).toMatchObject({
      model: "Dell Latitude 3420",
      options: [
        { id: 14, label: "256 GB SSD", stock: "Out of Stock" },
        { id: 217, label: "512 GB SSD", stock: "In Stock" },
      ],
    });
    expect(groups[0]).toMatchObject({ model: null, options: [] });
  });

  it("links to the smallest version when both are in stock", () => {
    const groups = groupProductVariants([
      laptop(217, {}, { label: "512 GB SSD" }),
      laptop(14, {}, { label: "256 GB SSD" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].product.id).toBe(14);
  });

  it("shows a lone version as a normal card (e.g. the other one is filtered out)", () => {
    const [group] = groupProductVariants([laptop(217, {}, { label: "512 GB SSD" })]);
    expect(group).toMatchObject({ model: null, options: [] });
  });

  it("sorts sizes by number, not by text", () => {
    const options = variantOptions([
      laptop(3, {}, { label: "1 TB SSD" }),
      laptop(2, {}, { label: "512 GB SSD" }),
      laptop(1, {}, { label: "256 GB SSD" }),
    ]);
    // "1 TB" sorts first by number; labels are compared, not converted to bytes.
    expect(options.map((option) => option.label)).toEqual(["1 TB SSD", "256 GB SSD", "512 GB SSD"]);
  });

  it("ignores version data that is malformed or not from the sync", () => {
    expect(productVariant(laptop(1, {}, { label: "256 GB SSD", group: "not-a-group" }))).toBeNull();
    expect(productVariant(laptop(1))).toBeNull();
    expect(
      isSameVariantGroup(laptop(1, {}, { label: "256 GB SSD" }), laptop(2, {}, { label: "512 GB SSD" }))
    ).toBe(true);
    expect(isSameVariantGroup(laptop(1), laptop(2))).toBe(false);
  });
});

describe("Find My Laptop with versions", () => {
  it("recommends a laptop once, not once per version", () => {
    const answers: QuizAnswers = {
      budgetMin: 3_000_000,
      budgetMax: 4_000_000,
      use: "office",
      screen: "any",
    } as QuizAnswers;

    const result = recommendLaptops(
      [
        laptop(14, {}, { label: "256 GB SSD" }),
        laptop(217, {}, { label: "512 GB SSD" }),
        laptop(1, { brand: "HP", name: "HP ProBook 640 G8" }),
        laptop(2, { brand: "HP", name: "HP EliteBook 830 G7" }),
      ],
      answers
    );

    const dellPicks = result.picks.filter((pick) => pick.product.brand === "Dell");
    expect(dellPicks).toHaveLength(1);
    expect(result.picks).toHaveLength(3);
  });
});
