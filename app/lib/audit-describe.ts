export type AuditEntryLike = {
  action: string;
  target_type: string;
  target_id: string;
  previous_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
};

/** Filter groups for the activity log. Prefix match on `audit_log.action`. */
export const AUDIT_CATEGORIES = [
  { id: "orders", label: "Orders", prefixes: ["order."] },
  { id: "products", label: "Products", prefixes: ["product.", "sheet_"] },
  { id: "pricing", label: "Pricing", prefixes: ["price_list.", "tier."] },
  { id: "wholesale", label: "Wholesale", prefixes: ["wholesale."] },
  { id: "staff", label: "Staff", prefixes: ["staff."] },
  { id: "support", label: "Support & returns", prefixes: ["support.", "help_case.", "return_request.", "advance_return"] },
  { id: "ads", label: "Advertisements", prefixes: ["home_ad."] },
] as const;

export type AuditCategoryId = (typeof AUDIT_CATEGORIES)[number]["id"];

export function categoryById(id: string | null | undefined) {
  return AUDIT_CATEGORIES.find((category) => category.id === id) ?? null;
}

export function categoryOf(action: string) {
  return AUDIT_CATEGORIES.find((category) => category.prefixes.some((prefix) => action.startsWith(prefix))) ?? null;
}

const LABELS: Record<string, string> = {
  "order.status.update": "Changed order status",
  "order.delivery.progress": "Moved delivery forward",
  "order.delivery.attempt_failed": "Recorded a failed delivery attempt",
  "order.payment.verify": "Checked a payment",
  "order.courier.update": "Saved courier and tracking details",
  "order.receipt_email.resend": "Resent a receipt email",
  "order.cancellation_refund.details_submitted": "Customer sent refund details",
  "order.cancellation_refund.sent": "Marked a cancellation refund as sent",
  "product.create": "Added a product",
  "product.update": "Edited a product",
  "product.delete": "Deleted a product",
  "product.sync": "Ran a Google Sheet product sync",
  "product.stock.sheet_write": "Changed stock (written to the sheet)",
  sheet_write_back_failed: "Sheet write-back failed",
  "price_list.create": "Created a price list",
  "price_list.update": "Edited a price list",
  "tier.create": "Added a quantity price tier",
  "tier.update": "Edited a quantity price tier",
  "tier.delete": "Removed a quantity price tier",
  "wholesale.account.grant": "Approved a wholesale account",
  "wholesale.account.revoke": "Revoked wholesale access",
  "wholesale.account.suspend": "Suspended a wholesale account",
  "wholesale.account.reactivate": "Reactivated a wholesale account",
  "wholesale.account.assign_price_list": "Assigned a price list",
  "wholesale.invite.create": "Created a wholesale invite code",
  "wholesale.invite.deactivate": "Deactivated an invite code",
  "wholesale.invite.redeem": "Invite code used",
  "staff.grant": "Gave someone staff access",
  "staff.delete": "Removed staff access",
  "home_ad.create": "Added a homepage advertisement",
  "home_ad.update": "Edited a homepage advertisement",
  "home_ad.delete": "Deleted a homepage advertisement",
  "customer.note": "Added a customer note",
};

export function actionLabel(action: string) {
  if (LABELS[action]) return LABELS[action];
  const text = action.replaceAll(".", " · ").replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Never print values that could be credentials or payment details.
const HIDDEN_KEY = /secret|token|password|passcode|account_number|account_name|bank|card|authorization/i;

const show = (value: unknown) => (value === null || value === undefined || value === "" ? "–" : String(value));
const isPlain = (value: unknown) =>
  value === null || ["string", "number", "boolean"].includes(typeof value);

/** Up to `max` short "field: old → new" lines. Nested data and sensitive keys are skipped. */
export function changeSummary(entry: Pick<AuditEntryLike, "previous_data" | "new_data">, max = 4) {
  const before = entry.previous_data ?? {};
  const after = entry.new_data ?? {};
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) => !HIDDEN_KEY.test(key));
  const lines: string[] = [];
  for (const key of keys) {
    const prev = before[key];
    const next = after[key];
    if (!isPlain(prev ?? null) || !isPlain(next ?? null)) continue;
    if (key in before && key in after) {
      if (prev === next) continue;
      lines.push(`${key.replaceAll("_", " ")}: ${show(prev)} → ${show(next)}`);
    } else if (key in after) {
      lines.push(`${key.replaceAll("_", " ")}: ${show(next)}`);
    } else {
      lines.push(`${key.replaceAll("_", " ")} was ${show(prev)}`);
    }
    if (lines.length >= max) break;
  }
  return lines;
}

export function targetLabel(entry: Pick<AuditEntryLike, "target_type" | "target_id">) {
  const id = entry.target_id.length > 12 ? entry.target_id.slice(0, 8).toUpperCase() : entry.target_id;
  return `${entry.target_type.replaceAll("_", " ")} ${entry.target_type === "order" ? "#" : ""}${id}`;
}
