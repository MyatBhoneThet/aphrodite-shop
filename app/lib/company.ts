import { z } from "zod";
import { isPrepaidMethod } from "./payment-accounts";

/**
 * Wholesale (B2B) rules that do not touch the database, kept pure so they can
 * be tested and shared between the server, the cart and the invoice page.
 */

// ---------------------------------------------------------------------------
// Company details
// ---------------------------------------------------------------------------

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null));

export const companyDetailsSchema = z.object({
  /** Tax or registration number. Optional: not every business has one. */
  tax_id: optionalText(60),
  address: z.string().trim().min(5, "Enter your company address.").max(400),
  billing_name: optionalText(160),
  billing_phone: optionalText(40),
  billing_email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable()
    .refine((value) => !value || /^\S+@\S+\.\S+$/.test(value), "Enter a valid billing email address.")
    .transform((value) => (value ? value : null)),
});

export type CompanyDetailsInput = z.infer<typeof companyDetailsSchema>;

export type LicenceStatus = "none" | "pending" | "verified" | "rejected";

export const LICENCE_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export const MAX_LICENCE_BYTES = 10 * 1024 * 1024;

/** Set WHOLESALE_REQUIRE_LICENCE=true to withhold wholesale prices until an admin has verified the licence. */
export function licenceRequired(env: Record<string, string | undefined> = process.env) {
  return env.WHOLESALE_REQUIRE_LICENCE?.trim().toLowerCase() === "true";
}

// ---------------------------------------------------------------------------
// Purchase-order number
// ---------------------------------------------------------------------------

export const poNumberSchema = z
  .string()
  .trim()
  .max(60, "A PO number can be at most 60 characters.")
  .optional()
  .nullable()
  .transform((value) => (value ? value : null));

// ---------------------------------------------------------------------------
// Wholesale order rules (minimum order, pay first)
// ---------------------------------------------------------------------------

export type WholesaleRules = {
  /** Smallest order total in MMK. 0 = no minimum. */
  minAmount: number;
  /** Smallest number of items. 0 = no minimum. */
  minUnits: number;
  /** Wholesale orders must be paid by bank transfer before anything ships. */
  prepayRequired: boolean;
};

export const DEFAULT_WHOLESALE_RULES: WholesaleRules = { minAmount: 0, minUnits: 0, prepayRequired: true };

export const wholesaleRulesSchema = z.object({
  min_amount: z.number().int("Use whole kyats.").min(0, "The minimum cannot be negative.").max(2_000_000_000),
  min_units: z.number().int("Use a whole number of items.").min(0, "The minimum cannot be negative.").max(10_000),
  prepay_required: z.boolean(),
});

export function rulesFromSetting(value: unknown): WholesaleRules {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const whole = (input: unknown, fallback: number) =>
    typeof input === "number" && Number.isInteger(input) && input >= 0 ? input : fallback;
  return {
    minAmount: whole(raw.min_amount, DEFAULT_WHOLESALE_RULES.minAmount),
    minUnits: whole(raw.min_units, DEFAULT_WHOLESALE_RULES.minUnits),
    prepayRequired: typeof raw.prepay_required === "boolean" ? raw.prepay_required : DEFAULT_WHOLESALE_RULES.prepayRequired,
  };
}

/** Why this order may not be placed at wholesale terms, or null when it is fine. */
export function wholesaleOrderProblem(
  rules: WholesaleRules,
  order: { total: number; units: number; paymentMethod: string | null | undefined }
) {
  if (rules.minAmount > 0 && order.total < rules.minAmount) {
    return `Wholesale orders start at MMK ${rules.minAmount.toLocaleString("en-US")}. Add MMK ${(rules.minAmount - order.total).toLocaleString("en-US")} more to continue.`;
  }
  if (rules.minUnits > 0 && order.units < rules.minUnits) {
    return `Wholesale orders need at least ${rules.minUnits} item${rules.minUnits === 1 ? "" : "s"}. Add ${rules.minUnits - order.units} more to continue.`;
  }
  if (rules.prepayRequired && !(isPrepaidMethod(order.paymentMethod) && order.paymentMethod === "bank_transfer")) {
    return "Wholesale orders are paid by bank transfer before delivery. Choose bank transfer to continue.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Invoice / proforma
// ---------------------------------------------------------------------------

export type InvoiceKind = "proforma" | "invoice";

type InvoiceOrderFields = {
  status: string;
  payment_method?: string | null;
  payment_status?: string | null;
  payment_verification_status?: string | null;
};

/**
 * A proforma invoice asks for payment; an invoice records that it was made.
 * Prepaid (bank transfer) orders turn into an invoice once an admin has
 * verified the slip; anything delivered/collected is an invoice too.
 */
export function invoiceKind(order: InvoiceOrderFields): InvoiceKind {
  if (order.payment_status === "collected" || order.status === "delivered") return "invoice";
  if (isPrepaidMethod(order.payment_method) && order.payment_verification_status === "verified") return "invoice";
  return "proforma";
}

export function invoiceNumber(order: { id: string; receipt_number?: string | null }, kind: InvoiceKind) {
  const short = order.id.slice(0, 8).toUpperCase();
  if (kind === "proforma") return `PRO-${short}`;
  return order.receipt_number ? `INV-${order.receipt_number}` : `INV-${short}`;
}

export type SellerDetails = { name: string; address: string; phones: string[]; taxId: string | null; email: string | null };

/** The seller block printed on invoices. Tax number and email only appear when configured. */
export function sellerDetails(
  base: { name: string; address: string; phones: readonly string[] },
  env: Record<string, string | undefined> = process.env
): SellerDetails {
  return {
    name: env.SELLER_NAME?.trim() || base.name,
    address: env.SELLER_ADDRESS?.trim() || base.address,
    phones: [...base.phones],
    taxId: env.SELLER_TAX_ID?.trim() || null,
    email: env.GMAIL_USER?.trim() || null,
  };
}
