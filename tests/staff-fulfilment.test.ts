import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../app/lib/supabase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/supabase")>()),
  selectOrderById: vi.fn(),
  updateOrderStatus: vi.fn(),
  updateOrderDeliveryService: vi.fn(),
  insertDeliveryEvent: vi.fn(),
  insertAuditLog: vi.fn(),
  selectProductByIdService: vi.fn(),
  updateProduct: vi.fn(),
}));

import {
  adminCancelOrder,
  advanceOrderDeliveryProgress,
  patchOrderStatus,
  patchProduct,
  recordFailedDeliveryAttempt,
  saveCourierDetails,
  updateOrderDelivery,
} from "../app/lib/backend";
import * as db from "../app/lib/supabase";
import type { CurrentUser, OrderRow } from "../app/lib/supabase";

const fresh = { realRole: "admin", enrolled: true, aal: "aal2", pending: null, fresh: true, recentSignIn: true, factors: [] };
const staff = { id: "staff-1", email: "s@x.com", role: "staff", accessToken: "staff-token", profile: { id: "staff-1", role: "staff" }, mfa: { ...fresh, realRole: "staff" } } as unknown as CurrentUser;
const admin = { id: "admin-1", email: "a@x.com", role: "admin", accessToken: "admin-token", profile: { id: "admin-1", role: "admin" }, mfa: fresh } as unknown as CurrentUser;

const order = (over: Partial<OrderRow> = {}) =>
  ({
    id: "o1", user_id: "c1", status: "confirmed", total_amount: 1000, payment_method: "cash_on_delivery", payment_status: "unpaid",
    cod_verification_status: "approved", cancellation_request_status: "none", courier_name: "Royal Express", delivery_tracking_number: "RE123",
    delivery_events: [{ stage: "verified", happened_at: "2026-09-24T00:00:00Z" }], order_items: [], created_at: "2026-09-24T00:00:00Z", ...over,
  }) as unknown as OrderRow;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(db.selectOrderById).mockResolvedValue(order());
  vi.mocked(db.updateOrderStatus).mockResolvedValue(order() as never);
  vi.mocked(db.insertAuditLog).mockResolvedValue(undefined);
  vi.mocked(db.insertDeliveryEvent).mockResolvedValue({} as never);
  vi.mocked(db.updateOrderDeliveryService).mockResolvedValue(order() as never);
});

describe("staff can fulfil orders", () => {
  it("mark an approved order packed", async () => {
    await expect(advanceOrderDeliveryProgress(staff, "o1", "packed")).resolves.toBeTruthy();
    expect(db.insertDeliveryEvent).toHaveBeenCalledWith(expect.objectContaining({ stage: "packed", created_by: "staff-1" }));
  });

  it("hand it to the courier, writing with the server's rights rather than their own token", async () => {
    vi.mocked(db.selectOrderById).mockResolvedValue(order({ delivery_events: [{ stage: "packed", happened_at: "2026-09-24T01:00:00Z" }] } as never));
    await advanceOrderDeliveryProgress(staff, "o1", "handed_to_courier");
    expect(db.updateOrderStatus).toHaveBeenCalledWith("o1", "shipped", null, expect.anything());
  });

  it("mark it delivered, and the audit log names who did it", async () => {
    vi.mocked(db.selectOrderById).mockResolvedValue(order({ status: "shipped", delivery_events: [{ stage: "out_for_delivery", happened_at: "2026-09-25T00:00:00Z" }] } as never));
    await patchOrderStatus(staff, "o1", "delivered");
    expect(db.updateOrderStatus).toHaveBeenCalledWith("o1", "delivered", null, expect.objectContaining({ paymentStatus: "collected" }));
    expect(db.insertAuditLog).toHaveBeenCalledWith(expect.objectContaining({ actor_id: "staff-1", action: "order.status.update" }));
  });

  it("record a failed delivery attempt on a shipped order", async () => {
    vi.mocked(db.selectOrderById).mockResolvedValue(order({ status: "shipped" } as never));
    await expect(recordFailedDeliveryAttempt(staff, "o1", { reason: "no_answer" })).resolves.toBeTruthy();
  });

  it("save courier and tracking, and it is logged", async () => {
    await saveCourierDetails(staff, "o1", { courier_name: "Royal Express", tracking_number: "RE999" });
    expect(db.updateOrderDeliveryService).toHaveBeenCalledWith("o1", expect.objectContaining({ courier_name: "Royal Express", delivery_tracking_number: "RE999" }));
    expect(db.insertAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "order.courier.update", actor_id: "staff-1" }));
  });

  it("but not on a closed order", async () => {
    vi.mocked(db.selectOrderById).mockResolvedValue(order({ status: "cancelled" } as never));
    await expect(saveCourierDetails(staff, "o1", { courier_name: "A", tracking_number: "B" })).rejects.toMatchObject({ status: 409 });
  });

  it("admins still write with their own token", async () => {
    vi.mocked(db.selectOrderById).mockResolvedValue(order({ delivery_events: [{ stage: "packed", happened_at: "2026-09-24T01:00:00Z" }] } as never));
    await advanceOrderDeliveryProgress(admin, "o1", "handed_to_courier");
    expect(db.updateOrderStatus).toHaveBeenCalledWith("o1", "shipped", "admin-token", expect.anything());
  });
});

