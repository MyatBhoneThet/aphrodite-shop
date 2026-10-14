import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../app/lib/supabase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/supabase")>()),
  selectActivityLog: vi.fn(),
  selectCustomersPage: vi.fn(),
  selectOrderSummariesForUsers: vi.fn(),
  selectCustomerProfile: vi.fn(),
  selectOrdersOfCustomer: vi.fn(),
  selectCustomerNotes: vi.fn(),
  insertCustomerNote: vi.fn(),
  insertAuditLog: vi.fn(),
  selectOrdersSince: vi.fn(),
}));

import { productChange, recordAdminAction } from "../app/lib/admin-audit";
import { addCustomerNote, getCustomerDetail, getNewOrders, listActivity, listCustomers } from "../app/lib/admin-ops";
import * as db from "../app/lib/supabase";
import type { CurrentUser } from "../app/lib/supabase";

const user = (role: "admin" | "staff" | "normal") => ({ id: "u1", role } as unknown as CurrentUser);
const ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => vi.resetAllMocks());

describe("activity log", () => {
  it("is admin-only", async () => {
    await expect(listActivity(user("staff"), null, null)).rejects.toThrow();
    expect(db.selectActivityLog).not.toHaveBeenCalled();
  });

  it("filters by category prefixes and reports whether there is another page", async () => {
    vi.mocked(db.selectActivityLog).mockResolvedValue(Array.from({ length: 31 }, (_, i) => ({ id: String(i) })) as never);
    const result = await listActivity(user("admin"), "orders", "0");
    expect(db.selectActivityLog).toHaveBeenCalledWith({ limit: 31, offset: 0, prefixes: ["order."] });
    expect(result.entries).toHaveLength(30);
    expect(result.hasMore).toBe(true);
    expect(result.nextOffset).toBe(30);
  });

  it("rejects unknown categories and bad offsets", async () => {
    await expect(listActivity(user("admin"), "nope", null)).rejects.toThrow();
    await expect(listActivity(user("admin"), null, "-1")).rejects.toThrow();
  });
});

describe("customers", () => {
  it("is admin-only (it holds phone numbers and emails)", async () => {
    await expect(listCustomers(user("staff"), null, null)).rejects.toThrow();
    await expect(getCustomerDetail(user("staff"), ID)).rejects.toThrow();
    await expect(addCustomerNote(user("staff"), ID, { body: "x" })).rejects.toThrow();
  });

  it("adds order count, spend (without cancelled/returned) and last order", async () => {
    vi.mocked(db.selectCustomersPage).mockResolvedValue({ rows: [{ id: "c1" }, { id: "c2" }] as never, total: 40 });
    vi.mocked(db.selectOrderSummariesForUsers).mockResolvedValue([
      { id: "a", user_id: "c1", status: "delivered", total_amount: 1000, created_at: "2026-09-25T00:00:00Z" },
      { id: "b", user_id: "c1", status: "cancelled", total_amount: 9000, created_at: "2026-09-20T00:00:00Z" },
    ] as never);
    const result = await listCustomers(user("admin"), "thu", "0");
    expect(result.customers[0]).toMatchObject({ id: "c1", orderCount: 2, totalSpent: 1000, lastOrderAt: "2026-09-25T00:00:00Z" });
    expect(result.customers[1]).toMatchObject({ id: "c2", orderCount: 0, totalSpent: 0, lastOrderAt: null });
    expect(result.hasMore).toBe(true);
  });

  it("returns 404 for a bad id or a non-customer", async () => {
    await expect(getCustomerDetail(user("admin"), "not-a-uuid")).rejects.toThrow(/not found/i);
    vi.mocked(db.selectCustomerProfile).mockResolvedValue(null as never);
    await expect(getCustomerDetail(user("admin"), ID)).rejects.toThrow(/not found/i);
  });

  it("still shows the customer when the notes table has not been created", async () => {
    vi.mocked(db.selectCustomerProfile).mockResolvedValue({ id: ID } as never);
    vi.mocked(db.selectOrdersOfCustomer).mockResolvedValue([]);
    vi.mocked(db.selectCustomerNotes).mockRejectedValue(new Error("Could not find the table 'public.customer_notes'"));
    const detail = await getCustomerDetail(user("admin"), ID);
    expect(detail.notesAvailable).toBe(false);
    expect(detail.notes).toEqual([]);
  });

  it("saves a trimmed note, audits it, and enforces the length limits", async () => {
    vi.mocked(db.selectCustomerProfile).mockResolvedValue({ id: ID } as never);
    vi.mocked(db.insertCustomerNote).mockResolvedValue({ id: "n1" } as never);
    await addCustomerNote(user("admin"), ID, { body: "  calls after 5pm  " });
    expect(db.insertCustomerNote).toHaveBeenCalledWith({ customer_id: ID, author_id: "u1", body: "calls after 5pm" });
    expect(db.insertAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "customer.note", target_id: ID }));
    await expect(addCustomerNote(user("admin"), ID, { body: "   " })).rejects.toThrow();
    await expect(addCustomerNote(user("admin"), ID, { body: "x".repeat(2001) })).rejects.toThrow();
  });

  it("explains a missing notes table when saving", async () => {
    vi.mocked(db.selectCustomerProfile).mockResolvedValue({ id: ID } as never);
    vi.mocked(db.insertCustomerNote).mockRejectedValue(new Error("relation customer_notes does not exist"));
    await expect(addCustomerNote(user("admin"), ID, { body: "hi" })).rejects.toThrow(/2026-10-09-customer-notes\.sql/);
  });
});

