import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DeliveryEstimateBadge from "../app/components/DeliveryEstimateBadge";
import {
  APHRODITE_STORE_LOCATION,
  deliveryDateRange,
  distanceFromStoreKm,
  estimateDelivery,
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