describe("staff still cannot approve, cancel or decide", () => {
  it("verify an order or move it to confirmed", async () => {
    vi.mocked(db.selectOrderById).mockResolvedValue(order({ status: "pending", delivery_events: [] } as never));
    await expect(advanceOrderDeliveryProgress(staff, "o1", "verified")).rejects.toMatchObject({ status: 403 });
    await expect(patchOrderStatus(staff, "o1", "confirmed")).rejects.toMatchObject({ status: 403 });
    expect(db.updateOrderStatus).not.toHaveBeenCalled();
  });

  it("record COD approval or cancel an order", async () => {
    const approval = { verification_status: "approved" as const, callback_confirmed: true, address_confirmed: true, verification_note: "ok" };
    await expect(updateOrderDelivery(staff, "o1", approval)).rejects.toMatchObject({ status: 403 });
    await expect(adminCancelOrder(staff, "o1", { reason: "x", reason_code: "out_of_stock" } as never)).rejects.toMatchObject({ status: 403 });
  });

  it("customers cannot use any of it", async () => {
    const customer = { ...staff, role: "normal" } as CurrentUser;
    await expect(advanceOrderDeliveryProgress(customer, "o1", "packed")).rejects.toMatchObject({ status: 403 });
    await expect(saveCourierDetails(customer, "o1", { courier_name: "A", tracking_number: "B" })).rejects.toMatchObject({ status: 403 });
  });
});

describe("staff change stock, not prices", () => {
  const row = { id: 5, name: "X", price: 1000, stock: "In Stock", stock_quantity: 4, source_key: null };

  beforeEach(() => {
    vi.mocked(db.selectProductByIdService).mockResolvedValue(row as never);
    vi.mocked(db.updateProduct).mockResolvedValue({ ...row, stock_quantity: 9 } as never);
  });

  it("drops everything except stock from a staff edit, even if the form sends it all", async () => {
    await patchProduct(staff, 5, { name: "Hacked", price: 1, wholesalePrice: 1, brand: "Z", stock: "In Stock", stockQuantity: 9 });
    const sent = vi.mocked(db.updateProduct).mock.calls[0][1] as Record<string, unknown>;
    expect(sent).toMatchObject({ stockQuantity: 9, stock: "In Stock" });
    expect(JSON.stringify(sent)).not.toMatch(/Hacked|"price"|wholesale|"brand"/);
  });

  it("refuses an edit that changes nothing but a price", async () => {
    await expect(patchProduct(staff, 5, { price: 1 })).rejects.toMatchObject({ status: 403 });
    expect(db.updateProduct).not.toHaveBeenCalled();
  });

  it("lets admins change the price", async () => {
    await patchProduct(admin, 5, { price: 2000 });
    expect(JSON.stringify(vi.mocked(db.updateProduct).mock.calls[0][1])).toContain("2000");
  });
});
