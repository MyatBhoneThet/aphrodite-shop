import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../app/lib/supabase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/supabase")>()),
  selectCompanyDetails: vi.fn(),
  upsertCompanyDetails: vi.fn(),
  uploadBusinessLicenceObject: vi.fn(),
  deleteBusinessLicenceObject: vi.fn(),
  createBusinessLicenceSignedUrl: vi.fn(),
  selectShopSetting: vi.fn(),
  upsertShopSetting: vi.fn(),
  selectProfileByIdService: vi.fn(),
  selectOrderById: vi.fn(),
  insertAuditLog: vi.fn(),
}));

import {
  adminGetCompany, adminReviewLicence, getInvoice, getOwnCompany, getWholesaleRules, resetWholesaleRulesCache,
  saveOwnCompany, saveWholesaleRules, uploadOwnLicence,
} from "../app/lib/wholesale-b2b";
import * as db from "../app/lib/supabase";
import type { CurrentUser } from "../app/lib/supabase";

const user = (role: "admin" | "staff" | "wholesale" | "normal", id = "u1") =>
  ({ id, role, email: `${role}@x.com`, accessToken: "t", profile: { id, role, business_name: "Mya Computers" } }) as unknown as CurrentUser;
const file = (type = "application/pdf", size = 1000, name = "licence.pdf") =>
  new File([new Uint8Array(size)], name, { type });

const company = (over: Record<string, unknown> = {}) => ({
  user_id: "u1", tax_id: "TIN-1", address: "No. 5, Yangon", billing_name: null, billing_phone: null, billing_email: null,
  licence_status: "none", licence_path: null, licence_file_name: null, licence_content_type: null, licence_submitted_at: null,
  licence_reviewed_at: null, licence_reviewed_by: null, licence_review_note: null, updated_at: "2026-10-10T00:00:00Z", ...over,
});

beforeEach(() => {
  vi.resetAllMocks();
  resetWholesaleRulesCache();
  vi.mocked(db.insertAuditLog).mockResolvedValue(undefined);
  vi.mocked(db.selectCompanyDetails).mockResolvedValue(company() as never);
  vi.mocked(db.upsertCompanyDetails).mockImplementation(async (_id, fields) => ({ ...company(), ...fields }) as never);
  vi.mocked(db.selectShopSetting).mockResolvedValue(null);
});

describe("company details", () => {
  it("are for wholesale accounts only", async () => {
    await expect(getOwnCompany(user("normal"))).rejects.toMatchObject({ status: 403 });
    await expect(saveOwnCompany(user("normal"), { address: "No. 5, Yangon" })).rejects.toMatchObject({ status: 403 });
  });

  it("never expose the licence file path to the buyer", async () => {
    vi.mocked(db.selectCompanyDetails).mockResolvedValue(company({ licence_status: "pending", licence_path: "u1/secret-file.pdf", licence_file_name: "licence.pdf" }) as never);
    const result = await getOwnCompany(user("wholesale"));
    expect(JSON.stringify(result)).not.toContain("secret-file");
    expect(result.licence).toMatchObject({ status: "pending", file_name: "licence.pdf" });
    expect(result.business_name).toBe("Mya Computers");
  });

  it("saves valid details and refuses a missing address", async () => {
    await saveOwnCompany(user("wholesale"), { address: "No. 5, Yangon", tax_id: " TIN-9 " });
    expect(db.upsertCompanyDetails).toHaveBeenCalledWith("u1", expect.objectContaining({ tax_id: "TIN-9", address: "No. 5, Yangon" }));
    await expect(saveOwnCompany(user("wholesale"), { address: "" })).rejects.toMatchObject({ status: 400 });
  });
});

