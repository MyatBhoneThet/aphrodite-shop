import { describe, expect, it } from "vitest";
import type { Product } from "../app/data/products";
import { recommendLaptops, type QuizAnswers } from "../app/lib/laptop-quiz";

function laptop(overrides: Partial<Product>): Product {
  return {
    id: 1,
    name: "Test laptop",
    type: "laptop",
    sourceSheet: "Laptops",
    category: "Laptop",
    brand: "Demo",
    price: 3_000_000,
    image: "/products/production-placeholder.svg",
    stock: "In Stock",
    specs: {},
    fullSpecs: {},
    ...overrides,
  };
}

const gamingRig = laptop({
  id: 10,
  name: "Nitro V 15 Gaming",
  price: 5_000_000,
  fullSpecs: {
    processor: "Intel Core i7-13620H",
    ram: "16GB DDR5",
    storage: "1TB NVMe SSD",
    graphics: "NVIDIA GeForce RTX 4060 8GB GDDR6",
    display: "15.6 inch FHD 165Hz",
    weight: "2.1 kg",
  },
});

const ultrabook = laptop({
  id: 11,
  name: "Swift Go 13",
  price: 2_500_000,
  fullSpecs: {
    processor: "Intel Core i5-1335U",
    ram: "8GB LPDDR5",
    storage: "512GB NVMe SSD",
    graphics: "Intel Iris Xe Graphics",
    display: "13.3 inch FHD",
    weight: "1.1 kg",
    battery: "65Wh",
  },
});

const officeBook = laptop({
  id: 12,
  name: "EliteBook 840",
  price: 3_500_000,
  fullSpecs: {
    processor: "Intel Core i7-1255U",
    ram: "32GB DDR4",
    storage: "1TB NVMe SSD",
    graphics: "Intel Iris Xe Graphics",
    display: "14 inch FHD",
    weight: "1.4 kg",
  },
});

const catalogue = [gamingRig, ultrabook, officeBook];

const answers = (overrides: Partial<QuizAnswers> = {}): QuizAnswers => ({
  budgetMin: 0,
  budgetMax: 10_000_000,
  use: "office",
  screen: "any",
  ...overrides,
});

describe("Find my laptop quiz", () => {
  it("returns three ranked picks with badges and reasons", () => {
    const result = recommendLaptops(catalogue, answers());
    expect(result.picks).toHaveLength(3);
    expect(result.picks.map((pick) => pick.rank)).toEqual([1, 2, 3]);
    expect(result.picks[0].badge).toBe("Best match");
    expect(result.picks[0].reasons.length).toBeGreaterThan(0);
  });

  it("sends a gaming answer to the laptop with a real graphics card", () => {
    const result = recommendLaptops(catalogue, answers({ use: "gaming" }));
    expect(result.picks[0].product.id).toBe(10);
    expect(result.picks[0].reasons.join(" ")).toContain("RTX 4060");
  });

  it("prefers the light, long-battery laptop for travel", () => {
    const result = recommendLaptops(catalogue, answers({ use: "travel" }));
    expect(result.picks[0].product.id).toBe(11);
  });

  it("never recommends a laptop the catalogue cannot price", () => {
    const result = recommendLaptops(
      [laptop({ id: 20, name: "Unpriced", price: 0 }), ...catalogue],
      answers()
    );
    expect(result.picks.every((pick) => pick.product.price > 0)).toBe(true);
  });

  it("says so when nothing can be priced at all", () => {
    const result = recommendLaptops(
      [laptop({ id: 21, price: 0 }), laptop({ id: 22, price: 0 })],
      answers()
    );
    expect(result.picks).toHaveLength(0);
    expect(result.notes.join(" ")).toContain("cannot match one to your budget");
  });

  it("keeps picks inside the budget when it can", () => {
    const result = recommendLaptops(
      catalogue,
      answers({ budgetMin: 2_000_000, budgetMax: 3_000_000 })
    );
    expect(result.inBudgetCount).toBe(1);
    expect(result.picks[0].product.id).toBe(11);
    expect(result.picks[0].caveat).toBeNull();
  });

  it("widens the search instead of returning nothing, and explains why", () => {
    const result = recommendLaptops(
      catalogue,
      answers({ budgetMin: 90_000_000, budgetMax: 99_000_000 })
    );
    expect(result.picks).toHaveLength(3);
    expect(result.inBudgetCount).toBe(0);
    expect(result.notes.join(" ")).toContain("closest we have");
    expect(result.picks[0].caveat).toContain("Below your budget");
  });

  it("honours a screen size preference when the budget allows", () => {
    const result = recommendLaptops(catalogue, answers({ screen: "large" }));
    expect(result.picks[0].product.id).toBe(10);
  });

  it("warns when no laptop has a real graphics card for gaming", () => {
    const result = recommendLaptops(
      [ultrabook, officeBook],
      answers({ use: "gaming" })
    );
    expect(result.notes.join(" ")).toContain("separate graphics card");
  });

  it("flags out-of-stock picks rather than hiding the problem", () => {
    const result = recommendLaptops(
      [laptop({ id: 30, name: "Sold out", stock: "Out of Stock" })],
      answers()
    );
    expect(result.notes.join(" ")).toContain("in stock");
    expect(result.picks[0].caveat).toContain("out of stock");
  });

  it("ignores products that are not laptops", () => {
    const mouse = laptop({
      id: 40,
      name: "Gaming mouse",
      type: "accessory",
      sourceSheet: "Accessories",
      category: "Mouse",
      price: 50_000,
    });
    const result = recommendLaptops([...catalogue, mouse], answers());
    expect(result.picks.every((pick) => pick.product.id !== 40)).toBe(true);
    expect(result.consideredCount).toBe(3);
  });
});
