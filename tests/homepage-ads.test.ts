import { describe, expect, it } from "vitest";
import {
  HOMEPAGE_AD_PLACEMENTS,
  isHomepageAdPlacement,
  normalizeHomepageAdPlacement,
} from "../app/lib/homepage-ads";

describe("homepage advertisement placements", () => {
  it("recognizes every supported storefront placement", () => {
    expect(HOMEPAGE_AD_PLACEMENTS.every(isHomepageAdPlacement)).toBe(true);
  });

  it("keeps legacy manifest advertisements in the main hero", () => {
    expect(normalizeHomepageAdPlacement(undefined)).toBe("hero");
    expect(normalizeHomepageAdPlacement("unknown-slot")).toBe("hero");
  });

  it("preserves the two inline placements", () => {
    expect(normalizeHomepageAdPlacement("before_laptops")).toBe("before_laptops");
    expect(normalizeHomepageAdPlacement("before_help")).toBe("before_help");
  });
});