describe("business licence upload", () => {
  it("accepts a PDF, marks it pending and replaces the old file", async () => {
    vi.mocked(db.selectCompanyDetails).mockResolvedValue(company({ licence_status: "rejected", licence_path: "u1/old.pdf" }) as never);
    const result = await uploadOwnLicence(user("wholesale"), file());
    expect(db.uploadBusinessLicenceObject).toHaveBeenCalledWith(expect.stringMatching(/^u1\/.+licence\.pdf$/), expect.any(ArrayBuffer), "application/pdf");
    expect(db.upsertCompanyDetails).toHaveBeenCalledWith("u1", expect.objectContaining({ licence_status: "pending", licence_review_note: null }));
    expect(db.deleteBusinessLicenceObject).toHaveBeenCalledWith("u1/old.pdf");
    expect(result.status).toBe("pending");
  });

  it("refuses other file types and big files before storing anything", async () => {
    await expect(uploadOwnLicence(user("wholesale"), file("text/html", 100, "x.html"))).rejects.toMatchObject({ status: 400 });
    await expect(uploadOwnLicence(user("wholesale"), file("application/pdf", 11 * 1024 * 1024))).rejects.toMatchObject({ status: 400 });
    await expect(uploadOwnLicence(user("normal"), file())).rejects.toMatchObject({ status: 403 });
    expect(db.uploadBusinessLicenceObject).not.toHaveBeenCalled();
  });

  it("will not replace a licence an admin already verified", async () => {
    vi.mocked(db.selectCompanyDetails).mockResolvedValue(company({ licence_status: "verified", licence_path: "u1/ok.pdf" }) as never);
    await expect(uploadOwnLicence(user("wholesale"), file())).rejects.toMatchObject({ status: 409 });
  });
});

describe("licence review", () => {
  beforeEach(() => {
    vi.mocked(db.selectCompanyDetails).mockResolvedValue(company({ licence_status: "pending", licence_path: "u2/l.pdf" }) as never);
    vi.mocked(db.selectProfileByIdService).mockResolvedValue({ id: "u2", business_name: "Mya Computers" } as never);
    vi.mocked(db.createBusinessLicenceSignedUrl).mockResolvedValue("https://signed.example/l.pdf");
  });

  it("is admin-only", async () => {
    await expect(adminReviewLicence(user("staff"), "u2", { decision: "verify" })).rejects.toMatchObject({ status: 403 });
    await expect(adminGetCompany(user("staff"), "u2")).rejects.toMatchObject({ status: 403 });
    expect(db.upsertCompanyDetails).not.toHaveBeenCalled();
  });

  it("verifies, recording who and when", async () => {
    await adminReviewLicence(user("admin", "admin-1"), "u2", { decision: "verify" });
    expect(db.upsertCompanyDetails).toHaveBeenCalledWith("u2", expect.objectContaining({ licence_status: "verified", licence_reviewed_by: "admin-1" }));
    expect(db.insertAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "wholesale.licence.review", target_id: "u2" }));
  });

  it("makes the admin say why when rejecting", async () => {
    await expect(adminReviewLicence(user("admin"), "u2", { decision: "reject" })).rejects.toMatchObject({ status: 400 });
    await adminReviewLicence(user("admin"), "u2", { decision: "reject", note: "Photo is blurry" });
    expect(db.upsertCompanyDetails).toHaveBeenCalledWith("u2", expect.objectContaining({ licence_status: "rejected", licence_review_note: "Photo is blurry" }));
  });

  it("shows the admin a short-lived link to the file", async () => {
    const result = await adminGetCompany(user("admin"), "u2");
    expect(result.licence_url).toBe("https://signed.example/l.pdf");
  });

  it("cannot review an account with nothing uploaded", async () => {
    vi.mocked(db.selectCompanyDetails).mockResolvedValue(company() as never);
    await expect(adminReviewLicence(user("admin"), "u2", { decision: "verify" })).rejects.toMatchObject({ status: 409 });
  });
});

