import { effectiveProductPrice } from "./promotions";
import type { Product } from "../data/products";
import { formatCurrency } from "./format";

/**
 * Back-in-stock and price-drop alerts.
 *
 * Pure module, no React and no fetch, so every rule is unit testable.
 *
 * How an alert fires: when the customer starts following a product we store a
 * BASELINE of its price and stock. The storefront compares that baseline with
 * the live product row, and the catalogue synchronizer uses the same rule for
 * email. After a successful email it moves the baseline forward, preventing a
 * duplicate notification while keeping the watch active for the next change.
 *
 * The trap this file exists to avoid: a price of 0 means "Price pending" in
 * this catalogue, NOT free. Comparing it as a number would fire a bogus
 * "price dropped to MMK 0" alert, so pending prices are handled explicitly.
 */

export type AlertKind = "back_in_stock" | "price_drop";

export type ProductAlert = {
  id: string;
  product_id: number;
  kind: AlertKind;
  baseline_price: number;
  baseline_stock: Product["stock"];
  target_price: number | null;
  created_at: string;
};

export type AlertStatus = {
  /** True when there is good news to show the customer. */
  triggered: boolean;
  /** Short banner line. */
  headline: string;
  /** One plain sentence explaining the current state. */
  detail: string;
  /** Money saved since following, for a fired price-drop alert. */
  savings: number | null;
};

export const ALERT_LABELS: Record<AlertKind, string> = {
  back_in_stock: "Tell me when it is back in stock",
  price_drop: "Tell me when the price drops",
};

function pricePending(price: number) {
  return !Number.isFinite(price) || price <= 0;
}

function backInStockStatus(
  alert: ProductAlert,
  product: Product
): AlertStatus {
  if (product.stock === "In Stock") {
    // Following an item that was already in stock is not news.
    if (alert.baseline_stock === "In Stock") {
      return {
        triggered: false,
        headline: "In stock",
        detail: "This was in stock when you followed it, and still is.",
        savings: null,
      };
    }

    return {
      triggered: true,
      headline: "Back in stock",
      detail: "This is available again. Order now while it lasts.",
      savings: null,
    };
  }

  return {
    triggered: false,
    headline: "Still out of stock",
    detail: "We will show you here as soon as it is available again.",
    savings: null,
  };
}

function priceDropStatus(alert: ProductAlert, product: Product): AlertStatus {
  // 0 means the price is not published yet, never that the product is free.
  if (pricePending(effectiveProductPrice(product))) {
    return {
      triggered: false,
      headline: "Price not published",
      detail: "This product has no price yet. Ask us for a quote.",
      savings: null,
    };
  }

  if (pricePending(alert.baseline_price)) {
    // Followed while the price was pending, and now there is one. That is
    // worth telling them, but it is an announcement, not a discount.
    return {
      triggered: true,
      headline: "Price now available",
      detail: `This product now has a price: ${formatCurrency(effectiveProductPrice(product))}.`,
      savings: null,
    };
  }

  const saving = alert.baseline_price - effectiveProductPrice(product);

  if (alert.target_price !== null && effectiveProductPrice(product) > alert.target_price) {
    return {
      triggered: false,
      headline: "Waiting for your price",
      detail: `Now ${formatCurrency(effectiveProductPrice(product))}. We will alert you at ${formatCurrency(
        alert.target_price
      )} or less.`,
      savings: null,
    };
  }

  if (saving > 0) {
    const percent = Math.round((saving / alert.baseline_price) * 100);
    return {
      triggered: true,
      headline: `Price dropped ${percent}%`,
      detail: `Down from ${formatCurrency(alert.baseline_price)} to ${formatCurrency(
        effectiveProductPrice(product)
      )} — you save ${formatCurrency(saving)}.`,
      savings: saving,
    };
  }

  if (saving < 0) {
    return {
      triggered: false,
      headline: "Price went up",
      detail: `Now ${formatCurrency(effectiveProductPrice(product))}, up from ${formatCurrency(
        alert.baseline_price
      )} when you followed it.`,
      savings: null,
    };
  }

  return {
    triggered: false,
    headline: "Same price",
    detail: `Still ${formatCurrency(effectiveProductPrice(product))}. We will tell you if it drops.`,
    savings: null,
  };
}

/** Current state of one alert against the product's live row. */
export function evaluateAlert(
  alert: ProductAlert,
  product: Product
): AlertStatus {
  return alert.kind === "back_in_stock"
    ? backInStockStatus(alert, product)
    : priceDropStatus(alert, product);
}

/** The baseline to store when a customer starts following a product. */
export function alertBaseline(product: Product) {
  return {
    baseline_price: Math.max(0, Math.round(effectiveProductPrice(product) || 0)),
    baseline_stock: product.stock,
  };
}

/**
 * Which alert kinds are worth offering for this product.
 *
 * An in-stock product does not need a back-in-stock alert, and a product with
 * no published price cannot have a price-drop target.
 */
export function suggestedAlertKinds(product: Product): AlertKind[] {
  const kinds: AlertKind[] = [];
  if (product.stock !== "In Stock") kinds.push("back_in_stock");
  kinds.push("price_drop");
  return kinds;
}

/** Alerts with news, newest first -- what the customer should see at the top. */
export function triggeredAlerts(
  alerts: (ProductAlert & { product: Product })[]
) {
  return alerts
    .map((alert) => ({ alert, status: evaluateAlert(alert, alert.product) }))
    .filter((entry) => entry.status.triggered);
}
