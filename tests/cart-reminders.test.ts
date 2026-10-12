import { describe, expect, it } from "vitest";
import { NO_REPEAT_MS, REMIND_AFTER_MS, STOP_AFTER_MS, cartRemindersDue } from "../app/lib/cart-reminders";
import type { RecentCartItemRow } from "../app/lib/supabase";

const NOW = Date.parse("2026-10-12T06:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const HOUR = 60 * 60 * 1000;

function line(userId: string, name: string, ageMs: number, overrides: Partial<NonNullable<RecentCartItemRow["products"]>> = {}): RecentCartItemRow {
  return {
    user_id: userId,
    product_id: Math.abs(name.length * 7),
    quantity: 1,
    build_group_id: null,
    updated_at: ago(ageMs),
    products: { id: 1, name, price: 50_000, stock: "In Stock", ...overrides },
  };
}

function due(rows: RecentCartItemRow[], extra: Partial<Parameters<typeof cartRemindersDue>[0]> = {}) {
  return cartRemindersDue({
    rows,
    customerIds: new Set(["u1", "u2"]),
    lastOrderAt: new Map(),
    recentlyReminded: new Set(),
    now: NOW,
    ...extra,
  });
}

describe("cartRemindersDue", () => {
  it("reminds a customer whose cart has sat for a day", () => {
    const result = due([line("u1", "Mouse", 25 * HOUR), line("u1", "Keyboard", 30 * HOUR)]);
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe("u1");
    expect(result[0].names).toEqual(["Mouse", "Keyboard"]);
    // The cart's last change is its newest line, which is what makes the reminder unique.
    expect(result[0].lastChangedAt).toBe(ago(25 * HOUR));
  });

  it("waits while the cart is fresh, and gives up on very old carts", () => {
    expect(due([line("u1", "Mouse", REMIND_AFTER_MS - HOUR)])).toEqual([]);
    expect(due([line("u1", "Mouse", STOP_AFTER_MS + HOUR)])).toEqual([]);
  });

  it("a recently touched line keeps the whole cart quiet", () => {
    expect(due([line("u1", "Mouse", 50 * HOUR), line("u1", "Keyboard", 2 * HOUR)])).toEqual([]);
  });

  it("only mentions items that can be bought right now", () => {
    const result = due([
      line("u1", "Sold out", 30 * HOUR, { stock: "Out of Stock" }),
      line("u1", "No price", 30 * HOUR, { price: 0 }),
      line("u1", "Mouse", 30 * HOUR),
    ]);
    expect(result[0].names).toEqual(["Mouse"]);
    expect(due([line("u1", "Sold out", 30 * HOUR, { stock: "Out of Stock" })])).toEqual([]);
  });

  it("skips back-office accounts, recent reminders and customers who ordered after the cart changed", () => {
    const rows = [line("u1", "Mouse", 30 * HOUR), line("u2", "Mouse", 30 * HOUR), line("admin", "Mouse", 30 * HOUR)];
    expect(due(rows).map((entry) => entry.userId)).toEqual(["u1", "u2"]);
    expect(due(rows, { recentlyReminded: new Set(["u1"]) }).map((entry) => entry.userId)).toEqual(["u2"]);
    expect(due(rows, { lastOrderAt: new Map([["u2", ago(5 * HOUR)]]) }).map((entry) => entry.userId)).toEqual(["u1"]);
    // An order from BEFORE the last cart change does not silence the reminder.
    expect(due(rows, { lastOrderAt: new Map([["u2", ago(40 * HOUR)]]) }).map((entry) => entry.userId)).toEqual(["u1", "u2"]);
  });

  it("repeat window is three days", () => {
    expect(NO_REPEAT_MS).toBe(3 * 24 * HOUR);
  });
});
