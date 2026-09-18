import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../app/lib/supabase", async (importOriginal) => {
  const original = await importOriginal<typeof import("../app/lib/supabase")>();

  return {
    ...original,
    selectOrderById: vi.fn(),
    ensureSupportConversation: vi.fn(),
    insertOrderHelpCase: vi.fn(),
    insertSupportMessage: vi.fn(),
    selectHelpCaseById: vi.fn(),
    selectHelpCases: vi.fn(),
    selectHelpCasesForCustomer: vi.fn(),
    updateHelpCaseService: vi.fn(),
    selectReturnRequestsForCustomer: vi.fn(),
    selectSupportMessages: vi.fn(),
    insertAuditLog: vi.fn(),
  };
});

import {
  getAdminHelpCase,
  listAdminHelpCases,
  openOrderHelpCase,
  updateHelpCase,
} from "../app/lib/backend";
import {
  ensureSupportConversation,
  insertAuditLog,
  insertOrderHelpCase,
  insertSupportMessage,
  selectHelpCaseById,
  selectHelpCases,
  selectOrderById,
  selectReturnRequestsForCustomer,
  selectSupportMessages,
  updateHelpCaseService,
  type CurrentUser,
  type OrderHelpCaseRow,
  type OrderRow,
  type Profile,
} from "../app/lib/supabase";

function user(role: Profile["role"] = "normal"): CurrentUser {
  const id = role === "admin" ? "admin-1" : "customer-1";
  const profile: Profile = {
    id,
    email: `${role}@example.com`,
    full_name: role,
    role,
    wholesale_status: "not_applied",
    price_list_id: null,
    phone: null,
  };

  return { id, email: profile.email, role, profile, accessToken: "token" };
}

function order(overrides: Partial<OrderRow> = {}): OrderRow {
  return {
    id: "order-1",
    user_id: "customer-1",
    status: "delivered",
    total_amount: 1500000,
    shipping_name: "Customer",
    shipping_phone: "0912345678",
    shipping_address: "12 Test Road, Yangon",
    shipping_address_line1: "12 Test Road",
    shipping_address_line2: null,
    shipping_city: "Yangon",
    shipping_state: "Yangon Region",
    shipping_postal_code: "11181",
    shipping_country: "Myanmar",
    payment_method: "cash_on_delivery",
    payment_status: "collected",
    cancellation_request_status: "none",
    cancellation_reason: null,
    cancellation_requested_at: null,
    cancellation_resolved_at: null,
    return_request_status: "none",
    return_reason: null,
    return_requested_at: null,
    return_resolved_at: null,
    admin_order_note: null,
    notes: null,
    created_at: "2026-09-10T00:00:00Z",
    updated_at: "2026-09-10T00:00:00Z",
    order_items: [],
    ...overrides,
  };
}

function helpCase(overrides: Partial<OrderHelpCaseRow> = {}): OrderHelpCaseRow {
  return {
    id: "case-1",
    order_id: "order-1",
    customer_id: "customer-1",
    topic: "delivery",
    status: "open",
    summary: "The courier never called me.",
    conversation_id: "conversation-1",
    assigned_admin_id: null,
    admin_note: null,
    created_at: "2026-09-16T00:00:00Z",
    updated_at: "2026-09-16T00:00:00Z",
    resolved_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(selectOrderById).mockReset().mockResolvedValue(order());
  vi.mocked(ensureSupportConversation)
    .mockReset()
    .mockResolvedValue({ id: "conversation-1" } as never);
  vi.mocked(insertOrderHelpCase).mockReset().mockResolvedValue(helpCase());
  vi.mocked(insertSupportMessage).mockReset().mockResolvedValue(null as never);
  vi.mocked(selectHelpCaseById).mockReset().mockResolvedValue(helpCase());
  vi.mocked(selectHelpCases).mockReset().mockResolvedValue([helpCase()]);
  vi.mocked(updateHelpCaseService).mockReset().mockResolvedValue(helpCase());
  vi.mocked(selectReturnRequestsForCustomer).mockReset().mockResolvedValue([]);
  vi.mocked(selectSupportMessages).mockReset().mockResolvedValue([]);
  vi.mocked(insertAuditLog).mockReset().mockResolvedValue(undefined);
});

describe("get help with this order", () => {
  it("opens a case against the customer's own order", async () => {
    await openOrderHelpCase(user(), "order-1", {
      topic: "payment",
      summary: "I transferred on Monday but it still says unpaid.",
    });

    expect(selectOrderById).toHaveBeenCalledWith(
      expect.objectContaining({ id: "customer-1" }),
      "order-1"
    );
    expect(insertOrderHelpCase).toHaveBeenCalledWith({
      order_id: "order-1",
      customer_id: "customer-1",
      topic: "payment",
      summary: "I transferred on Monday but it still says unpaid.",
      conversation_id: "conversation-1",
    });
  });

  it("posts the case into the customer's existing chat so nothing is retyped", async () => {
    await openOrderHelpCase(user(), "order-1", {
      topic: "faulty_item",
      summary: "The trackpad does not click.",
    });

    const [message] = vi.mocked(insertSupportMessage).mock.calls[0];
    expect(message).toMatchObject({
      conversation_id: "conversation-1",
      sender_id: "customer-1",
      sender_role: "customer",
    });
    // The admin-facing header names the topic and order; the customer's own
    // words are carried through untouched underneath it.
    expect(message.body).toContain("Wrong or faulty item");
    expect(message.body).toContain("ORDER-1");
    expect(message.body).toContain("The trackpad does not click.");
  });

  it("refuses to open a case against somebody else's order", async () => {
    vi.mocked(selectOrderById).mockResolvedValue(null as never);

    await expect(
      openOrderHelpCase(user(), "order-9", { topic: "delivery", summary: "Where is it?" })
    ).rejects.toMatchObject({ status: 404 });
    expect(insertOrderHelpCase).not.toHaveBeenCalled();
  });

  it("keeps customers out of the admin case inbox", async () => {
    await expect(listAdminHelpCases(user())).rejects.toMatchObject({ status: 403 });
    expect(selectHelpCases).not.toHaveBeenCalled();
  });

  it("gives the administrator the order, returns and chat in one response", async () => {
    const detail = await getAdminHelpCase(user("admin"), "case-1");

    expect(detail.case.id).toBe("case-1");
    expect(detail.order).toMatchObject({ id: "order-1" });
    expect(selectSupportMessages).toHaveBeenCalledWith("conversation-1");
  });

  it("audits an administrator resolving a case", async () => {
    await updateHelpCase(user("admin"), "case-1", { status: "resolved" });

    expect(updateHelpCaseService).toHaveBeenCalledWith(
      "case-1",
      expect.objectContaining({ status: "resolved", assigned_admin_id: "admin-1" })
    );
    expect(insertAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_id: "admin-1",
        action: "help_case.resolved",
        target_id: "case-1",
      })
    );
  });
});
