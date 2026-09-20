import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { translate } from "../app/lib/translations";
import { translateStorefrontText } from "../app/lib/storefront-translations";
import { EMPTY_PRODUCT_FILTERS } from "../app/lib/product-filters";
import ProductFilters from "../app/components/ProductFilters";
import PcBuilderPage from "../app/pc-builder/page";
import ProductCard from "../app/components/ProductCard";
import type { Product } from "../app/data/products";
import CategoryGrid from "../app/components/CategoryGrid";

const locale = vi.hoisted(() => ({ value: "my" as "my" | "en" }));
vi.stubGlobal("React", React);
vi.mock("../app/lib/language", () => ({
  useLanguage: () => ({
    language: locale.value,
    t: (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) => translate(locale.value, key, vars),
    text: (value: string) => translateStorefrontText(locale.value, value),
  }),
}));

describe("storefront language rendering", () => {
  it("renders the PC builder panel in the selected language", () => {
    locale.value = "my";
    const burmese = renderToStaticMarkup(React.createElement(PcBuilderPage));
    for (const label of ["PC Build Planner", "Minimum budget", "Maximum budget", "What will you use the PC for?", "Loading catalogue...", "Why the price may change", "Gaming and live streaming"]) {
      expect(burmese).toContain(translateStorefrontText("my", label));
      expect(burmese).not.toContain(label);
    }
    expect(burmese).toContain('value="6700000"');
    locale.value = "en";
    const english = renderToStaticMarkup(React.createElement(PcBuilderPage));
    expect(english).toContain("Minimum budget");
    expect(english).toContain("Turn your budget into a");
    expect(english).toContain("Gaming and live streaming");
  });

  it("renders Burmese categories and result counts while retaining filter identifiers", () => {
    locale.value = "my";
    const html = renderToStaticMarkup(React.createElement(ProductFilters, {
      brands: ["Dell"], categories: ["Laptop"], filters: EMPTY_PRODUCT_FILTERS,
      resultCount: 465, onChange: () => {},
    }));
    expect(html).toContain("ပစ္စည်း 465 ခု တွေ့ရှိသည်");
    expect(html).toContain('value="Laptop"');
    expect(html).toContain('value="laptop"');
    expect(html).toContain("လက်ပ်တော့များ");
    expect(html).not.toContain("Minimum price (MMK)");
    expect(html).toContain("Dell");
    const grid = renderToStaticMarkup(React.createElement(CategoryGrid, { language: "my" }));
    expect(grid).toContain("ကွန်ပျူတာ ဆင်ရန်");
    expect(grid).not.toContain("Build a PC");
  });

  it("translates product-card specification tags and preserves their values", () => {
    const product: Product = {
      id: 1, name: "Dell Latitude", type: "laptop", category: "Laptop", brand: "Dell",
      price: 100, image: "/products/test.png", stock: "In Stock",
      specs: { cpu: "Intel Core i5-10310U", ram: "16 GB DDR4-2666 MHz", storage: "512 GB PCIe NVMe TLC SSD" },
      fullSpecs: {},
    };
    for (const language of ["my", "en"] as const) {
      locale.value = language;
      const html = renderToStaticMarkup(React.createElement(ProductCard, { product, userRole: "normal" }));
      for (const label of ["Processor", "RAM", "Storage"]) {
        expect(html).toContain(translateStorefrontText(language, label));
        if (language === "my") expect(html).not.toMatch(new RegExp(`>\\s*${label}\\s*<`));
      }
      for (const value of Object.values(product.specs)) expect(html).toContain(value);
    }
  });

  it("still renders English after switching back", () => {
    locale.value = "en";
    const html = renderToStaticMarkup(React.createElement(ProductFilters, {
      brands: [], categories: [], filters: EMPTY_PRODUCT_FILTERS,
      resultCount: 1, onChange: () => {},
    }));
    expect(html).toContain("1 result");
    expect(html).not.toContain("1 results");
    expect(html).toContain("Minimum price (MMK)");
  });

  it("localizes generated captions and specification headings without changing model data", () => {
    expect(translateStorefrontText("my", "Laptop Specifications")).toBe("လက်ပ်တော့ အသေးစိတ်အချက်အလက်များ");
    expect(translateStorefrontText("my", "Photo 3")).toBe("ပစ္စည်းပုံ 3");
    expect(translateStorefrontText("my", "Dell Latitude 3420")).toBe("Dell Latitude 3420");
    expect(translateStorefrontText("my", "256 GB SSD")).toBe("256 GB SSD");
  });
});
