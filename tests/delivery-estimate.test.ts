import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DeliveryEstimateBadge from "../app/components/DeliveryEstimateBadge";
import {
  APHRODITE_STORE_LOCATION,
  deliveryDateRange,
  distanceFromStoreKm,
  estimateDelivery,
  productDeliveryEstimate,
} from "../app/lib/delivery-estimate";

describe("saved-address delivery estimates", () => {
  it("uses the supplied Aphrodite Myanmar store location as the origin", () => {
    expect(distanceFromStoreKm(
      APHRODITE_STORE_LOCATION.latitude,
      APHRODITE_STORE_LOCATION.longitude
    )).toBeCloseTo(0, 6);
  });

  it("estimates 2–3 days nearby and 3–5 days farther away", () => {
    expect(estimateDelivery(16.8409, 96.1735, "South Okkalapa")).toMatchObject({
      minDays: 2,
      maxDays: 3,
      township: "South Okkalapa",
    });
    expect(estimateDelivery(17.103, 96.225, "Hlegu")).toMatchObject({
      minDays: 3,
      maxDays: 5,
      township: "Hlegu",
    });
  });

  it("formats the customer-facing estimated arrival window", () => {
    const estimate = estimateDelivery(16.8409, 96.1735, "South Okkalapa");
    expect(deliveryDateRange(estimate, new Date("2026-09-24T12:00:00+06:30"))).toBe("Sep 26–27");
  });

  it("shows the estimate only when a saved-default estimate exists", () => {
    expect(renderToStaticMarkup(React.createElement(DeliveryEstimateBadge, { estimate: null }))).toBe("");
    const estimate = estimateDelivery(16.8409, 96.1735, "South Okkalapa");
    const html = renderToStaticMarkup(React.createElement(DeliveryEstimateBadge, { estimate, compact: true }));
    expect(html).toContain("Estimated delivery");
    expect(html).toContain("2–3 days");
    expect(html).toContain("South Okkalapa Township");
  });
});


describe("sheet stock locations", () => {
  const nearby = estimateDelivery(16.8409, 96.1735, "South Okkalapa");
  const product = (locations: { status: string; quantity: number }[]) => ({ fullSpecs: { deliveryStockLocations: locations } });
  it("uses ten days for BKK stock regardless of saved address distance", () => {
    expect(productDeliveryEstimate(product([{ status: " BKK ", quantity: 1 }]), nearby)).toMatchObject({ minDays: 10, maxDays: 10, township: "South Okkalapa" });
    expect(productDeliveryEstimate(product([{ status: "bkk", quantity: 1 }]), null)).toMatchObject({ minDays: 10, maxDays: 10 });
    const estimate = productDeliveryEstimate(product([{ status: "BKK", quantity: 1 }]), nearby)!;
    expect(deliveryDateRange(estimate, new Date("2026-11-10T12:00:00"))).toBe("Nov 20");
    const html = renderToStaticMarkup(React.createElement(DeliveryEstimateBadge, { estimate: nearby, product: product([{ status: "BKK", quantity: 1 }]) }));
    expect(html).toContain("(10 days)");
    expect(html).not.toContain("10–10");
  });
  it("uses saved address estimates for YGN APD and main warehouse", () => {
    for (const status of ["YGN APD", "Mainwarehouse", "main APD", "Upcoming"]) {
      expect(productDeliveryEstimate(product([{ status, quantity: 1 }]), nearby)).toBe(nearby);
    }
    const far = estimateDelivery(17.103, 96.225, "Hlegu");
    expect(productDeliveryEstimate(product([{ status: "YGN APD", quantity: 1 }]), far)?.maxDays).toBe(5);
    expect(productDeliveryEstimate(undefined, null)).toBeNull();
  });
  it("considers available rows in a pool, with a conservative ten days for mixed available origins", () => {
    expect(productDeliveryEstimate(product([{ status: "BKK", quantity: 0 }, { status: "YGN APD", quantity: 1 }]), nearby)).toBe(nearby);
    expect(productDeliveryEstimate(product([{ status: "BKK", quantity: 1 }, { status: "YGN APD", quantity: 1 }]), nearby)?.maxDays).toBe(10);
  });
});
