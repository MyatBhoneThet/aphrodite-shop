import { describe, expect, it } from "vitest";
import {
  expandPercentBands,
  isTierEffective,
  isWholesaleApproved,
  priceLine,
  selectTier,
  type PercentBand,
  type PriceTierRow,
} from "../app/lib/pricing";

const NOW = new Date("2026-07-15T12:00:00Z");

function tier(overrides: Partial<PriceTierRow> = {}): PriceTierRow {
  return {
    id: "tier-1",
    price_list_id: "list-1",
    product_id: 1,
    min_quantity: 10,
    unit_price: 48_000,
    is_active: true,
    effective_from: null,
    effective_to: null,
    ...overrides,
  };
}

// The example ladder from the requirements:
// 1-9 retail 50,000 / 10-49: 48,000 / 50-99: 46,500 / 100+: 45,000
const RETAIL = 50_000;
const LADDER: PriceTierRow[] = [
  tier({ id: "t10", min_quantity: 10, unit_price: 48_000 }),
  tier({ id: "t50", min_quantity: 50, unit_price: 46_500 }),
  tier({ id: "t100", min_quantity: 100, unit_price: 45_000 }),
];

describe("wholesale entitlement", () => {
  const base = { role: "normal", wholesale_status: "not_applied", price_list_id: null };

  it("normal user is not entitled", () => {
    expect(isWholesaleApproved(base)).toBe(false);
  });

  it("any unknown or legacy status string is not entitled", () => {
    // Defense in depth: only the literal 'approved' grants entitlement, so a
    // stale value from an older schema (or a forged one) still means retail.
    for (const status of ["pending", "rejected", "APPROVED", "yes", ""]) {
      expect(isWholesaleApproved({ ...base, wholesale_status: status })).toBe(false);
    }
  });

  it("suspended account is not entitled", () => {
    expect(
      isWholesaleApproved({
        role: "wholesale",
        wholesale_status: "suspended",
        price_list_id: "list-1",
      })
    ).toBe(false);
  });

  it("approved account without an assigned price list is not entitled", () => {
    expect(
      isWholesaleApproved({
        role: "wholesale",
        wholesale_status: "approved",
        price_list_id: null,
      })
    ).toBe(false);
  });

  it("approved account with an assigned price list is entitled", () => {
    expect(
      isWholesaleApproved({
        role: "wholesale",
        wholesale_status: "approved",
        price_list_id: "list-1",
        business_verified_at: "2026-09-03T00:00:00Z",
      })
    ).toBe(true);
  });
});

describe("tier selection", () => {
  it("no tiers means retail", () => {
    const result = priceLine({ retailPrice: RETAIL, quantity: 500, tiers: [], now: NOW });

    expect(result.unitPrice).toBe(RETAIL);
    expect(result.tierId).toBeNull();
    expect(result.savings).toBe(0);
    expect(result.label).toBe("Retail price");
  });

  it("quantity immediately below a tier does not qualify", () => {
    const result = priceLine({ retailPrice: RETAIL, quantity: 9, tiers: LADDER, now: NOW });

    expect(result.unitPrice).toBe(RETAIL);
    expect(result.tierId).toBeNull();
    expect(result.wholesaleEligible).toBe(true);
    expect(result.nextTier).toEqual({
      minQuantity: 10,
      unitPrice: 48_000,
      unitsAway: 1,
    });
  });

  it("quantity exactly at a tier qualifies", () => {
    const result = priceLine({ retailPrice: RETAIL, quantity: 10, tiers: LADDER, now: NOW });

    expect(result.unitPrice).toBe(48_000);
    expect(result.tierId).toBe("t10");
    expect(result.tierMinQuantity).toBe(10);
  });

  it("quantity of exactly 100 qualifies for the min_quantity=100 tier", () => {
    const result = priceLine({ retailPrice: RETAIL, quantity: 100, tiers: LADDER, now: NOW });

    expect(result.unitPrice).toBe(45_000);
    expect(result.tierId).toBe("t100");
  });

  it("quantity above multiple tiers picks the highest qualifying one", () => {
    const result = priceLine({ retailPrice: RETAIL, quantity: 75, tiers: LADDER, now: NOW });

    expect(result.unitPrice).toBe(46_500);
    expect(result.tierId).toBe("t50");
    expect(result.nextTier).toEqual({
      minQuantity: 100,
      unitPrice: 45_000,
      unitsAway: 25,
    });
  });

  it("computes line total and savings", () => {
    const result = priceLine({ retailPrice: RETAIL, quantity: 50, tiers: LADDER, now: NOW });

    expect(result.lineTotal).toBe(46_500 * 50);
    expect(result.savings).toBe((RETAIL - 46_500) * 50);
    expect(result.label).toBe("Wholesale tier: 50+ units");
  });

  it("ignores inactive tiers", () => {
    const tiers = [
      tier({ id: "on", min_quantity: 10, unit_price: 48_000 }),
      tier({ id: "off", min_quantity: 50, unit_price: 40_000, is_active: false }),
    ];
    const result = priceLine({ retailPrice: RETAIL, quantity: 60, tiers, now: NOW });

    expect(result.tierId).toBe("on");
    expect(result.unitPrice).toBe(48_000);
  });

  it("ignores expired tiers", () => {
    const tiers = [
      tier({
        id: "expired",
        min_quantity: 10,
        unit_price: 40_000,
        effective_to: "2026-01-01T00:00:00Z",
      }),
    ];
    const result = priceLine({ retailPrice: RETAIL, quantity: 20, tiers, now: NOW });

    expect(result.tierId).toBeNull();
    expect(result.unitPrice).toBe(RETAIL);
  });

  it("ignores tiers that are not yet effective", () => {
    const tiers = [
      tier({
        id: "future",
        min_quantity: 10,
        unit_price: 40_000,
        effective_from: "2027-01-01T00:00:00Z",
      }),
    ];
    const result = priceLine({ retailPrice: RETAIL, quantity: 20, tiers, now: NOW });

    expect(result.tierId).toBeNull();
  });

  it("applies a tier inside its effective window", () => {
    const tiers = [
      tier({
        id: "windowed",
        min_quantity: 10,
        unit_price: 40_000,
        effective_from: "2026-07-01T00:00:00Z",
        effective_to: "2026-08-01T00:00:00Z",
      }),
    ];
    const result = priceLine({ retailPrice: RETAIL, quantity: 20, tiers, now: NOW });

    expect(result.tierId).toBe("windowed");
  });

  it("selectTier exposes applied and next tiers directly", () => {
    const { applied, next } = selectTier(LADDER, 49, NOW);

    expect(applied?.id).toBe("t10");
    expect(next?.id).toBe("t50");
  });

  it("isTierEffective handles boundaries", () => {
    expect(isTierEffective(tier({ effective_to: NOW.toISOString() }), NOW)).toBe(false);
    expect(isTierEffective(tier({ effective_from: NOW.toISOString() }), NOW)).toBe(true);
  });
});

