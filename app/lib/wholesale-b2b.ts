import { randomUUID } from "node:crypto";
import { recordAdminAction } from "./admin-audit";
import { APHRODITE_BRANCHES } from "./contact-info";
import {
  companyDetailsSchema,
  DEFAULT_WHOLESALE_RULES,
  invoiceKind,
  invoiceNumber,
  LICENCE_TYPES,
  licenceRequired,
  MAX_LICENCE_BYTES,
  rulesFromSetting,
  sellerDetails,
  wholesaleRulesSchema,
  type WholesaleRules,
} from "./company";
import { badRequest, conflict, forbidden, notFound } from "./errors";
import { paymentAccountsFor } from "./payment-accounts";
import {
  createBusinessLicenceSignedUrl,
  deleteBusinessLicenceObject,
  requireAdmin,
  selectCompanyDetails,
  selectOrderById,
  selectProfileByIdService,
  selectShopSetting,
  upsertCompanyDetails,
  upsertShopSetting,
  uploadBusinessLicenceObject,
  type CompanyDetailsRow,
  type CurrentUser,
} from "./supabase";

const RULES_KEY = "wholesale_rules";
const RULES_CACHE_MS = 30_000;
let rulesCache: { at: number; rules: WholesaleRules } | null = null;

/** The wholesale minimum order / pay-first settings. Cached for 30 seconds; defaults if unreadable. */
export async function getWholesaleRules(): Promise<WholesaleRules> {
  if (rulesCache && Date.now() - rulesCache.at < RULES_CACHE_MS) return rulesCache.rules;
  try {
    const rules = rulesFromSetting(await selectShopSetting(RULES_KEY));
    rulesCache = { at: Date.now(), rules };
    return rules;
  } catch (error) {
    // Table not created yet (or a blip): fall back to the safe defaults rather than breaking checkout.
    console.error("[wholesale] could not read wholesale rules", error instanceof Error ? error.message : error);
    return DEFAULT_WHOLESALE_RULES;
  }
}

export function resetWholesaleRulesCache() {
  rulesCache = null;
}

export async function saveWholesaleRules(user: CurrentUser, input: unknown) {
  requireAdmin(user);
  const parsed = wholesaleRulesSchema.safeParse(input);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid settings.");
  const before = rulesFromSetting(await selectShopSetting(RULES_KEY).catch(() => null));
  await upsertShopSetting(RULES_KEY, parsed.data, user.id);
  resetWholesaleRulesCache();
  await recordAdminAction({
    actorId: user.id,
    action: "wholesale.rules.update",
    targetType: "shop_settings",
    targetId: RULES_KEY,
    previous: { min_amount: before.minAmount, min_units: before.minUnits, prepay_required: before.prepayRequired },
    next: parsed.data,
  });
  return rulesFromSetting(parsed.data);
}

// ---------------------------------------------------------------------------
// The buyer's own company page
// ---------------------------------------------------------------------------

function requireWholesaleAccount(user: CurrentUser) {
  if (user.role !== "wholesale") throw forbidden("Company details are for wholesale accounts.");
}

/** What the buyer may see about their own record. The storage path stays on the server. */
function publicCompany(details: CompanyDetailsRow | null) {
  return {
    tax_id: details?.tax_id ?? null,
    address: details?.address ?? null,
    billing_name: details?.billing_name ?? null,
    billing_phone: details?.billing_phone ?? null,
    billing_email: details?.billing_email ?? null,
    licence: {
      status: details?.licence_status ?? "none",
      file_name: details?.licence_file_name ?? null,
      submitted_at: details?.licence_submitted_at ?? null,
      review_note: details?.licence_review_note ?? null,
    },
  };
}

export async function getOwnCompany(user: CurrentUser) {
  requireWholesaleAccount(user);
  return {
    business_name: user.profile.business_name ?? null,
    licence_required: licenceRequired(),
    ...publicCompany(await selectCompanyDetails(user.id)),
  };
}

export async function saveOwnCompany(user: CurrentUser, input: unknown) {
  requireWholesaleAccount(user);
  const parsed = companyDetailsSchema.safeParse(input);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Check the company details.");
  const saved = await upsertCompanyDetails(user.id, parsed.data);
  return { ...publicCompany(saved) };
}

const safeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-80) || "licence";

