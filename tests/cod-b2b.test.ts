import { describe, expect, it } from "vitest";
import { codReviewError, codReviewSignals } from "../app/lib/cod-verification";
import { readSheetWholesale } from "../app/lib/google-sheets";
import { isWholesaleApproved, priceLine } from "../app/lib/pricing";
import { adminDeliveryUpdateSchema, wholesaleAccountUpdateSchema } from "../app/lib/validation";

describe("COD staff review", () => {
  const checked = { verification_status: "approved", callback_confirmed: true, address_confirmed: true, verification_note: "Called recipient and verified address and order total." };
  it("requires callback, address and a meaningful note", () => {
    expect(codReviewError(checked)).toBeNull();
    expect(codReviewError({ ...checked, callback_confirmed: false })).toMatch(/Call/);
    expect(codReviewError({ ...checked, address_confirmed: false })).toMatch(/address/);
    expect(codReviewError({ ...checked, verification_note: "yes" })).toMatch(/note/);
  });
  it("does not label a deposit verified in the cash-only workflow", () => {
    expect(codReviewError({ ...checked, verification_status: "deposit_verified" })).toMatch(/cash-only/);
  });
  it("blocks fulfilment events until approved and requires tracking", () => {
    expect(codReviewError({ ...checked, verification_status: "pending", stage: "packed" })).toMatch(/Approve/);
    expect(codReviewError({ ...checked, stage: "in_transit" })).toMatch(/courier/);
    expect(codReviewError({ ...checked, stage: "in_transit", courier_name: "Courier", tracking_number: "REF123" })).toBeNull();
  });
  it("does not treat a pin or cancelled order as identity proof/fraud", () => {
    const signals = codReviewSignals({ total: 2000000, delivered: 0, open: 1, cancelled: 1, hasPin: false }).join(" ");
    expect(signals).toMatch(/not fraud/); expect(signals).toMatch(/not identity proof/);
  });
  it("rejects malformed ETA and timeline title omissions", () => {
    expect(adminDeliveryUpdateSchema.safeParse({ action: "update_delivery", ...checked, estimated_delivery_at: "tomorrow" }).success).toBe(false);
    expect(adminDeliveryUpdateSchema.safeParse({ action: "update_delivery", ...checked, stage: "packed" }).success).toBe(false);
  });
});

describe("B2B sheet pricing", () => {
  const headers = ["wholesale_price_mmk", "wholesale_min_qty", "wholesale_status"];
  it("preserves legacy tiers when columns are absent, disables incomplete terms", () => {
    expect(readSheetWholesale([], [], 100000)).toBeUndefined();
    expect(readSheetWholesale(headers, [95000,3,"enabled"],0)).toBeNull();
    for (const row of [[95000,2,"enabled"],[105000,3,"enabled"],[95000,3,"pending"],["",3,"enabled"]]) expect(readSheetWholesale(headers,row,100000)).toBeNull();
  });
  it("recognizes the approved 5% price and three-unit minimum", () => {
    expect(readSheetWholesale(headers,[95000,3,"enabled"],100000)).toEqual({unitPrice:95000,minQuantity:3});
    const tiers=[{ id:"t",price_list_id:"l",product_id:1,min_quantity:3,unit_price:95000,is_active:true,effective_from:null,effective_to:null }];
    expect(priceLine({retailPrice:100000,quantity:2,tiers}).unitPrice).toBe(100000);
    expect(priceLine({retailPrice:100000,quantity:3,tiers}).lineTotal).toBe(285000);
    expect(priceLine({retailPrice:100000,quantity:3,tiers:[]}).lineTotal).toBe(300000);
  });
  it("requires verified business plus approved role and list", () => {
    const profile={role:"wholesale",wholesale_status:"approved",price_list_id:"l",business_verified_at:"2026-09-03T00:00:00Z"};
    expect(isWholesaleApproved(profile)).toBe(true);
    expect(isWholesaleApproved({...profile,business_verified_at:null})).toBe(false);
    expect(isWholesaleApproved({...profile,role:"normal"})).toBe(false);
    expect(isWholesaleApproved({...profile,wholesale_status:"suspended"})).toBe(false);
    expect(wholesaleAccountUpdateSchema.safeParse({action:"grant"}).success).toBe(false);
  });
});
