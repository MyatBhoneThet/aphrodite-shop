import { notifyCartReminder } from "./notifications";
import {
  selectNotificationTimesByKindService,
  selectOrderTimesSinceService,
  selectProfilesByIdsService,
  selectRecentCartItemsService,
  type RecentCartItemRow,
} from "./supabase";

/**
 * "You left 2 items in your cart."
 *
 * Runs from the same scheduled call that syncs the Google Sheet (every few
 * minutes), so there is no extra job to set up. The rules are deliberately
 * gentle -- a reminder is a nudge, not a nag:
 *
 *  - only after the cart has been untouched for a day, and never for carts
 *    older than a week
 *  - only for items that can actually be bought right now
 *  - skipped when the customer ordered after they last touched the cart
 *  - at most one reminder per customer every three days, and one per cart state
 *  - never for admin/staff accounts
 */

const HOUR = 60 * 60 * 1000;
export const REMIND_AFTER_MS = 24 * HOUR;
export const STOP_AFTER_MS = 7 * 24 * HOUR;
export const NO_REPEAT_MS = 3 * 24 * HOUR;
export const MAX_REMINDERS_PER_RUN = 100;
const RUN_EVERY_MS = 30 * 60 * 1000;

export type CartReminder = { userId: string; names: string[]; lastChangedAt: string };

/** Pure: which customers should be reminded, given what the database said. */
export function cartRemindersDue(input: {
  rows: RecentCartItemRow[];
  /** Customer ids that may receive reminders (admin/staff are left out). */
  customerIds: Set<string>;
  /** Latest order time per customer, after the cart window started. */
  lastOrderAt: Map<string, string>;
  /** Customers who already had a reminder inside the no-repeat window. */
  recentlyReminded: Set<string>;
  now: number;
}): CartReminder[] {
  const byCustomer = new Map<string, { lastChanged: number; lastChangedAt: string; names: string[] }>();

  for (const row of input.rows) {
    if (!input.customerIds.has(row.user_id)) continue;
    const changed = Date.parse(row.updated_at);
    if (!Number.isFinite(changed)) continue;

    const entry = byCustomer.get(row.user_id) ?? { lastChanged: 0, lastChangedAt: row.updated_at, names: [] };
    if (changed > entry.lastChanged) {
      entry.lastChanged = changed;
      entry.lastChangedAt = row.updated_at;
    }

    const product = row.products;
    const buyable = product && Number.isFinite(product.price) && product.price > 0 && product.stock === "In Stock";
    if (buyable && !entry.names.includes(product.name)) entry.names.push(product.name);

    byCustomer.set(row.user_id, entry);
  }

  const due: CartReminder[] = [];
  for (const [userId, entry] of byCustomer) {
    if (entry.names.length === 0) continue;
    if (input.now - entry.lastChanged < REMIND_AFTER_MS) continue;
    if (input.now - entry.lastChanged > STOP_AFTER_MS) continue;
    if (input.recentlyReminded.has(userId)) continue;

    const orderedAt = Date.parse(input.lastOrderAt.get(userId) ?? "");
    if (Number.isFinite(orderedAt) && orderedAt > entry.lastChanged) continue;

    due.push({ userId, names: entry.names, lastChangedAt: entry.lastChangedAt });
  }

  return due.sort((left, right) => Date.parse(left.lastChangedAt) - Date.parse(right.lastChangedAt));
}

let lastRunAt = 0;
let running = false;

/** One scan. Never throws, and does nothing if it ran in the last half hour. */
export async function runCartReminders(now: number = Date.now(), force = false): Promise<number> {
  if (running || (!force && now - lastRunAt < RUN_EVERY_MS)) return 0;
  running = true;
  lastRunAt = now;

  try {
    const since = new Date(now - STOP_AFTER_MS).toISOString();
    const rows = await selectRecentCartItemsService(since);
    if (rows.length === 0) return 0;

    const userIds = [...new Set(rows.map((row) => row.user_id))];
    const [profiles, orders, reminded] = await Promise.all([
      selectProfilesByIdsService(userIds),
      selectOrderTimesSinceService(userIds, since),
      selectNotificationTimesByKindService(userIds, "cart_reminder", new Date(now - NO_REPEAT_MS).toISOString()),
    ]);

    const lastOrderAt = new Map<string, string>();
    for (const order of orders) {
      const known = lastOrderAt.get(order.user_id);
      if (!known || Date.parse(order.created_at) > Date.parse(known)) lastOrderAt.set(order.user_id, order.created_at);
    }

    const due = cartRemindersDue({
      rows,
      customerIds: new Set(
        profiles.filter((profile) => profile.role === "normal" || profile.role === "wholesale").map((profile) => profile.id)
      ),
      lastOrderAt,
      recentlyReminded: new Set(reminded.map((entry) => entry.user_id)),
      now,
    }).slice(0, MAX_REMINDERS_PER_RUN);

    let sent = 0;
    for (const reminder of due) {
      const result = await notifyCartReminder(
        reminder.userId,
        reminder.names.map((name) => ({ name })),
        reminder.lastChangedAt
      );
      if (result === "sent") sent += 1;
    }
    return sent;
  } catch (error) {
    console.error("[cart-reminders] scan failed", error instanceof Error ? error.message : error);
    return 0;
  } finally {
    running = false;
  }
}