export async function uploadOwnLicence(user: CurrentUser, file: File) {
  requireWholesaleAccount(user);
  if (!(LICENCE_TYPES as readonly string[]).includes(file.type)) {
    throw badRequest("Upload a JPG, PNG, WebP or PDF of your business licence.");
  }
  if (file.size <= 0 || file.size > MAX_LICENCE_BYTES) throw badRequest("The file must be 10 MB or smaller.");

  const existing = await selectCompanyDetails(user.id);
  if (existing?.licence_status === "verified") {
    throw conflict("Your licence is already verified. Contact the shop if it needs to be replaced.");
  }

  const path = `${user.id}/${randomUUID()}-${safeFileName(file.name)}`;
  await uploadBusinessLicenceObject(path, await file.arrayBuffer(), file.type);
  const saved = await upsertCompanyDetails(user.id, {
    licence_status: "pending",
    licence_path: path,
    licence_file_name: file.name.slice(0, 200),
    licence_content_type: file.type,
    licence_submitted_at: new Date().toISOString(),
    licence_reviewed_at: null,
    licence_reviewed_by: null,
    licence_review_note: null,
  });
  if (existing?.licence_path) await deleteBusinessLicenceObject(existing.licence_path);
  await recordAdminAction({ actorId: user.id, action: "wholesale.licence.submit", targetType: "profile", targetId: user.id, next: { file: file.name.slice(0, 80) } });
  return publicCompany(saved).licence;
}

// ---------------------------------------------------------------------------
// Admin: look at a company and review its licence
// ---------------------------------------------------------------------------

export async function adminGetCompany(user: CurrentUser, userId: string) {
  requireAdmin(user);
  const details = await selectCompanyDetails(userId);
  const profile = await selectProfileByIdService(userId);
  if (!profile) throw notFound("Account not found.");
  let licenceUrl: string | null = null;
  if (details?.licence_path) {
    licenceUrl = await createBusinessLicenceSignedUrl(details.licence_path).catch(() => null);
  }
  return {
    business_name: profile.business_name ?? null,
    licence_required: licenceRequired(),
    ...publicCompany(details),
    licence_content_type: details?.licence_content_type ?? null,
    licence_url: licenceUrl,
  };
}

export async function adminReviewLicence(user: CurrentUser, userId: string, input: { decision?: unknown; note?: unknown }) {
  requireAdmin(user);
  const decision = input.decision === "verify" || input.decision === "reject" ? input.decision : null;
  if (!decision) throw badRequest("Choose verify or reject.");
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 500) : "";
  if (decision === "reject" && !note) throw badRequest("Tell the customer why the licence was rejected.");
  const details = await selectCompanyDetails(userId);
  if (!details?.licence_path) throw conflict("This account has not uploaded a licence.");

  const saved = await upsertCompanyDetails(userId, {
    licence_status: decision === "verify" ? "verified" : "rejected",
    licence_reviewed_at: new Date().toISOString(),
    licence_reviewed_by: user.id,
    licence_review_note: note || null,
  });
  await recordAdminAction({
    actorId: user.id,
    action: "wholesale.licence.review",
    targetType: "profile",
    targetId: userId,
    previous: { status: details.licence_status },
    next: { status: decision === "verify" ? "verified" : "rejected", note: note || null },
  });
  return publicCompany(saved).licence;
}

// ---------------------------------------------------------------------------
// Invoice / proforma
// ---------------------------------------------------------------------------

export async function getInvoice(user: CurrentUser, orderId: string) {
  if (user.role !== "admin" && user.role !== "wholesale") throw forbidden("Invoices are for wholesale accounts.");
  // Scoped: a wholesale buyer can only ever load their own order here.
  const order = await selectOrderById(user, orderId);
  if (!order) throw notFound("Order not found.");
  if (order.status === "cancelled") throw conflict("A cancelled order has no invoice.");

  const [profile, company] = await Promise.all([selectProfileByIdService(order.user_id), selectCompanyDetails(order.user_id)]);
  const kind = invoiceKind(order);
  const hq = APHRODITE_BRANCHES[0];

  return {
    kind,
    number: invoiceNumber(order, kind),
    issued_at: (kind === "invoice" ? order.delivered_at ?? order.confirmed_at : null) ?? order.created_at,
    seller: sellerDetails({ name: hq.name, address: hq.address, phones: hq.phones }),
    buyer: {
      name: profile?.business_name || profile?.full_name || order.shipping_name,
      tax_id: company?.tax_id ?? null,
      address: company?.address ?? null,
      billing_name: company?.billing_name ?? null,
      billing_phone: company?.billing_phone ?? null,
      billing_email: company?.billing_email ?? profile?.email ?? null,
    },
    order: {
      id: order.id,
      created_at: order.created_at,
      po_number: order.po_number ?? null,
      total_amount: order.total_amount,
      payment_method: order.payment_method ?? null,
      payment_status: order.payment_status ?? null,
      shipping_name: order.shipping_name,
      shipping_phone: order.shipping_phone,
      shipping_address: order.shipping_address,
      items: (order.order_items ?? []).map((item) => ({
        name: item.products?.name ?? `Product #${item.product_id}`,
        quantity: item.quantity,
        unit_price: item.unit_price,
      })),
    },
    // A proforma asks for payment, so it carries the bank details.
    pay_to:
      kind === "proforma"
        ? paymentAccountsFor({ wholesale: true })
            .filter((account) => account.method === "bank_transfer")
            .map((account) => ({ label: account.label, holder: account.holder, account_number: account.accountNumber ?? null }))
        : [],
  };
}
