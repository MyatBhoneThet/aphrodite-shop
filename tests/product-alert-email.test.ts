import { describe, expect, it } from "vitest";
import type { Product } from "../app/data/products";
import { productPriceAlertEmailContent } from "../app/lib/product-alert-email";

const product: Product = {
  id: 14,
  name: "Dell Latitude 3420",
  type: "laptop",
  category: "Laptop",
  brand: "Dell",
  price: 668_660,
  image: "/products/dell.png",
  stock: "In Stock",
  specs: {},
  fullSpecs: {
    promotion: {
      price: 600_000,
      startsAt: null,
      endsAt: null,
    },
  },
};

describe("product price-alert email", () => {
  it("shows the selected product's promotion and links back to it", () => {
    const content = productPriceAlertEmailContent(
      product,
      product.price,
      { PUBLIC_SITE_URL: "https://shop.example.com" } as unknown as NodeJS.ProcessEnv
    );

    expect(content.subject).toContain("Promotion: Dell Latitude 3420");
    expect(content.html).toContain("MMK 668,660");
    expect(content.html).toContain("MMK 600,000");
    expect(content.html).toContain("Save MMK 68,660 (10%)");
    expect(content.html).toContain("အထူးလျှော့ဈေး");
    expect(content.html).toContain("https://shop.example.com/products/14");
    expect(content.text).toContain("Current price: MMK 600,000");
  });

  it("escapes product data in the HTML message", () => {
    const content = productPriceAlertEmailContent(
      { ...product, name: '<img src=x onerror="alert(1)">' },
      product.price,
      { PUBLIC_SITE_URL: "https://shop.example.com" } as unknown as NodeJS.ProcessEnv
    );

    expect(content.html).not.toContain("<img src=x");
    expect(content.html).toContain("&lt;img src=x");
  });
});
