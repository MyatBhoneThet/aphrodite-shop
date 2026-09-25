import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../app/lib/google-sheets", async (importOriginal) => {
  const original = await importOriginal<typeof import("../app/lib/google-sheets")>();
  return {
    ...original,
    hasGoogleSheetsConfig: vi.fn(() => true),
    incrementSheetQuantities: vi.fn(),
  };
});

vi.mock("../app/lib/supabase", async (importOriginal) => {
  const original = await importOriginal<typeof import("../app/lib/supabase")>();
  return {
    ...original,
    selectOrderById: vi.fn(),
    adminCancelOrderRpc: vi.fn(),
    resolveOrderActionRpc: vi.fn(),
    insertAuditLog: vi.fn(),
    selectOrderAuditEvents: vi.fn(),
    adjustSheetStockBaselines: vi.fn(),
    selectProductsByIdsService: vi.fn(),
  };
});

import { adminCancelOrder, resolveOrderRequest } from "../app/lib/backend";
import {
  hasGoogleSheetsConfig,
  incrementSheetQuantities,
  planSheetRestock,
  readSheetDeductionRecord,
  sheetDeductionRecord,
  type SheetQuantityUpdate,
} from "../app/lib/google-sheets";
import {
  adjustSheetStockBaselines,
  adminCancelOrderRpc,
  insertAuditLog,
  resolveOrderActionRpc,
  selectOrderAuditEvents,
  selectOrderById,
  selectProductsByIdsService,
  type CurrentUser,
  type OrderRow,
  type Profile,
} from "../app/lib/supabase";

const KEY = "production:laptops:asus-p2";

function admin(): CurrentUser {
  const profile: Profile = {
    id: "admin-1", email: "admin@example.com", full_name: "Admin", role: "admin",
    wholesale_status: "not_applied", price_list_id: null, phone: null,
  };
  return { id: "admin-1", email: profile.email, role: "admin", profile, accessToken: "token" };
}

function order(overrides: Partial<OrderRow> = {}): OrderRow {
  return {
    id: "order-1", user_id: "user-1", status: "confirmed", total_amount: 5_358_660,
    shipping_name: "Customer", shipping_phone: "0912345678",
    shipping_address: "No. 9, Yangon", shipping_address_line1: "No. 9",
    shipping_address_line2: null, shipping_city: "Yangon", shipping_state: "Yangon",
    shipping_postal_code: "11181", shipping_country: "Myanmar",
    payment_method: "cash_on_delivery", payment_status: "unpaid",
    cancellation_request_status: "requested", cancellation_reason: null,
    cancellation_requested_at: null, cancellation_resolved_at: null,
    return_request_status: "none", return_reason: null,
    return_requested_at: null, return_resolved_at: null, admin_order_note: null,
    notes: null, created_at: "2026-09-15T00:00:00Z", updated_at: "2026-09-15T00:00:00Z",
    order_items: [{ id: "i1", order_id: "order-1", product_id: 216, quantity: 2, unit_price: 2_679_330 }],
    ...overrides,
  };
}

const CANCEL = { reason_code: "customer_request" as const, reason: "Customer changed mind" };

function deductedEvent(items: unknown) {
  return { action: "sheet_stock_deducted", new_data: { items }, created_at: "2026-09-15T00:00:00Z" };
}

function sheetUpdate(overrides: Partial<SheetQuantityUpdate> = {}): SheetQuantityUpdate {
  return {
    sourceKey: KEY, sheet: "Laptops",
    cells: [{ row: 12, from: 3, to: 5 }],
    shortfall: 0, sheetQuantityAfter: 5, ...overrides,
  };
}

function auditActions() {
  return vi.mocked(insertAuditLog).mock.calls.map(([entry]) => entry.action);
}

beforeEach(() => {
  vi.mocked(hasGoogleSheetsConfig).mockReset().mockReturnValue(true);
  vi.mocked(incrementSheetQuantities).mockReset().mockResolvedValue([sheetUpdate()]);
  vi.mocked(selectOrderById).mockReset().mockResolvedValue(order());
  vi.mocked(adminCancelOrderRpc).mockReset().mockResolvedValue({ ok: true } as never);
  vi.mocked(resolveOrderActionRpc).mockReset().mockResolvedValue({ ok: true });
  vi.mocked(insertAuditLog).mockReset().mockResolvedValue(undefined);
  vi.mocked(selectOrderAuditEvents).mockReset().mockResolvedValue([
    deductedEvent([{ sourceKey: KEY, quantity: 2, rows: [{ row: 12, quantity: 2 }] }]),
  ]);
  vi.mocked(adjustSheetStockBaselines).mockReset().mockResolvedValue(undefined);
  vi.mocked(selectProductsByIdsService).mockReset().mockResolvedValue([]);
});

