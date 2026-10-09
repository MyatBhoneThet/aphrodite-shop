import { describe, expect, it } from "vitest";
import { emptyOrderFilters, filterOrders, ORDER_PAGE_SIZE, pageCount, paginate } from "../app/lib/admin-order-filter";

const order = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  status: "pending",
  created_at: "2026-09-24T15:00:00.000Z",
  shipping_name: "Thukha Nyan",
  shipping_phone: "09 54-678667",
  profiles: { email: "thukha@example.com" },
  ...over,
});

const orders = [
  order("c0a1ce22-0000-4000-8000-000000000001"),
  order("7ce9ec3c-0000-4000-8000-000000000002", { status: "delivered", shipping_name: "Aye Aye", shipping_phone: "09420082522", created_at: "2026-09-01T05:00:00.000Z", profiles: { email: "aye@example.com" } }),
];
const staff = { includeContact: false };
const admin = { includeContact: true };

describe("admin order filtering", () => {
  it("finds an order by its number, with or without #, any case", () => {
    expect(filterOrders(orders, { ...emptyOrderFilters, query: "#C0A1CE22" }, admin)).toHaveLength(1);
    expect(filterOrders(orders, { ...emptyOrderFilters, query: "7ce9" }, admin)[0].shipping_name).toBe("Aye Aye");
  });

  it("finds by name, and by phone ignoring spaces and dashes", () => {
    expect(filterOrders(orders, { ...emptyOrderFilters, query: "aye" }, admin)).toHaveLength(1);
    expect(filterOrders(orders, { ...emptyOrderFilters, query: "0954678667" }, admin)).toHaveLength(1);
    expect(filterOrders(orders, { ...emptyOrderFilters, query: "954-678" }, admin)).toHaveLength(1);
  });

  it("finds by email for admins", () => {
    expect(filterOrders(orders, { ...emptyOrderFilters, query: "aye@example" }, admin)).toHaveLength(1);
  });

  it("does not let staff find orders by phone or email they cannot see", () => {
    expect(filterOrders(orders, { ...emptyOrderFilters, query: "0954678667" }, staff)).toHaveLength(0);
    expect(filterOrders(orders, { ...emptyOrderFilters, query: "aye@example" }, staff)).toHaveLength(0);
    expect(filterOrders(orders, { ...emptyOrderFilters, query: "aye" }, staff)).toHaveLength(1);
  });

  it("filters by status and by an inclusive date range", () => {
    expect(filterOrders(orders, { ...emptyOrderFilters, status: "delivered" }, admin)).toHaveLength(1);
    expect(filterOrders(orders, { ...emptyOrderFilters, from: "2026-09-10" }, admin)).toHaveLength(1);
    expect(filterOrders(orders, { ...emptyOrderFilters, to: "2026-09-10" }, admin)).toHaveLength(1);
    expect(filterOrders(orders, { ...emptyOrderFilters, from: "2026-09-01", to: "2026-09-30" }, admin)).toHaveLength(2);
  });

  it("returns everything with empty filters", () => {
    expect(filterOrders(orders, emptyOrderFilters, admin)).toHaveLength(2);
  });
});

describe("admin order paging", () => {
  const many = Array.from({ length: ORDER_PAGE_SIZE * 2 + 5 }, (_, i) => i);

  it("slices pages and counts them", () => {
    expect(pageCount(many.length)).toBe(3);
    expect(paginate(many, 1).items).toHaveLength(ORDER_PAGE_SIZE);
    expect(paginate(many, 3).items).toEqual([40, 41, 42, 43, 44]);
  });

  it("clamps an out-of-range page so a shrinking list is never empty", () => {
    expect(paginate(many, 99).page).toBe(3);
    expect(paginate(many, 0).page).toBe(1);
    expect(paginate([], 5)).toEqual({ page: 1, items: [] });
  });
});