describe("wholesale rules setting", () => {
  it("defaults to pay-first with no minimum, and survives an unreadable table", async () => {
    expect(await getWholesaleRules()).toEqual({ minAmount: 0, minUnits: 0, prepayRequired: true });
    resetWholesaleRulesCache();
    vi.mocked(db.selectShopSetting).mockRejectedValue(new Error("relation shop_settings does not exist"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await getWholesaleRules()).prepayRequired).toBe(true);
    spy.mockRestore();
  });

  it("is saved by admins only, validated, audited, and takes effect immediately", async () => {
    await expect(saveWholesaleRules(user("staff"), { min_amount: 1, min_units: 1, prepay_required: true })).rejects.toMatchObject({ status: 403 });
    await expect(saveWholesaleRules(user("admin"), { min_amount: -1, min_units: 1, prepay_required: true })).rejects.toMatchObject({ status: 400 });
    await getWholesaleRules(); // warm the cache
    await saveWholesaleRules(user("admin", "admin-1"), { min_amount: 500000, min_units: 3, prepay_required: false });
    expect(db.upsertShopSetting).toHaveBeenCalledWith("wholesale_rules", { min_amount: 500000, min_units: 3, prepay_required: false }, "admin-1");
    expect(db.insertAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "wholesale.rules.update" }));
    vi.mocked(db.selectShopSetting).mockResolvedValue({ min_amount: 500000, min_units: 3, prepay_required: false });
    expect(await getWholesaleRules()).toEqual({ minAmount: 500000, minUnits: 3, prepayRequired: false });
  });
});

describe("invoice and proforma", () => {
  const order = (over: Record<string, unknown> = {}) => ({
    id: "c0a1ce22-0000-4000-8000-000000000001", user_id: "u1", status: "pending", total_amount: 960000, payment_method: "bank_transfer",
    payment_status: "unpaid", payment_verification_status: "pending", po_number: "PO-77", created_at: "2026-10-10T03:00:00Z", receipt_number: null,
    shipping_name: "Mya", shipping_phone: "0999", shipping_address: "No. 5, Yangon", confirmed_at: null, delivered_at: null,
    order_items: [{ product_id: 1, quantity: 2, unit_price: 480000, products: { name: "HP Elitebook" } }], ...over,
  });

  beforeEach(() => {
    vi.mocked(db.selectOrderById).mockResolvedValue(order() as never);
    vi.mocked(db.selectProfileByIdService).mockResolvedValue({ id: "u1", business_name: "Mya Computers", full_name: "Mya", email: "mya@x.com" } as never);
  });

  it("is for wholesale buyers and admins only", async () => {
    await expect(getInvoice(user("normal"), "o")).rejects.toMatchObject({ status: 403 });
    await expect(getInvoice(user("staff"), "o")).rejects.toMatchObject({ status: 403 });
  });

  it("is a proforma with the bank details until the payment is verified", async () => {
    const invoice = await getInvoice(user("wholesale"), "o");
    expect(invoice.kind).toBe("proforma");
    expect(invoice.number).toBe("PRO-C0A1CE22");
    expect(invoice.order.po_number).toBe("PO-77");
    expect(invoice.pay_to.length).toBeGreaterThan(0);
    expect(invoice.pay_to.every((account) => account.account_number)).toBe(true);
    expect(invoice.buyer).toMatchObject({ name: "Mya Computers", tax_id: "TIN-1" });
    expect(invoice.order.items).toEqual([{ name: "HP Elitebook", quantity: 2, unit_price: 480000 }]);
  });

  it("becomes a numbered invoice, with no payment details, once verified", async () => {
    vi.mocked(db.selectOrderById).mockResolvedValue(order({ status: "confirmed", payment_verification_status: "verified", receipt_number: "R-1", confirmed_at: "2026-10-11T02:00:00Z" }) as never);
    const invoice = await getInvoice(user("wholesale"), "o");
    expect(invoice.kind).toBe("invoice");
    expect(invoice.number).toBe("INV-R-1");
    expect(invoice.pay_to).toEqual([]);
    expect(invoice.issued_at).toBe("2026-10-11T02:00:00Z");
  });

  it("is not available for a cancelled or missing order", async () => {
    vi.mocked(db.selectOrderById).mockResolvedValue(order({ status: "cancelled" }) as never);
    await expect(getInvoice(user("wholesale"), "o")).rejects.toMatchObject({ status: 409 });
    vi.mocked(db.selectOrderById).mockResolvedValue(null as never);
    await expect(getInvoice(user("wholesale"), "o")).rejects.toMatchObject({ status: 404 });
  });
});
