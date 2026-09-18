import { describe, expect, it } from "vitest";
import { activePromotion, discountPercent, effectiveProductPrice, parsePromotionDate } from "../app/lib/promotions";
import { parseProductionSheets, readSheetPromotion, type ProductionSheetsValues } from "../app/lib/google-sheets";
import { priceLine, type PriceTierRow } from "../app/lib/pricing";
import { filterAndSortProducts, EMPTY_PRODUCT_FILTERS } from "../app/lib/product-filters";
import { variantOptions } from "../app/lib/product-variants";
import type { Product } from "../app/data/products";

const now = new Date("2026-10-01T00:00:00Z");
const promo = { price: 1500000, startsAt: null, endsAt: null };
const headers = ["promo_price_mmk", "promo_start", "promo_end"];
const tier: PriceTierRow = { id: "tier", price_list_id: "list", product_id: 1, min_quantity: 3, unit_price: 1800000, is_active: true, effective_from: null, effective_to: null };
function product(id: number, price: number, promotion: unknown = null): Product {
  return { id, name: "Laptop", type: "laptop", category: "Laptop", brand: "HP", price, image: "/test.png", stock: "In Stock", specs: {}, fullSpecs: { promotion, variant: { group: "1234567890abcdef", model: "Laptop", label: String(id) } } };
}

describe("promotion import and timing", () => {
  it("reads whole MMK prices and Myanmar dates", () => {
    expect(readSheetPromotion(headers, [1500000, "2026-10-01 00:00", "2026-10-07 23:59"], 2000000)).toEqual({ price: 1500000, startsAt: "2026-09-30T17:30:00.000Z", endsAt: "2026-10-07T17:29:00.000Z" });
    const serial = (Date.UTC(2026, 9, 1, 12, 30) - Date.UTC(1899, 11, 30)) / 86400000;
    expect(parsePromotionDate(serial)).toBe("2026-10-01T06:00:00.000Z");
    expect(parsePromotionDate("2026-10-01T06:00:00Z")).toBe("2026-10-01T06:00:00.000Z");
  });
  it("disables blank, invalid, free, fractional and non-discounting offers", () => {
    for (const price of ["", 0, -1, 1.5, "oops", 2000000, 2100000]) expect(readSheetPromotion(headers, [price], 2000000)).toBeNull();
    for (const date of ["garbage", "2026-02-30", "2026-10-01 25:00"]) expect(readSheetPromotion(headers, [1500000, date], 2000000)).toBeNull();
    expect(readSheetPromotion(headers, [1500000, "2026-10-02", "2026-10-01"], 2000000)).toBeNull();
    expect(readSheetPromotion([], [], 2000000)).toBeNull();
  });
  it("starts inclusively and expires exclusively, without another sync", () => {
    const offer = { ...promo, startsAt: now.toISOString(), endsAt: "2026-10-02T00:00:00Z" };
    expect(activePromotion(2000000, offer, new Date(now.getTime()-1))).toBeNull();
    expect(activePromotion(2000000, offer, now)?.price).toBe(1500000);
    expect(activePromotion(2000000, offer, new Date(offer.endsAt))).toBeNull();
    expect(activePromotion(2000000, { ...offer, endsAt: "invalid" }, now)).toBeNull();
  });
});