describe("new order alert", () => {
  it("lets staff poll, but not customers", async () => {
    vi.mocked(db.selectOrdersSince).mockResolvedValue([]);
    await expect(getNewOrders(user("staff"), "2026-09-25T00:00:00Z")).resolves.toMatchObject({ count: 0 });
    await expect(getNewOrders(user("normal"), "2026-09-25T00:00:00Z")).rejects.toThrow();
  });

  it("tells the popup what was bought and how it is paid", async () => {
    vi.mocked(db.selectOrdersSince).mockResolvedValue([
      {
        id: "o1",
        created_at: "2026-09-25T01:00:00Z",
        total_amount: 9_105_300,
        shipping_name: "swan yi",
        payment_method: "cash_on_delivery",
        order_items: [
          { quantity: 5, products: { name: "HP Elitebook 840 G8" } },
          { quantity: 1, products: { name: "Mouse" } },
          { quantity: 2, products: { name: "Bag" } },
          { quantity: 1, products: null },
        ],
      },
    ] as never);

    const result = await getNewOrders(user("admin"), "2026-09-25T00:00:00Z");

    expect(result.orders[0]).toEqual({
      id: "o1",
      total_amount: 9_105_300,
      shipping_name: "swan yi",
      created_at: "2026-09-25T01:00:00Z",
      payment_method: "cash_on_delivery",
      items: [
        { name: "HP Elitebook 840 G8", quantity: 5 },
        { name: "Mouse", quantity: 1 },
      ],
      item_count: 3,
    });
  });

  it("needs a valid time and returns the newest few", async () => {
    await expect(getNewOrders(user("admin"), null)).rejects.toThrow();
    await expect(getNewOrders(user("admin"), "yesterday")).rejects.toThrow();
    vi.mocked(db.selectOrdersSince).mockResolvedValue(
      [4, 3, 2, 1].map((n) => ({ id: `o${n}`, created_at: `2026-09-25T0${n}:00:00Z`, total_amount: n, shipping_name: "A" })) as never
    );
    const result = await getNewOrders(user("admin"), "2026-09-25T00:00:00Z");
    expect(result.count).toBe(4);
    expect(result.orders.map((o) => o.id)).toEqual(["o4", "o3", "o2"]);
    expect(result.latestAt).toBe("2026-09-25T04:00:00Z");
  });
});

describe("recording admin actions", () => {
  it("never throws if the log write fails", async () => {
    vi.mocked(db.insertAuditLog).mockRejectedValue(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(recordAdminAction({ actorId: "u1", action: "product.create", targetType: "product", targetId: 5 })).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("describes only the product fields that really changed", () => {
    const change = productChange({ name: "A", price: 100, stock_quantity: 5 }, { name: "A", price: 120, stockQuantity: 5, specs: {}, image: "x" });
    expect(change.previous).toEqual({ price: 100 });
    expect(change.next).toEqual({ price: 120, also_edited: "specs, image" });
  });
});
