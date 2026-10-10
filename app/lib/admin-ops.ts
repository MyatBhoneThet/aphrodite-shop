import { z } from "zod";
import { badRequest, notFound, serviceUnavailable } from "./errors";
import { recordAdminAction } from "./admin-audit";
import { AUDIT_CATEGORIES, categoryById } from "./audit-describe";
import {
  insertCustomerNote,
  requireAdmin,
  requireBackoffice,
  selectActivityLog,
  selectCustomerNotes,
  selectCustomerProfile,
  selectCustomersPage,
  selectOrderSummariesForUsers,
  selectOrdersOfCustomer,
  selectOrdersSince,
  type CurrentUser,
} from "./supabase";

const ACTIVITY_PAGE = 30;

export async function listActivity(user: CurrentUser, categoryId: string | null, offsetParam: string | null) {
  requireAdmin(user);
  const category = categoryId ? categoryById(categoryId) : null;
  if (categoryId && !category) throw badRequest("Choose a valid category.");
  const offset = Number(offsetParam ?? 0);
  if (!Number.isInteger(offset) || offset < 0) throw badRequest("Invalid page.");
  // Ask for one extra row so the screen knows whether there is a next page.
  const rows = await selectActivityLog({ limit: ACTIVITY_PAGE + 1, offset, prefixes: category?.prefixes });
  return {
    categories: AUDIT_CATEGORIES.map(({ id, label }) => ({ id, label })),
    entries: rows.slice(0, ACTIVITY_PAGE),
    hasMore: rows.length > ACTIVITY_PAGE,
    nextOffset: offset + ACTIVITY_PAGE,
  };
}

const CUSTOMER_PAGE = 25;
const countsAsSale = (status: string) => status !== "cancelled" && status !== "returned";

export async function listCustomers(user: CurrentUser, search: string | null, offsetParam: string | null) {
  requireAdmin(user);
  const offset = Number(offsetParam ?? 0);
  if (!Number.isInteger(offset) || offset < 0) throw badRequest("Invalid page.");
  const { rows, total } = await selectCustomersPage(search ?? "", CUSTOMER_PAGE, offset);
  const orders = await selectOrderSummariesForUsers(rows.map((row) => row.id));
  const customers = rows.map((profile) => {
    const own = orders.filter((order) => order.user_id === profile.id);
    return {
      ...profile,
      orderCount: own.length,
      totalSpent: own.filter((order) => countsAsSale(order.status)).reduce((sum, order) => sum + Number(order.total_amount || 0), 0),
      lastOrderAt: own[0]?.created_at ?? null, // newest first
    };
  });
  return { customers, total, hasMore: offset + CUSTOMER_PAGE < total, nextOffset: offset + CUSTOMER_PAGE };
}

function notesUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("customer_notes");
}

export async function getCustomerDetail(user: CurrentUser, id: string) {
  requireAdmin(user);
  if (!z.string().uuid().safeParse(id).success) throw notFound("Customer not found.");
  const profile = await selectCustomerProfile(id);
  if (!profile) throw notFound("Customer not found.");
  const [orders, notes] = await Promise.all([
    selectOrdersOfCustomer(id),
    selectCustomerNotes(id).catch((error) => {
      if (notesUnavailable(error)) return null;
      throw error;
    }),
  ]);
  return {
    profile,
    orders,
    totalSpent: orders.filter((order) => countsAsSale(order.status)).reduce((sum, order) => sum + Number(order.total_amount || 0), 0),
    notes: notes ?? [],
    notesAvailable: notes !== null,
  };
}

export const customerNoteSchema = z.object({
  body: z.string().trim().min(1, "Write the note before saving it.").max(2000, "Notes must be 2000 characters or fewer."),
});

export async function addCustomerNote(user: CurrentUser, customerId: string, input: unknown) {
  requireAdmin(user);
  const parsed = customerNoteSchema.safeParse(input);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid note.");
  if (!(await selectCustomerProfile(customerId))) throw notFound("Customer not found.");
  let note;
  try {
    note = await insertCustomerNote({ customer_id: customerId, author_id: user.id, body: parsed.data.body });
  } catch (error) {
    if (notesUnavailable(error)) {
      throw serviceUnavailable("Customer notes are not set up yet. Run supabase/migrations/2026-10-09-customer-notes.sql in the Supabase SQL Editor.");
    }
    throw error;
  }
  await recordAdminAction({
    actorId: user.id,
    action: "customer.note",
    targetType: "customer",
    targetId: customerId,
    next: { length: parsed.data.body.length },
  });
  return note;
}

/** Orders placed after `since` (an ISO time), for the "new order" alert. Staff may poll it. */
export async function getNewOrders(user: CurrentUser, since: string | null) {
  requireBackoffice(user);
  const time = since ? Date.parse(since) : NaN;
  if (Number.isNaN(time)) throw badRequest("Send the time of the last check.");
  const rows = await selectOrdersSince(new Date(time).toISOString());
  return {
    count: rows.length,
    capped: rows.length >= 50,
    latestAt: rows[0]?.created_at ?? null,
    orders: rows.slice(0, 3).map((row) => ({ id: row.id, total_amount: row.total_amount, shipping_name: row.shipping_name })),
  };
}