describe("promotion pricing", () => {
  it("charges retail customers the sale price and retains the regular price", () => {
    expect(priceLine({ retailPrice: 2000000, promotion: promo, quantity: 2, tiers: [], now })).toMatchObject({ unitPrice: 1500000, retailUnitPrice: 2000000, lineTotal: 3000000, savings: 1000000, promotional: true, tierId: null });
  });
  it("chooses the lower eligible price without stacking", () => {
    const quote = (unit_price: number) => priceLine({ retailPrice: 2000000, promotion: promo, quantity: 3, tiers: [{ ...tier, unit_price }], now });
    expect(quote(1800000)).toMatchObject({ unitPrice: 1500000, promotional: true, tierId: null, priceListId: null });
    expect(quote(1400000)).toMatchObject({ unitPrice: 1400000, promotional: false, tierId: "tier" });
    expect(quote(1500000)).toMatchObject({ unitPrice: 1500000, promotional: false, tierId: "tier" });
  });
  it("calculates percentage wholesale bands from regular retail", () => {
    expect(priceLine({ retailPrice: 2000000, promotion: promo, quantity: 3, tiers: [], productId: 1, percentBands: [{ id: "band", price_list_id: "list", product_id: null, min_quantity: 3, discount_percent: 10, is_active: true, effective_from: null, effective_to: null }], now }).unitPrice).toBe(1500000);
  });
  it("does not suggest a higher next-tier price", () => {
    expect(priceLine({ retailPrice: 2000000, promotion: promo, quantity: 1, tiers: [tier], now }).nextTier).toBeNull();
    expect(priceLine({ retailPrice: 2000000, promotion: promo, quantity: 1, tiers: [{ ...tier, unit_price: 1400000 }], now }).nextTier?.unitPrice).toBe(1400000);
  });
  it("uses the matching variant's regular price and discounts in filters", () => {
    const a = product(1, 2000000, promo), b = product(2, 1800000);
    expect(effectiveProductPrice(a)).toBe(1500000);
    expect(variantOptions([a,b])[0]).toMatchObject({ price: 1500000, regularPrice: 2000000 });
    expect(filterAndSortProducts([b,a], { ...EMPTY_PRODUCT_FILTERS, maxPrice: "1600000", sort: "price-asc" }).map(p=>p.id)).toEqual([1]);
    expect(discountPercent(2000000, 1500000)).toBe(25);
    expect(discountPercent(1999, 1499)).toBe(25);
  });
});

function workbook(): ProductionSheetsValues {
  return {
    Laptops: [["Pur No", "Brand", "Model No", "Model", "Specs Detail", "Warranty", "Qty", "Retail Price MMK", ...headers], ["1", "HP", "m", "HP Laptop", "16 GB RAM", "", 1, 2000000, 1500000]],
    Accessories: [["Pur no", "Category", "Brand", "Model No", "Model", "Specs", "Warranty", "ClosingQty", "Retail Price MMK", ...headers], ["2", "Mouse", "HP", "m", "Mouse", "Wireless", "", 1, 20000, 15000]],
    "PC Parts": [["Pur no", "Category", "Brand", "Description", "ClosingQty", "Retail Price MMK", ...headers], ["3", "SSD", "HP", "SSD", 1, 200000, 150000]],
  };
}

describe("sheet sync promotion propagation", () => {
  it("imports all product tabs and clearing the cell removes an offer", () => {
    const values = workbook();
    const imported = parseProductionSheets(values).products;
    expect(imported).toHaveLength(3);
    for (const p of imported) expect((p.fullSpecs.promotion as {price:number}).price).toBe(p.price * .75);
    values.Laptops[1][8] = "";
    expect(parseProductionSheets(values).products.find(p=>p.sourceSheet==="Laptops")?.fullSpecs.promotion).toBeNull();
  });
  it("disables conflicting duplicate offers without losing stock", () => {
    const values = workbook(); values.Laptops.push([...values.Laptops[1]]); values.Laptops[2][8] = 1600000;
    const p = parseProductionSheets(values).products.find(p=>p.sourceSheet==="Laptops")!;
    expect(p.stockQuantity).toBe(2); expect(p.fullSpecs.promotion).toBeNull();
  });
  it("keeps different spec variants' offers separate", () => {
    const values = workbook(); values.Laptops.push([...values.Laptops[1]]); values.Laptops[2][4] = "32 GB RAM"; values.Laptops[2][8] = 1600000;
    const products = parseProductionSheets(values).products.filter(p=>p.sourceSheet==="Laptops");
    expect(products.map(p=>(p.fullSpecs.promotion as {price:number}).price).sort()).toEqual([1500000,1600000]);
  });
});
