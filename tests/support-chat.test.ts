import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../app/lib/supabase", async (importOriginal) => {
  const original = await importOriginal<typeof import("../app/lib/supabase")>();

  return {
    ...original,
    ensureSupportConversation: vi.fn(),
    insertAuditLog: vi.fn(),
    insertSupportMessage: vi.fn(),
    selectSupportConversationByCustomer: vi.fn(),
    selectSupportConversationById: vi.fn(),
    selectSupportConversations: vi.fn(),
    selectSupportMessages: vi.fn(),
    updateSupportConversation: vi.fn(),
  };
});

import {
  getCustomerSupportConversation,
  listAdminSupportConversations,
  sendAdminSupportMessage,
  sendCustomerSupportMessage,
  setAdminSupportConversationStatus,
} from "../app/lib/backend";
import {
  ensureSupportConversation,
  insertAuditLog,
  insertSupportMessage,
  selectSupportConversationByCustomer,
  selectSupportConversationById,
  selectSupportConversations,
  selectSupportMessages,
  updateSupportConversation,
  type CurrentUser,
  type Profile,
  type SupportConversationRow,
  type SupportMessageRow,
} from "../app/lib/supabase";

function user(role: Profile["role"] = "normal"): CurrentUser {
  const id = role === "admin" ? "admin-1" : "customer-1";
  const profile: Profile = {
    id,
    email: `${role}@example.com`,
    full_name: role === "admin" ? "Admin User" : "Customer User",
    role,
    wholesale_status: "not_applied",
    price_list_id: null,
    phone: null,
  };

  return {
    id,
    email: profile.email,
    role,
    profile,
    accessToken: "token",
  };
}

function conversation(
  overrides: Partial<SupportConversationRow> = {}
): SupportConversationRow {
  return {
    id: "conversation-1",
    customer_id: "customer-1",
    assigned_admin_id: null,
    status: "open",
    last_message_at: "2026-07-28T12:00:00.000Z",
    last_message_preview: "I need help.",
    last_sender_role: "customer",
    customer_last_read_at: null,
    admin_last_read_at: null,
    created_at: "2026-07-28T12:00:00.000Z",
    updated_at: "2026-07-28T12:00:00.000Z",
    profiles: {
      email: "customer@example.com",
      full_name: "Customer User",
      role: "normal",
    },
    ...overrides,
  };
}

function message(
  overrides: Partial<SupportMessageRow> = {}
): SupportMessageRow {
  return {
    id: "message-1",
    conversation_id: "conversation-1",
    sender_id: "customer-1",
    sender_role: "customer",
    body: "I need help.",
    created_at: "2026-07-28T12:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(ensureSupportConversation).mockReset().mockResolvedValue(conversation());
  vi.mocked(insertAuditLog).mockReset().mockResolvedValue(undefined);
  vi.mocked(insertSupportMessage).mockReset().mockResolvedValue(message());
  vi.mocked(selectSupportConversationByCustomer)
    .mockReset()
    .mockResolvedValue(conversation());
  vi.mocked(selectSupportConversationById)
    .mockReset()
    .mockResolvedValue(conversation());
  vi.mocked(selectSupportConversations)
    .mockReset()
    .mockResolvedValue([conversation()]);
  vi.mocked(selectSupportMessages).mockReset().mockResolvedValue([message()]);
  vi.mocked(updateSupportConversation)
    .mockReset()
    .mockResolvedValue(conversation());
});

describe("private customer support chat", () => {
  it("loads a customer's conversation using only that account id", async () => {
    const result = await getCustomerSupportConversation(user());

    expect(selectSupportConversationByCustomer).toHaveBeenCalledWith(
      "customer-1"
    );
    expect(selectSupportMessages).toHaveBeenCalledWith("conversation-1");
    expect(result.messages[0]).toMatchObject({
      sender_role: "customer",
      body: "I need help.",
    });
  });

  it("records customer messages under the authenticated customer account", async () => {
    await sendCustomerSupportMessage(user(), "  Where is my order?  ");

    expect(ensureSupportConversation).toHaveBeenCalledWith("customer-1");
    // A plain text message carries no photo and no product reference, and the
    // nulls are asserted explicitly so a future change that silently attaches
    // something to every message would fail here.
    expect(insertSupportMessage).toHaveBeenCalledWith({
      conversation_id: "conversation-1",
      sender_id: "customer-1",
      sender_role: "customer",
      body: "Where is my order?",
      attachment_path: null,
      attachment_type: null,
      product_id: null,
    });
  });

  it("blocks customers from reading the admin support inbox", async () => {
    await expect(listAdminSupportConversations(user())).rejects.toMatchObject({
      status: 403,
    });
    expect(selectSupportConversations).not.toHaveBeenCalled();
  });

  it("sends an administrator reply to one selected conversation", async () => {
    await sendAdminSupportMessage(
      user("admin"),
      "conversation-1",
      "We are checking this for you."
    );

    expect(insertSupportMessage).toHaveBeenCalledWith({
      conversation_id: "conversation-1",
      sender_id: "admin-1",
      sender_role: "admin",
      body: "We are checking this for you.",
    });
    expect(updateSupportConversation).toHaveBeenCalledWith("conversation-1", {
      assigned_admin_id: "admin-1",
    });
  });

  it("audits administrators resolving a conversation", async () => {
    await setAdminSupportConversationStatus(
      user("admin"),
      "conversation-1",
      "resolved"
    );

    expect(updateSupportConversation).toHaveBeenCalledWith("conversation-1", {
      status: "resolved",
      assigned_admin_id: "admin-1",
    });
    expect(insertAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_id: "admin-1",
        action: "support.resolved",
        target_id: "conversation-1",
      })
    );
  });
});
