import { badRequest, serviceUnavailable } from "./errors";
import { csvDocument, csvRow } from "./csv";
import { requireFreshAuth } from "./mfa";
import { formatYangon, parseExportRange } from "./report-range";
import {
  requireAdmin,
  requireBackoffice,
  selectLowStockProducts,
  selectOrdersForExport,
  selectSiteFeedback,
  type CurrentUser,
  type ExportOrderRow,
} from "./supabase";

export const DEFAULT_LOW_STOCK_THRESHOLD = 5;
const MAX_LOW_STOCK_THRESHOLD = 50;

/** Counts toward revenue only while the sale still stands. */
const countsAsSale = (order: Pick<ExportOrderRow, "status">) =>
  order.status !== "cancelled" && order.status !== "returned";

export async function getLowStockProducts(user: CurrentUser, requested?: string | null) {
  requireBackoffice(user);
  const parsed = requested === undefined || requested === null || requested === "" ? DEFAULT_LOW_STOCK_THRESHOLD : Number(requested);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LOW_STOCK_THRESHOLD) {
    throw badRequest(`Low-stock level must be a whole number from 1 to ${MAX_LOW_STOCK_THRESHOLD}.`);
  }
  const rows = await selectLowStockProducts(parsed);
  return {
    threshold: parsed,
    outOfStock: rows.filter((row) => (row.stock_quantity ?? 0) <= 0),
    low: rows.filter((row) => (row.stock_quantity ?? 0) > 0),
  };
}

const FEEDBACK_LIMIT = 500;

export async function listSiteFeedback(user: CurrentUser) {
  requireAdmin(user);
  let items;
  try {
    items = await selectSiteFeedback(FEEDBACK_LIMIT);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("site_feedback")) {
      throw serviceUnavailable("Customer feedback is not set up yet. Run supabase/migrations/2026-09-25-site-feedback.sql in the Supabase SQL Editor.");
    }
    throw error;
  }
  const counts: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const item of items) if (item.rating >= 1 && item.rating <= 5) counts[item.rating as 1 | 2 | 3 | 4 | 5] += 1;
  const total = items.length;
  const average = total ? Math.round((items.reduce((sum, item) => sum + item.rating, 0) / total) * 10) / 10 : 0;
  return { summary: { total, average, counts, limit: FEEDBACK_LIMIT }, items };
}

const productLine = (order: ExportOrderRow) =>
  (order.order_items ?? []).map((item) => `${item.products?.name ?? "Product"} x${item.quantity}`).join("; ");
const itemCount = (order: ExportOrderRow) =>
  (order.order_items ?? []).reduce((sum, item) => sum + item.quantity, 0);

/** Accounting export: one row per order, or one row per customer, for a Yangon-day range. Admin only (it holds contact details). */
export async function buildExportCsv(
  user: CurrentUser,
  kind: string | null,
  from: string | null,
  to: string | null
) {
  requireAdmin(user);
  requireFreshAuth(user);
  if (kind !== "orders" && kind !== "customers") throw badRequest("Choose orders or customers.");
  const { startIso, endIso } = parseExportRange(from, to);
  const { rows, truncated } = await selectOrdersForExport(startIso, endIso);
  if (truncated) throw badRequest("That range has too many orders to export at once. Choose a shorter range.");

  const header = [`Aphrodite Myanmar ${kind === "orders" ? "orders" : "customers"} export`];
  const meta = [
    csvRow(header),
    csvRow(["Range (Yangon time)", `${from} to ${to}`]),
    csvRow(["Generated at", formatYangon(new Date().toISOString())]),
    "",
  ];

  if (kind === "orders") {
    return csvDocument([
      ...meta,
      csvRow([
        "Order ID", "PO number", "Placed (Yangon)", "Status", "Customer", "Email", "Phone", "Township", "Address",
        "Items", "Products", "Total (MMK)", "Payment method", "Payment account", "Payment status",
        "Receipt no.", "Delivered (Yangon)", "Courier", "Tracking no.",
      ]),
      ...rows.map((order) => csvRow([
        order.id, order.po_number, formatYangon(order.created_at), order.status,
        order.shipping_name || order.profiles?.full_name, order.profiles?.email, order.shipping_phone,
        order.shipping_city, order.shipping_address, itemCount(order), productLine(order), order.total_amount,
        order.payment_method, order.payment_account, order.payment_status,
        order.receipt_number, formatYangon(order.delivered_at), order.courier_name, order.delivery_tracking_number,
      ])),
    ]);
  }

  const customers = new Map<string, { name: string; email: string; phone: string; orders: number; sales: number; spent: number; first: string; last: string }>();
  for (const order of rows) {
    const entry = customers.get(order.user_id) ?? {
      name: order.profiles?.full_name || order.shipping_name,
      email: order.profiles?.email ?? "",
      phone: order.shipping_phone,
      orders: 0, sales: 0, spent: 0,
      first: order.created_at, last: order.created_at,
    };
    entry.orders += 1;
    if (countsAsSale(order)) {
      entry.sales += 1;
      entry.spent += Number(order.total_amount || 0);
    }
    if (order.created_at < entry.first) entry.first = order.created_at;
    if (order.created_at >= entry.last) {
      entry.last = order.created_at;
      entry.phone = order.shipping_phone; // the most recent contact number
    }
    customers.set(order.user_id, entry);
  }
  return csvDocument([
    ...meta,
    csvRow(["Customer", "Email", "Phone", "Orders placed", "Completed sales", "Total spent (MMK)", "First order (Yangon)", "Last order (Yangon)"]),
    ...[...customers.values()]
      .sort((left, right) => right.spent - left.spent)
      .map((entry) => csvRow([entry.name, entry.email, entry.phone, entry.orders, entry.sales, entry.spent, formatYangon(entry.first), formatYangon(entry.last)])),
  ]);
}
