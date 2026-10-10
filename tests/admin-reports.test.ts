import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../app/lib/supabase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/supabase")>()),
  selectOrdersForExport: vi.fn(),
  selectSiteFeedback: vi.fn(),
  selectLowStockProducts: vi.fn(),
}));

import { buildExportCsv, getLowStockProducts, listSiteFeedback } from "../app/lib/admin-reports";
import * as db from "../app/lib/supabase";
import type { CurrentUser } from "../app/lib/supabase";

const freshMfa = { realRole: "admin", enrolled: true, aal: "aal2", pending: null, fresh: true, recentSignIn: true, factors: [] };
const user = (role: "admin" | "staff" | "normal", mfa: unknown = freshMfa) => ({ id: "u1", role, mfa } as unknown as CurrentUser);

const order = (over: Record<string, unknown>) => ({
  id: "o1", user_id: "c1", status: "delivered", total_amount: 1000, payment_method: "cash_on_delivery",
  payment_status: "collected", payment_account: null, created_at: "2026-09-24T15:30:00.000Z",
  delivered_at: "2026-09-26T05:00:00.000Z", receipt_number: "R-1", shipping_name: "Thukha Nyan",
  shipping_phone: "0954678667", shipping_address: "201 Ballika St", shipping_city: "South Okkalapa",
  courier_name: null, delivery_tracking_number: null,
  profiles: { email: "t@example.com", full_name: "Thukha" },
  order_items: [{ quantity: 2, unit_price: 500, products: { name: "HP Elitebook" } }],
  ...over,
});

beforeEach(() => vi.resetAllMocks());

describe("order and customer export", () => {
  it("is admin-only: staff and customers are refused", async () => {
    await expect(buildExportCsv(user("staff"), "orders", "2026-09-01", "2026-09-30")).rejects.toThrow();
    await expect(buildExportCsv(user("normal"), "orders", "2026-09-01", "2026-09-30")).rejects.toThrow();
    expect(db.selectOrdersForExport).not.toHaveBeenCalled();
  });

  it("needs a freshly confirmed password or code, and says so with a code the browser can act on", async () => {
    const stale = user("admin", { ...freshMfa, fresh: false });
    await expect(buildExportCsv(stale, "orders", "2026-09-01", "2026-09-30")).rejects.toMatchObject({ status: 403, code: "reauth_required" });
    expect(db.selectOrdersForExport).not.toHaveBeenCalled();
  });

  it("writes one row per order in Yangon time", async () => {
    vi.mocked(db.selectOrdersForExport).mockResolvedValue({ rows: [order({})] as never, truncated: false });
    const csv = await buildExportCsv(user("admin"), "orders", "2026-09-01", "2026-09-30");
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"2026-09-24 22:00"');
    expect(csv).toContain('"HP Elitebook x2"');
    expect(csv).toContain('"t@example.com"');
    expect(csv).toContain(",1000,");
    expect(db.selectOrdersForExport).toHaveBeenCalledWith("2026-08-31T17:30:00.000Z", "2026-09-30T17:30:00.000Z");
  });

  it("neutralises formulas typed into customer fields", async () => {
    vi.mocked(db.selectOrdersForExport).mockResolvedValue({ rows: [order({ shipping_name: "=1+1" })] as never, truncated: false });
    const csv = await buildExportCsv(user("admin"), "orders", "2026-09-01", "2026-09-30");
    expect(csv).toContain(`"'=1+1"`);
  });

  it("groups customers and leaves cancelled orders out of the spend", async () => {
    vi.mocked(db.selectOrdersForExport).mockResolvedValue({
      rows: [
        order({ id: "a", total_amount: 1000 }),
        order({ id: "b", total_amount: 500, created_at: "2026-09-25T03:00:00.000Z" }),
        order({ id: "c", total_amount: 9000, status: "cancelled" }),
        order({ id: "d", user_id: "c2", shipping_name: "Aye", profiles: { email: "a@example.com", full_name: "Aye" }, total_amount: 200 }),
      ] as never,
      truncated: false,
    });
    const csv = await buildExportCsv(user("admin"), "customers", "2026-09-01", "2026-09-30");
    const lines = csv.split("\r\n");
    const thukha = lines.find((line) => line.includes("t@example.com"))!;
    expect(thukha).toContain(',3,2,1500,'); // 3 orders placed, 2 completed sales, 1500 spent
    // biggest spender first
    expect(lines.findIndex((l) => l.includes("t@example.com"))).toBeLessThan(lines.findIndex((l) => l.includes("a@example.com")));
  });

  it("refuses ranges too large to export", async () => {
    vi.mocked(db.selectOrdersForExport).mockResolvedValue({ rows: [], truncated: true });
    await expect(buildExportCsv(user("admin"), "orders", "2026-09-01", "2026-09-30")).rejects.toThrow(/too many/i);
  });

  it("rejects an unknown kind and bad dates before touching the database", async () => {
    await expect(buildExportCsv(user("admin"), "everything", "2026-09-01", "2026-09-30")).rejects.toThrow();
    await expect(buildExportCsv(user("admin"), "orders", "nope", "2026-09-30")).rejects.toThrow();
    expect(db.selectOrdersForExport).not.toHaveBeenCalled();
  });
});

describe("low stock", () => {
  it("splits out-of-stock from running-low and lets staff read it", async () => {
    vi.mocked(db.selectLowStockProducts).mockResolvedValue([
      { id: 1, stock_quantity: 0 }, { id: 2, stock_quantity: 3 }, { id: 3, stock_quantity: null },
    ] as never);
    const result = await getLowStockProducts(user("staff"), "5");
    expect(result.threshold).toBe(5);
    expect(result.low.map((row) => row.id)).toEqual([2]);
    expect(result.outOfStock.map((row) => row.id)).toEqual([1, 3]);
  });

  it("validates the level and refuses customers", async () => {
    await expect(getLowStockProducts(user("admin"), "0")).rejects.toThrow();
    await expect(getLowStockProducts(user("admin"), "abc")).rejects.toThrow();
    await expect(getLowStockProducts(user("admin"), "999")).rejects.toThrow();
    await expect(getLowStockProducts(user("normal"), "5")).rejects.toThrow();
  });
});

describe("customer feedback", () => {
  it("is admin-only", async () => {
    await expect(listSiteFeedback(user("staff"))).rejects.toThrow();
  });

  it("summarises ratings", async () => {
    vi.mocked(db.selectSiteFeedback).mockResolvedValue([{ rating: 5 }, { rating: 4 }, { rating: 4 }, { rating: 1 }] as never);
    const { summary } = await listSiteFeedback(user("admin"));
    expect(summary.total).toBe(4);
    expect(summary.average).toBe(3.5);
    expect(summary.counts).toEqual({ 1: 1, 2: 0, 3: 0, 4: 2, 5: 1 });
  });

  it("explains a missing table instead of showing a raw database error", async () => {
    vi.mocked(db.selectSiteFeedback).mockRejectedValue(new Error("Could not find the table 'public.site_feedback' in the schema cache"));
    await expect(listSiteFeedback(user("admin"))).rejects.toThrow(/2026-09-25-site-feedback\.sql/);
  });
});
