import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../app/lib/supabase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/supabase")>()),
  selectOrderById: vi.fn(),
  customerCancelOrderRpc: vi.fn(),
  requestOrderActionRpc: vi.fn(),
  insertAuditLog: vi.fn(),
}));

import { cancelOwnOrder } from "../app/lib/backend";
import * as db from "../app/lib/supabase";
import type { CurrentUser, OrderRow } from "../app/lib/supabase";

const customer = { id: "c1", email: "c@x.com", role: "normal", accessToken: "t", profile: { id: "c1", role: "normal" } } as unknown as CurrentUser;
const order = (over: Partial<OrderRow> = {}) =>
  ({ id: "o1", user_id: "c1", status: "pending", payment_method: "cash_on_delivery", cancellation_request_status: "none", order_items: [], ...over }) as unknown as OrderRow;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(db.selectOrderById).mockResolvedValue(order());
  vi.mocked(db.customerCancelOrderRpc).mockResolvedValue({ ok: true });
  vi.mocked(db.requestOrderActionRpc).mockResolvedValue({ ok: true } as never);
});

describe("customer cancels their own order", () => {
  it("cancels at once while the shop has not checked it", async () => {
    vi.mocked(db.selectOrderById).mockResolvedValueOnce(order()).mockResolvedValueOnce(order({ status: "cancelled" }));
    const result = await cancelOwnOrder(customer, "o1", "Changed my mind");
    expect(db.customerCancelOrderRpc).toHaveBeenCalledWith({ user_id: "c1", order_id: "o1", reason: "Changed my mind" });
    expect(db.requestOrderActionRpc).not.toHaveBeenCalled();
    expect(result?.mode).toBe("cancelled");
  });

  it("sends a request instead once the order is confirmed", async () => {
    vi.mocked(db.selectOrderById).mockResolvedValue(order({ status: "confirmed" }));
    const result = await cancelOwnOrder(customer, "o1", "Changed my mind");
    expect(db.customerCancelOrderRpc).not.toHaveBeenCalled();
    expect(db.requestOrderActionRpc).toHaveBeenCalledWith(expect.objectContaining({ request_type: "cancellation", order_id: "o1" }));
    expect(result?.mode).toBe("requested");
  });

  it("sends a request when a bank-transfer slip is already uploaded (money may have moved)", async () => {
    vi.mocked(db.selectOrderById).mockResolvedValue(order({ payment_method: "bank_transfer", payment_slips: [{ id: "s" }] } as never));
    expect((await cancelOwnOrder(customer, "o1", "Changed my mind"))?.mode).toBe("requested");
    expect(db.customerCancelOrderRpc).not.toHaveBeenCalled();
  });

  it("falls back to a request if the database says it is no longer instant", async () => {
    vi.mocked(db.customerCancelOrderRpc).mockRejectedValue(new Error("CANCEL_NOT_INSTANT"));
    expect((await cancelOwnOrder(customer, "o1", "Changed my mind"))?.mode).toBe("requested");
  });

  it("falls back to a request if the database function is not created yet", async () => {
    vi.mocked(db.customerCancelOrderRpc).mockRejectedValue(new Error("Could not find the function public.customer_cancel_order(p_order_id, p_reason, p_user_id)"));
    expect((await cancelOwnOrder(customer, "o1", "Changed my mind"))?.mode).toBe("requested");
  });

  it("is not available to admin or staff accounts, and 404s a missing order", async () => {
    await expect(cancelOwnOrder({ ...customer, role: "staff" } as CurrentUser, "o1", "x y z")).rejects.toMatchObject({ status: 403 });
    vi.mocked(db.selectOrderById).mockResolvedValue(null as never);
    expect(await cancelOwnOrder(customer, "o1", "Changed my mind")).toBeNull();
  });
});
