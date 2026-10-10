import { describe, expect, it } from "vitest";
import {
  companyDetailsSchema, DEFAULT_WHOLESALE_RULES, invoiceKind, invoiceNumber, licenceRequired, poNumberSchema,
  rulesFromSetting, sellerDetails, wholesaleOrderProblem, wholesaleRulesSchema,
} from "../app/lib/company";

describe("company details", () => {
  it("needs an address; everything else is optional and blank becomes null", () => {
    expect(companyDetailsSchema.safeParse({ address: "x" }).success).toBe(false);
    const ok = companyDetailsSchema.parse({ address: "No. 9 Shwe Taung Tan Road", tax_id: "  ", billing_email: "" });
    expect(ok).toMatchObject({ tax_id: null, billing_email: null, billing_name: null });
  });
  it("rejects a malformed billing email", () => {
    expect(companyDetailsSchema.safeParse({ address: "No. 9 Shwe Taung Tan", billing_email: "nope" }).success).toBe(false);
  });
});

describe("licence gate and PO number", () => {
  it("is off unless explicitly switched on", () => {
    expect(licenceRequired({})).toBe(false);
    expect(licenceRequired({ WHOLESALE_REQUIRE_LICENCE: "TRUE" })).toBe(true);
    expect(licenceRequired({ WHOLESALE_REQUIRE_LICENCE: "yes" })).toBe(false);
  });
  it("trims a PO number, turns blank into null, and caps the length", () => {
    expect(poNumberSchema.parse("  PO-2026-001 ")).toBe("PO-2026-001");
    expect(poNumberSchema.parse("   ")).toBeNull();
    expect(poNumberSchema.parse(undefined)).toBeNull();
    expect(poNumberSchema.safeParse("x".repeat(61)).success).toBe(false);
  });
});

describe("wholesale order rules", () => {
  const rules = { minAmount: 500_000, minUnits: 3, prepayRequired: true };
  const base = { total: 800_000, units: 5, paymentMethod: "bank_transfer" };

  it("accepts an order that meets every rule", () => {
    expect(wholesaleOrderProblem(rules, base)).toBeNull();
  });
  it("explains a minimum amount shortfall", () => {
    expect(wholesaleOrderProblem(rules, { ...base, total: 450_000 })).toMatch(/start at MMK 500,000.*50,000 more/);
  });
  it("explains a minimum units shortfall", () => {
    expect(wholesaleOrderProblem(rules, { ...base, units: 2 })).toMatch(/at least 3 items.*1 more/);
  });
  it("makes wholesale pay first by bank transfer", () => {
    expect(wholesaleOrderProblem(rules, { ...base, paymentMethod: "cash_on_delivery" })).toMatch(/bank transfer/);
    expect(wholesaleOrderProblem(rules, { ...base, paymentMethod: "mmqr" })).toMatch(/bank transfer/);
    expect(wholesaleOrderProblem({ ...rules, prepayRequired: false }, { ...base, paymentMethod: "cash_on_delivery" })).toBeNull();
  });
  it("a zero minimum means no minimum", () => {
    expect(wholesaleOrderProblem({ minAmount: 0, minUnits: 0, prepayRequired: false }, { total: 1, units: 1, paymentMethod: "cash_on_delivery" })).toBeNull();
  });
  it("reads saved settings safely, with pay-first on by default", () => {
    expect(rulesFromSetting(undefined)).toEqual(DEFAULT_WHOLESALE_RULES);
    expect(DEFAULT_WHOLESALE_RULES.prepayRequired).toBe(true);
    expect(rulesFromSetting({ min_amount: 100, min_units: "x", prepay_required: false })).toEqual({ minAmount: 100, minUnits: 0, prepayRequired: false });
    expect(rulesFromSetting({ min_amount: -5 }).minAmount).toBe(0);
  });
  it("validates what an admin saves", () => {
    expect(wholesaleRulesSchema.safeParse({ min_amount: 1000, min_units: 2, prepay_required: true }).success).toBe(true);
    expect(wholesaleRulesSchema.safeParse({ min_amount: -1, min_units: 2, prepay_required: true }).success).toBe(false);
    expect(wholesaleRulesSchema.safeParse({ min_amount: 1.5, min_units: 2, prepay_required: true }).success).toBe(false);
  });
});

describe("proforma and invoice", () => {
  it("is a proforma until the payment is verified", () => {
    expect(invoiceKind({ status: "pending", payment_method: "bank_transfer", payment_verification_status: "pending" })).toBe("proforma");
    expect(invoiceKind({ status: "pending", payment_method: "bank_transfer", payment_verification_status: "rejected" })).toBe("proforma");
  });
  it("becomes an invoice once verified, or once delivered and collected", () => {
    expect(invoiceKind({ status: "confirmed", payment_method: "bank_transfer", payment_verification_status: "verified" })).toBe("invoice");
    expect(invoiceKind({ status: "delivered", payment_method: "cash_on_delivery", payment_status: "collected" })).toBe("invoice");
  });
  it("numbers them predictably", () => {
    const order = { id: "c0a1ce22-0000-4000-8000-000000000001", receipt_number: "R-2026-0001" };
    expect(invoiceNumber(order, "proforma")).toBe("PRO-C0A1CE22");
    expect(invoiceNumber(order, "invoice")).toBe("INV-R-2026-0001");
    expect(invoiceNumber({ id: order.id }, "invoice")).toBe("INV-C0A1CE22");
  });
  it("prints a tax number only when one is configured", () => {
    const base = { name: "Aphrodite Myanmar", address: "Yangon", phones: ["09420082522"] };
    expect(sellerDetails(base, {}).taxId).toBeNull();
    expect(sellerDetails(base, { SELLER_TAX_ID: " 123-456 " }).taxId).toBe("123-456");
    expect(sellerDetails(base, { SELLER_NAME: "Aphrodite Co., Ltd." }).name).toBe("Aphrodite Co., Ltd.");
  });
});
