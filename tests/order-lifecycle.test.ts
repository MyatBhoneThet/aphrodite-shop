import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../app/lib/supabase", async (importOriginal) => {
  const original = await importOriginal<typeof import("../app/lib/supabase")>();
  return {
    ...original,
    selectOrderById: vi.fn(),
    requestOrderActionRpc: vi.fn(),
    resolveOrderActionRpc: vi.fn(),
    updateOrderStatus: vi.fn(),
    insertAuditLog: vi.fn(),
  };
});

import { patchOrderStatus, requestOrderAction, resolveOrderRequest } from "../app/lib/backend";
import {
  requestOrderActionRpc, resolveOrderActionRpc, selectOrderById,
  updateOrderStatus, type CurrentUser, type OrderRow, type Profile,
} from "../app/lib/supabase";

function user(role: Profile["role"] = "normal"): CurrentUser {
  const id = role === "admin" ? "admin-1" : "user-1";
  const profile: Profile = {
    id, email: `${role}@example.com`, full_name: role, role,
    wholesale_status: "not_applied", price_list_id: null, phone: null,
  };
  return { id, email: profile.email, role, profile, accessToken: "token" };
}

function order(overrides: Partial<OrderRow> = {}): OrderRow {
  return {
    id: "order-1", user_id: "user-1", status: "pending", total_amount: 50000,
    shipping_name: "Customer", shipping_phone: "0812345678",
    shipping_address: "123 Test Road, Bangkok", shipping_address_line1: "123 Test Road",
    shipping_address_line2: null, shipping_city: "Bangkok", shipping_state: "Bangkok",
    shipping_postal_code: "10110", shipping_country: "Thailand",
    payment_method: "cash_on_delivery", payment_status: "unpaid",
    cancellation_request_status: "none", cancellation_reason: null,
    cancellation_requested_at: null, cancellation_resolved_at: null,
    return_request_status: "none", return_reason: null,
    return_requested_at: null, return_resolved_at: null, admin_order_note: null,
    notes: null, created_at: "2026-07-28T00:00:00Z",
    updated_at: "2026-07-28T00:00:00Z", order_items: [], ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(selectOrderById).mockReset().mockResolvedValue(order());
  vi.mocked(requestOrderActionRpc).mockReset().mockResolvedValue({ ok: true });
  vi.mocked(resolveOrderActionRpc).mockReset().mockResolvedValue({ ok: true });
  vi.mocked(updateOrderStatus).mockReset().mockResolvedValue(order({ status: "confirmed" }));
});

describe("order lifecycle authorization", () => {
  it("scopes customer cancellation requests to the authenticated user", async () => {
    await requestOrderAction(user(), "order-1", {
      action: "request_cancellation", reason: "Wrong model selected.",
    });
    expect(requestOrderActionRpc).toHaveBeenCalledWith({
      user_id: "user-1", order_id: "order-1",
      request_type: "cancellation", reason: "Wrong model selected.",
      reason_code: null, pickup_method: null, pickup_address: null,
    });
  });

  it("prevents non-admins from resolving requests", async () => {
    await expect(resolveOrderRequest(user(), "order-1", {
      request_type: "cancellation", decision: "approve",
    })).rejects.toMatchObject({ status: 403 });
    expect(resolveOrderActionRpc).not.toHaveBeenCalled();
  });

  it("uses the atomic resolution RPC for administrators", async () => {
    await resolveOrderRequest(user("admin"), "order-1", {
      request_type: "return", decision: "approve", admin_note: "Refunded.",
    });
    expect(resolveOrderActionRpc).toHaveBeenCalledWith({
      actor_id: "admin-1", order_id: "order-1", request_type: "return",
      decision: "approve", admin_note: "Refunded.",
    });
  });

  it("requires fulfilment statuses to progress in order", async () => {
    await expect(patchOrderStatus(user("admin"), "order-1", "shipped"))
      .rejects.toMatchObject({ status: 409 });
    expect(updateOrderStatus).not.toHaveBeenCalled();
  });
});
