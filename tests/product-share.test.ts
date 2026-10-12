import { describe, expect, it } from "vitest";
import { productSharePreview } from "../app/lib/product-share";
import type { Product } from "../app/data/products";

const format = (value: number) => `MMK ${value.toLocaleString("en-US")}`;

function product(overrides: Partial<Product> = {}) {
  return {
    id: 209,
    name: "Thinkpad X13",
    brand: "Lenovo",
    category: "Laptop",
    image: "https://cdn.example.com/x13.jpg",
    stock: "In Stock" as const,
    specs: { cpu: "Intel Core i5", ram: "8GB", storage: "256GB", display: '14" FHD' },
    fullSpecs: {},
    ...overrides,
  } as Parameters<typeof productSharePreview>[0];
}

describe("productSharePreview", () => {
  it("puts the name, price and a usable photo in the share card", () => {
    const preview = productSharePreview(product(), 3_214_660, format, "https://shop.example");

    expect(preview.title).toBe("Thinkpad X13");
    expect(preview.shareTitle).toBe("Thinkpad X13 — MMK 3,214,660");
    expect(preview.image).toBe("https://cdn.example.com/x13.jpg");
    expect(preview.description).toContain("Intel Core i5 · 8GB · 256GB");
    expect(preview.description).toContain("In stock");
    expect(preview.priceAmount).toBe(3_214_660);
  });

  it("falls back to the brand card when the only photo is an SVG placeholder", () => {
    const preview = productSharePreview(
      product({ image: "/products/production-placeholder.svg" }),
      100_000,
      format,
      "https://shop.example"
    );

    expect(preview.image).toBe("/brand/og-share.png");
    expect((preview.jsonLd.image as string[])[0]).toBe("https://shop.example/brand/og-share.png");
  });

  it("never advertises a zero price as a real one", () => {
    const preview = productSharePreview(product(), 0, format, "https://shop.example");

    expect(preview.shareTitle).toBe("Thinkpad X13");
    expect(preview.priceAmount).toBeNull();
    expect(preview.jsonLd.offers).toBeUndefined();
    expect(preview.description).toContain("Price coming soon");
  });

  it("describes stock honestly in the search-engine data", () => {
    const out = productSharePreview(product({ stock: "Out of Stock" }), 50_000, format, "https://shop.example");
    const offers = out.jsonLd.offers as { availability: string; priceCurrency: string; price: number };

    expect(offers.availability).toBe("https://schema.org/OutOfStock");
    expect(offers.priceCurrency).toBe("MMK");
    expect(offers.price).toBe(50_000);
    expect(out.inStock).toBe(false);
  });
});