describe("planning where restored units go", () => {
  it("puts units back into the rows they were taken from", () => {
    const plan = planSheetRestock(
      [{ row: 12, quantity: 0 }, { row: 13, quantity: 4 }],
      3,
      [{ row: 12, quantity: 1 }, { row: 13, quantity: 2 }]
    );
    expect(plan.cells).toEqual([
      { row: 12, from: 0, to: 1 },
      { row: 13, from: 4, to: 6 },
    ]);
    expect(plan.unrestored).toBe(0);
  });

  it("sends the remainder to the first row when an original row has gone", () => {
    const plan = planSheetRestock([{ row: 20, quantity: 1 }], 2, [{ row: 12, quantity: 2 }]);
    expect(plan.cells).toEqual([{ row: 20, from: 1, to: 3 }]);
  });

  it("reports everything as unrestored when the product has no rows left", () => {
    expect(planSheetRestock([], 2).unrestored).toBe(2);
  });
});

describe("recording what checkout deducted", () => {
  it("keeps only units that actually reached the sheet", () => {
    const record = sheetDeductionRecord([
      sheetUpdate({ cells: [{ row: 12, from: 5, to: 3 }] }),
      sheetUpdate({ sourceKey: "missing", cells: [], shortfall: 1 }),
    ]);
    expect(record.items).toEqual([{ sourceKey: KEY, quantity: 2, rows: [{ row: 12, quantity: 2 }] }]);
  });

  it("round-trips through the audit log and ignores malformed entries", () => {
    const stored = { items: [{ sourceKey: KEY, quantity: 2, rows: [{ row: 12, quantity: 2 }] }, { sourceKey: 5 }, null] };
    expect(readSheetDeductionRecord(stored)).toEqual([
      { sourceKey: KEY, quantity: 2, rows: [{ row: 12, quantity: 2 }] },
    ]);
    expect(readSheetDeductionRecord(null)).toEqual([]);
  });
});