// The shop's B2B ladder: 5-10 units 5% off, 11-30 units 10% off,
// 31+ units 15% off (raisable to 20% for an individual product).
describe("percentage bands (B2B ladder)", () => {
  const B2B_RETAIL = 100_000;

  function band(overrides: Partial<PercentBand> = {}): PercentBand {
    return {
      id: "band-1",
      price_list_id: "b2b",
      product_id: null,
      min_quantity: 5,
      discount_percent: 5,
      is_active: true,
      effective_from: null,
      effective_to: null,
      ...overrides,
    };
  }

  const LADDER_BANDS: PercentBand[] = [
    band({ id: "b5", min_quantity: 5, discount_percent: 5 }),
    band({ id: "b11", min_quantity: 11, discount_percent: 10 }),
    band({ id: "b31", min_quantity: 31, discount_percent: 15 }),
  ];

  function priceAt(quantity: number, bands = LADDER_BANDS) {
    return priceLine({
      retailPrice: B2B_RETAIL,
      quantity,
      tiers: [],
      percentBands: bands,
      productId: 1,
      now: NOW,
    });
  }

  it("below the first band the customer pays retail", () => {
    const result = priceAt(4);

    expect(result.unitPrice).toBe(B2B_RETAIL);
    expect(result.savings).toBe(0);
    expect(result.wholesaleEligible).toBe(true);
    expect(result.nextTier?.minQuantity).toBe(5);
  });

  it.each([
    [5, 95_000],
    [10, 95_000],
    [11, 90_000],
    [30, 90_000],
    [31, 85_000],
    [500, 85_000],
  ])("quantity %i costs %i per unit", (quantity, expected) => {
    expect(priceAt(quantity).unitPrice).toBe(expected);
  });

  it("a per-product band overrides the list-wide one at the same quantity", () => {
    const withOverride = [
      ...LADDER_BANDS,
      band({ id: "vip", min_quantity: 31, discount_percent: 20, product_id: 1 }),
    ];

    expect(priceAt(31, withOverride).unitPrice).toBe(80_000);
    // A different product keeps the standard 15%.
    expect(
      priceLine({
        retailPrice: B2B_RETAIL,
        quantity: 31,
        tiers: [],
        percentBands: withOverride,
        productId: 2,
        now: NOW,
      }).unitPrice
    ).toBe(85_000);
  });

  it("an explicit fixed-price tier wins over a band at the same quantity", () => {
    const fixed = [tier({ id: "fixed", min_quantity: 11, unit_price: 70_000 })];
    const result = priceLine({
      retailPrice: B2B_RETAIL,
      quantity: 11,
      tiers: fixed,
      percentBands: LADDER_BANDS,
      productId: 1,
      now: NOW,
    });

    expect(result.unitPrice).toBe(70_000);
    expect(result.tierId).toBe("fixed");
  });

  it("inactive and expired bands are ignored", () => {
    const stale = [
      band({ id: "off", min_quantity: 5, discount_percent: 50, is_active: false }),
      band({
        id: "gone",
        min_quantity: 11,
        discount_percent: 50,
        effective_to: "2026-01-01T00:00:00Z",
      }),
    ];

    expect(priceAt(20, stale).unitPrice).toBe(B2B_RETAIL);
  });

  it("no bands and no tiers means the account is not wholesale-eligible", () => {
    const result = priceLine({
      retailPrice: B2B_RETAIL,
      quantity: 50,
      tiers: [],
      percentBands: [],
      productId: 1,
      now: NOW,
    });

    expect(result.wholesaleEligible).toBe(false);
    expect(result.unitPrice).toBe(B2B_RETAIL);
  });

  it("rounds to whole MMK", () => {
    const [expanded] = expandPercentBands(
      9_999,
      [band({ min_quantity: 5, discount_percent: 15 })],
      1
    );

    expect(expanded.unit_price).toBe(Math.round(9_999 * 0.85));
    expect(Number.isInteger(expanded.unit_price)).toBe(true);
  });
});
