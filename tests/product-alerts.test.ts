import { describe, expect, it } from "vitest";
import type { Product } from "../app/data/products";
import {
  alertBaseline,
  evaluateAlert,
  suggestedAlertKinds,
  triggeredAlerts,
  type ProductAlert,
} from "../app/lib/product-alerts";

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    name: "Test laptop",
    type: "laptop",
    sourceSheet: "Laptops",
    category: "Laptop",
    brand: "Demo",
    price: 4_000_000,
    image: "/products/production-placeholder.svg",
    stock: "In Stock",
    specs: {},
    fullSpecs: {},
    ...overrides,
  };
}

function alert(overrides: Partial<ProductAlert> = {}): ProductAlert {
  return {
    id: "alert-1",
    product_id: 1,
    kind: "price_drop",
    baseline_price: 4_000_000,
    baseline_stock: "In Stock",
    target_price: null,
    created_at: "2026-09-13T00:00:00.000Z",
    ...overrides,
  };
}

describe("back-in-stock alerts", () => {
  it("fires when an out-of-stock product returns", () => {
    const status = evaluateAlert(
      alert({ kind: "back_in_stock", baseline_stock: "Out of Stock" }),
      product({ stock: "In Stock" })
    );
    expect(status.triggered).toBe(true);
    expect(status.headline).toBe("Back in stock");
  });

  it("stays quiet while the product is still unavailable", () => {
    const status = evaluateAlert(
      alert({ kind: "back_in_stock", baseline_stock: "Out of Stock" }),
      product({ stock: "Out of Stock" })
    );
    expect(status.triggered).toBe(false);
    expect(status.headline).toBe("Still out of stock");
  });

  it("does not call it news when it was in stock all along", () => {
    const status = evaluateAlert(
      alert({ kind: "back_in_stock", baseline_stock: "In Stock" }),
      product({ stock: "In Stock" })
    );
    expect(status.triggered).toBe(false);
  });
});

describe("price-drop alerts", () => {
  it("fires when the price falls, with the saving and percentage", () => {
    const status = evaluateAlert(
      alert({ baseline_price: 4_000_000 }),
      product({ price: 3_000_000 })
    );
    expect(status.triggered).toBe(true);
    expect(status.headline).toBe("Price dropped 25%");
    expect(status.savings).toBe(1_000_000);
    expect(status.detail).toContain("MMK 1,000,000");
  });

  it("NEVER treats a pending price as a drop to zero", () => {
    const status = evaluateAlert(
      alert({ baseline_price: 4_000_000 }),
      product({ price: 0 })
    );
    expect(status.triggered).toBe(false);
    expect(status.savings).toBeNull();
    expect(status.headline).toBe("Price not published");
  });

  it("announces a price appearing, but does not call it a discount", () => {
    const status = evaluateAlert(
      alert({ baseline_price: 0 }),
      product({ price: 4_000_000 })
    );
    expect(status.triggered).toBe(true);
    expect(status.headline).toBe("Price now available");
    expect(status.savings).toBeNull();
  });

  it("stays quiet when the price is unchanged", () => {
    const status = evaluateAlert(
      alert({ baseline_price: 4_000_000 }),
      product({ price: 4_000_000 })
    );
    expect(status.triggered).toBe(false);
    expect(status.headline).toBe("Same price");
  });

  it("reports a rise honestly instead of hiding it", () => {
    const status = evaluateAlert(
      alert({ baseline_price: 3_000_000 }),
      product({ price: 3_500_000 })
    );
    expect(status.triggered).toBe(false);
    expect(status.headline).toBe("Price went up");
  });

  it("waits for the customer's target price before firing", () => {
    const waiting = evaluateAlert(
      alert({ baseline_price: 5_000_000, target_price: 3_000_000 }),
      product({ price: 4_000_000 })
    );
    expect(waiting.triggered).toBe(false);
    expect(waiting.headline).toBe("Waiting for your price");
    expect(waiting.detail).toContain("MMK 3,000,000");

    const reached = evaluateAlert(
      alert({ baseline_price: 5_000_000, target_price: 3_000_000 }),
      product({ price: 2_900_000 })
    );
    expect(reached.triggered).toBe(true);
    expect(reached.savings).toBe(2_100_000);
  });
});

describe("helpers", () => {
  it("snapshots the product state when following starts", () => {
    expect(alertBaseline(product({ price: 4_000_000, stock: "Out of Stock" }))).toEqual({
      baseline_price: 4_000_000,
      baseline_stock: "Out of Stock",
    });
  });

  it("stores a pending price as zero rather than a negative or NaN", () => {
    expect(alertBaseline(product({ price: 0 })).baseline_price).toBe(0);
  });

  it("only offers a back-in-stock alert when the product is unavailable", () => {
    expect(suggestedAlertKinds(product({ stock: "In Stock" }))).toEqual(["price_drop"]);
    expect(suggestedAlertKinds(product({ stock: "Out of Stock" }))).toEqual([
      "back_in_stock",
      "price_drop",
    ]);
  });

  it("collects only the alerts that have news", () => {
    const news = triggeredAlerts([
      { ...alert({ id: "a", baseline_price: 4_000_000 }), product: product({ price: 3_000_000 }) },
      { ...alert({ id: "b", baseline_price: 4_000_000 }), product: product({ price: 4_000_000 }) },
      {
        ...alert({ id: "c", kind: "back_in_stock", baseline_stock: "Out of Stock" }),
        product: product({ stock: "In Stock" }),
      },
    ]);
    expect(news.map((entry) => entry.alert.id)).toEqual(["a", "c"]);
  });
});