describe("restocking the Google Sheet when an order is cancelled", () => {
  it("allows COD cancellation without a payment review", async () => {
    vi.mocked(selectOrderById).mockResolvedValue(
      order({
        payment_method: "cash_on_delivery",
        payment_status: "unpaid",
        payment_verification_status: "not_required",
      })
    );

    await expect(adminCancelOrder(admin(), "order-1", CANCEL)).resolves.not.toBeNull();
    expect(adminCancelOrderRpc).toHaveBeenCalledOnce();
  });

  it("blocks an unreviewed bank payment before cancellation", async () => {
    vi.mocked(selectOrderById).mockResolvedValue(
      order({
        payment_method: "bank_transfer",
        payment_status: "unpaid",
        payment_verification_status: "pending",
      })
    );

    await expect(adminCancelOrder(admin(), "order-1", CANCEL)).rejects.toThrow(
      "Finish checking"
    );
    expect(adminCancelOrderRpc).not.toHaveBeenCalled();
  });

  it("allows a reviewed rejected bank payment to cancel without a refund", async () => {
    vi.mocked(selectOrderById).mockResolvedValue(
      order({
        payment_method: "bank_transfer",
        payment_status: "unpaid",
        payment_verification_status: "rejected",
      })
    );

    await expect(adminCancelOrder(admin(), "order-1", CANCEL)).resolves.not.toBeNull();
    expect(adminCancelOrderRpc).toHaveBeenCalledOnce();
  });

  it("allows a verified collected bank payment into the cancellation refund flow", async () => {
    vi.mocked(selectOrderById).mockResolvedValue(
      order({
        payment_method: "bank_transfer",
        payment_status: "collected",
        payment_verification_status: "verified",
      })
    );

    await expect(adminCancelOrder(admin(), "order-1", CANCEL)).resolves.not.toBeNull();
    expect(adminCancelOrderRpc).toHaveBeenCalledOnce();
  });

  it("admin cancel puts back exactly what checkout deducted, and moves the baseline by that amount", async () => {
    await adminCancelOrder(admin(), "order-1", CANCEL);

    expect(incrementSheetQuantities).toHaveBeenCalledWith([
      { sourceKey: KEY, quantity: 2, rows: [{ row: 12, quantity: 2 }] },
    ]);
    expect(adjustSheetStockBaselines).toHaveBeenCalledWith([{ sourceKey: KEY, delta: 2 }]);
    expect(auditActions()).toContain("sheet_stock_restored");
  });

  it("approving a customer's cancellation restocks; rejecting it does not", async () => {
    await resolveOrderRequest(admin(), "order-1", { request_type: "cancellation", decision: "reject" });
    expect(incrementSheetQuantities).not.toHaveBeenCalled();

    await resolveOrderRequest(admin(), "order-1", { request_type: "cancellation", decision: "approve" });
    expect(incrementSheetQuantities).toHaveBeenCalledTimes(1);
  });

  it("does not restock on a return decision", async () => {
    await resolveOrderRequest(admin(), "order-1", { request_type: "return", decision: "approve" });
    expect(incrementSheetQuantities).not.toHaveBeenCalled();
  });

  it("adds nothing back when checkout's deduction never reached the sheet", async () => {
    vi.mocked(selectOrderAuditEvents).mockResolvedValue([
      { action: "sheet_write_back_failed", new_data: {}, created_at: "2026-09-15T00:00:00Z" },
    ]);

    await adminCancelOrder(admin(), "order-1", CANCEL);

    expect(incrementSheetQuantities).not.toHaveBeenCalled();
    expect(auditActions()).toContain("sheet_stock_restore_skipped");
  });

  it("never adds the same units back twice", async () => {
    vi.mocked(selectOrderAuditEvents).mockResolvedValue([
      deductedEvent([{ sourceKey: KEY, quantity: 2 }]),
      { action: "sheet_stock_restored", new_data: {}, created_at: "2026-09-15T01:00:00Z" },
    ]);

    await adminCancelOrder(admin(), "order-1", CANCEL);

    expect(incrementSheetQuantities).not.toHaveBeenCalled();
  });

  it("restores older orders (placed before deductions were recorded) from their order lines", async () => {
    vi.mocked(selectOrderAuditEvents).mockResolvedValue([]);
    vi.mocked(selectOrderById).mockResolvedValue(order({
      order_items: [
        { id: "a", order_id: "order-1", product_id: 216, quantity: 1, unit_price: 1 },
        { id: "b", order_id: "order-1", product_id: 216, quantity: 2, unit_price: 1 },
        { id: "c", order_id: "order-1", product_id: 99, quantity: 1, unit_price: 1 },
      ],
    }));
    vi.mocked(selectProductsByIdsService).mockResolvedValue([
      { id: 216, source_key: KEY },
      { id: 99, source_key: null },
    ] as never);

    await adminCancelOrder(admin(), "order-1", CANCEL);

    // Product 99 was added by hand in admin, so it is not in the sheet.
    expect(incrementSheetQuantities).toHaveBeenCalledWith([{ sourceKey: KEY, quantity: 3 }]);
  });

  it("a Google Sheet failure never fails the cancellation, and is recorded for the admin", async () => {
    vi.mocked(incrementSheetQuantities).mockRejectedValue(new Error("Sheets API down"));

    await expect(adminCancelOrder(admin(), "order-1", CANCEL)).resolves.not.toBeNull();

    expect(adjustSheetStockBaselines).not.toHaveBeenCalled();
    expect(auditActions()).toContain("sheet_stock_restore_failed");
  });

  it("flags a baseline failure after the sheet write, having already recorded the restore", async () => {
    vi.mocked(adjustSheetStockBaselines).mockRejectedValue(new Error("db down"));

    await adminCancelOrder(admin(), "order-1", CANCEL);

    const actions = auditActions();
    expect(actions).toContain("sheet_stock_restored");
    expect(actions).toContain("sheet_stock_baseline_failed");
  });

  it("does nothing without Google Sheets credentials", async () => {
    vi.mocked(hasGoogleSheetsConfig).mockReturnValue(false);

    await adminCancelOrder(admin(), "order-1", CANCEL);

    expect(selectOrderAuditEvents).not.toHaveBeenCalled();
    expect(incrementSheetQuantities).not.toHaveBeenCalled();
  });

  it("does not touch the sheet when the database refuses the cancellation", async () => {
    vi.mocked(adminCancelOrderRpc).mockRejectedValue(new Error("ADMIN_CANCELLATION_NOT_ALLOWED"));

    await expect(adminCancelOrder(admin(), "order-1", CANCEL)).rejects.toThrow();

    expect(incrementSheetQuantities).not.toHaveBeenCalled();
  });
});
