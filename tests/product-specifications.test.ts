import { describe, expect, it } from "vitest";
import type { Product } from "../app/data/products";
import {
  classifyPcPart,
  getProductSpecifications,
} from "../app/lib/product-specifications";

function product(overrides: Partial<Product>): Product {
  return {
    id: 1,
    name: "Test product",
    type: "accessory",
    category: "Accessory",
    brand: "Test",
    price: 1000,
    image: "/products/production-placeholder.svg",
    stock: "In Stock",
    specs: {},
    fullSpecs: {},
    ...overrides,
  };
}

describe("category-aware product specifications", () => {
  it("shows laptop fields only when values exist", () => {
    const result = getProductSpecifications(product({
      type: "laptop",
      category: "Laptop",
      fullSpecs: { processor: "Ryzen 7", ram: "16 GB", battery: "-" },
    }));
    expect(result.title).toBe("Laptop Specifications");
    expect(result.rows).toContainEqual({ label: "Processor", value: "Ryzen 7" });
    expect(result.rows.some((row) => row.label === "Battery")).toBe(false);
    expect(result.rows.some((row) => row.label === "Weight")).toBe(false);
  });

  it("shows GPU specifications without laptop rows", () => {
    const gpu = product({
      sourceSheet: "PC Parts",
      name: "ZOTAC GeForce RTX 4070 12GB GDDR6X PCIe 4.0",
      category: "GPU",
      specs: { detail: "12GB GDDR6X PCIe 4.0" },
    });
    const result = getProductSpecifications(gpu);
    expect(classifyPcPart(gpu)).toBe("gpu");
    expect(result.title).toBe("Graphics Card Specifications");
    expect(result.rows.some((row) => row.label === "Video memory")).toBe(true);
    expect(result.rows.some((row) => row.label === "Battery")).toBe(false);
    expect(result.rows.some((row) => row.label === "Operating System")).toBe(false);
  });

  it("uses monitor-only fields for display accessories", () => {
    const result = getProductSpecifications(product({
      name: "Odyssey 32 inch OLED 4K 240Hz",
      category: "Monitor",
      specs: { detail: "32 inch OLED 4K 240Hz" },
    }));
    expect(result.title).toBe("Monitor Specifications");
    expect(result.rows.some((row) => row.label === "Screen size")).toBe(true);
    expect(result.rows.some((row) => row.label === "Refresh rate")).toBe(true);
    expect(result.rows.some((row) => row.label === "RAM")).toBe(false);
  });
});
