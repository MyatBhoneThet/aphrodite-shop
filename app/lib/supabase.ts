import type { Product, ProductType, UserRole } from "../data/products";
import type { PriceTierRow } from "./pricing";
import { ADMIN_SESSION_COOKIE, parseCookieHeader } from "./admin-session";
import { USER_SESSION_COOKIE } from "./user-session";
import * as galleryHelpers from "./product-gallery";
import { specVariantBaseKey } from "./google-sheets";
import { forbidden, notFound, unauthorized } from "./errors";
import { conflict, serviceUnavailable } from "./errors";
import type { SupabaseSocialProvider } from "./oauth";
import type { SavedAddress, SavedAddressInput } from "./address-book";

export type { PriceTierRow } from "./pricing";

export type WholesaleStatus =
  | "not_applied"
  | "approved"
  | "suspended";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  wholesale_status: WholesaleStatus;
  business_name?: string | null;
  business_verified_at?: string | null;
  price_list_id: string | null;
  phone: string | null;
  shipping_address_line1?: string | null;
  shipping_address_line2?: string | null;
  shipping_city?: string | null;
  shipping_state?: string | null;
  shipping_postal_code?: string | null;
  shipping_country?: string | null;
  preferred_language?: "en" | "my";
  order_updates_enabled?: boolean;
  support_updates_enabled?: boolean;
  marketing_emails_enabled?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type CurrentUser = {
  id: string;
  email: string;
  role: UserRole;
  profile: Profile;
  accessToken: string;
};

export type ProductRow = {
  id: number;
  source_key?: string | null;
  source_sheet?: string | null;
  name: string;
  type: ProductType;
  category: string;
  brand: string;
  price: number;
  wholesale_price?: number | null;
  image: string;
  model_3d: string | null;
  stock: "In Stock" | "Out of Stock";
  stock_quantity?: number;
  specs: Product["specs"];
  full_specs: Product["fullSpecs"];
};

export type PriceListRow = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type AuditLogRow = {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string;
  previous_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
};

export type CartItemRow = {
  id: string;
  user_id: string;
  product_id: number;
  quantity: number;
  created_at: string;
  updated_at: string;
  products?: ProductRow | null;
};

export type WishlistItemRow = {
  id: string;
  user_id: string;
  product_id: number;
  created_at: string;
  products?: ProductRow | null;
};

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned";

export type OrderRequestStatus =
  | "none"
  | "requested"
  | "approved"
  | "pickup_scheduled"
  | "received"
  | "refunded"
  | "rejected";

export type ReturnReasonCode =
  | "defective"
  | "wrong_item"
  | "wrong_color"
  | "wrong_storage"
  | "damaged_in_transit"
  | "other";

export type ReturnPickupMethod = "courier_pickup" | "store_dropoff";
export type RefundMethod = "cash" | "bank_transfer" | "mobile_wallet" | "store_credit";
export type CodVerificationStatus =
  | "pending"
  | "phone_verified"
  | "deposit_verified"
  | "approved"
  | "rejected";
export type DeliveryEventStage =
  | "order_placed"
  | "verification_pending"
  | "verified"
  | "packed"
  | "handed_to_courier"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "delivery_failed";
export type ReturnEvidenceKind =
  | "product_photo"
  | "shipping_damage_photo"
  | "unboxing_video"
  | "serial_photo"
  /** The sealed parcel before it was opened. */
  | "parcel_photo"
  | "other";

/** What the customer picked on the "Get help with this order" button. */
export type HelpCaseTopic =
  | "payment"
  | "delivery"
  | "faulty_item"
  | "cancel_order"
  | "warranty";

export type HelpCaseStatus = "open" | "waiting_customer" | "resolved" | "closed";

export type ReturnResolution = "replacement" | "refund" | "repair";

export type ReturnRequestStatus =
  | "requested"
  | "more_info_needed"
  | "approved"
  | "declined"
  | "collected"
  | "inspected"
  /** Authorised, but the money has not left yet — the step customers ask about. */
  | "refund_approved"
  | "completed"
  | "cancelled";

export type OrderHelpCaseRow = {
  id: string;
  order_id: string;
  customer_id: string;
  topic: HelpCaseTopic;
  status: HelpCaseStatus;
  summary: string;
  conversation_id: string | null;
  assigned_admin_id: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  orders?: OrderRow | null;
  profiles?: Pick<Profile, "email" | "full_name" | "role"> | null;
  return_evidence?: ReturnEvidenceRow[];
};

export type ReturnRequestRow = {
  id: string;
  order_id: string;
  order_item_id: string;
  customer_id: string;
  quantity: number;
  reason_code: ReturnReasonCode;
  description: string;
  preferred_resolution: ReturnResolution;
  resolution_granted: ReturnResolution | null;
  collection_method: ReturnPickupMethod;
  pickup_address: string | null;
  status: ReturnRequestStatus;
  unboxing_video_confirmed: boolean;
  admin_decision_note: string | null;
  decided_by: string | null;
  decided_at: string | null;
  review_requested_at: string | null;
  review_request_note: string | null;
  refund_amount?: number | null;
  refund_method?: RefundMethod | null;
  refund_reference?: string | null;
  refund_approved_at?: string | null;
  refund_sent_at?: string | null;
  /** Promised to the customer, so a date that moves needs `delay_reason`. */
  expected_refund_at?: string | null;
  delay_reason?: string | null;
  created_at: string;
  updated_at: string;
  order_items?: OrderItemRow | null;
  orders?: OrderRow | null;
  profiles?: Pick<Profile, "email" | "full_name" | "role"> | null;
  return_evidence?: ReturnEvidenceRow[];
};

export type DeliveryEventRow = {
  id: string;
  order_id: string;
  stage: DeliveryEventStage;
  title: string;
  description: string | null;
  location_label: string | null;
  happened_at: string;
  created_by: string | null;
  visible_to_customer: boolean;
  created_at: string;
};

export type ReturnEvidenceRow = {
  id: string;
  order_id: string;
  uploaded_by: string;
  evidence_kind: ReturnEvidenceKind;
  storage_path: string | null;
  external_url: string | null;
  file_name: string | null;
  content_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

/**
 * 'correction_requested' is deliberately distinct from 'rejected': a rejection
 * tells the customer to start over, which is the wrong message when part of
 * the money did arrive. See 2026-09-17-payment-corrections.sql.
 */
export type PaymentVerificationStatus =
  | "not_required"
  | "pending"
  | "verified"
  | "rejected"
  | "correction_requested";

export type PaymentCorrectionReason =
  | "short_payment"
  | "overpaid"
  | "unclear_slip"
  | "wrong_account"
  | "other";

export type OrderRow = {
  id: string;
  user_id: string;
  status: OrderStatus;
  total_amount: number;
  shipping_name: string;
  shipping_phone: string;
  shipping_address: string;
  shipping_address_line1: string | null;
  shipping_address_line2: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_postal_code: string | null;
  shipping_country: string | null;
  payment_method: "cash_on_delivery" | "bank_transfer" | "mmqr";
  payment_status: "unpaid" | "collected" | "refunded";
  payment_account?: "kbz" | "aya" | "mmqr" | null;
  payment_reference?: string | null;
  payment_verification_status?: PaymentVerificationStatus;
  payment_verified_at?: string | null;
  payment_verified_by?: string | null;
  payment_rejected_reason?: string | null;
  /** What actually arrived. Null means "not counted", which is not 0. */
  payment_amount_received?: number | null;
  payment_correction_reason?: PaymentCorrectionReason | null;
  payment_correction_requested_at?: string | null;
  payment_slips?: PaymentSlipRow[];
  cancellation_request_status: OrderRequestStatus;
  cancellation_reason: string | null;
  cancellation_requested_at: string | null;
  cancellation_resolved_at: string | null;
  cancellation_source?: "customer" | "admin" | null;
  cancellation_reason_code?: string | null;
  return_request_status: OrderRequestStatus;
  return_reason: string | null;
  return_requested_at: string | null;
  return_resolved_at: string | null;
  return_reason_code?: ReturnReasonCode | null;
  return_pickup_method?: ReturnPickupMethod | null;
  return_pickup_address?: string | null;
  return_pickup_scheduled_for?: string | null;
  return_pickup_instructions?: string | null;
  return_pickup_tracking_number?: string | null;
  return_received_at?: string | null;
  return_inspection_notes?: string | null;
  return_restock_approved?: boolean | null;
  refund_method?: RefundMethod | null;
  refund_reference?: string | null;
  refund_amount?: number | null;
  refund_completed_at?: string | null;
  confirmed_at?: string | null;
  delivered_at?: string | null;
  receipt_number?: string | null;
  receipt_sent_at?: string | null;
  receipt_email_status?: "not_sent" | "sent" | "not_configured" | "failed";
  receipt_email_error?: string | null;
  cod_verification_status?: CodVerificationStatus;
  cod_verification_method?: "phone_callback" | "cod_deposit" | "admin_review" | null;
  cod_verified_at?: string | null;
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
  delivery_accuracy_m?: number | null;
  delivery_location_consent?: boolean;
  delivery_location_captured_at?: string | null;
  courier_name?: string | null;
  delivery_tracking_number?: string | null;
  estimated_delivery_at?: string | null;
  delivery_status_detail?: string | null;
  delivery_last_event_at?: string | null;
  admin_order_note: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  order_items?: OrderItemRow[];
  delivery_events?: DeliveryEventRow[];
  return_evidence?: ReturnEvidenceRow[];
  profiles?: Pick<Profile, "email" | "full_name" | "role"> | null;
};

export type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: number;
  quantity: number;
  unit_price: number;
  products?: ProductRow | null;
};

export type SupportConversationStatus = "open" | "resolved";
export type SupportSenderRole = "customer" | "admin";

export type SupportConversationRow = {
  id: string;
  customer_id: string;
  assigned_admin_id: string | null;
  status: SupportConversationStatus;
  last_message_at: string;
  last_message_preview: string | null;
  last_sender_role: SupportSenderRole | null;
  customer_last_read_at: string | null;
  admin_last_read_at: string | null;
  created_at: string;
  updated_at: string;
  profiles?: Pick<Profile, "email" | "full_name" | "role"> | null;
};

export type SupportMessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: SupportSenderRole;
  body: string;
  created_at: string;
  /** Object path inside the private `support-uploads` bucket, never a URL. */
  attachment_path?: string | null;
  attachment_type?: string | null;
  /** Set when the customer is asking about one specific product. */
  product_id?: number | null;
};

export type CustomerSettingsFields = {
  full_name: string | null;
  phone: string | null;
  shipping_address_line1: string | null;
  shipping_address_line2: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_postal_code: string | null;
  shipping_country: string;
  preferred_language: "en" | "my";
  order_updates_enabled: boolean;
  support_updates_enabled: boolean;
  marketing_emails_enabled: boolean;
};

export type RecentlyViewedRow = {
  id: string;
  user_id: string;
  product_id: number;
  viewed_at: string;
};

type AuthUserResponse = {
  user?: {
    id: string;
    email?: string;
  };
  id?: string;
  email?: string;
};

type AuthSessionResponse = {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email?: string;
  };
};

type AuthSignupResponse = {
  access_token?: string;
  user?: {
    id: string;
    email?: string;
  };
  id?: string;
  email?: string;
};

type AdminGenerateLinkResponse = {
  hashed_token?: string;
  properties?: { hashed_token?: string };
};

// Keep this projection in sync with the column-level grants in
// supabase/schema.sql and the security-hardening migration. Exact inventory
// and the legacy wholesale price are intentionally absent.
const PUBLIC_PRODUCT_COLUMNS = [
  "id",
  "name",
  "type",
  "category",
  "brand",
  "price",
  "image",
  "model_3d",
  "stock",
  "specs",
  "full_specs",
  "source_sheet",
].join(",");

const UPSTREAM_TIMEOUT_MS = 10_000;

// Private, explicit-consent location shares. Callers authenticate first; an
// administrator must be checked before reading a different customer's row.
export async function getLocationShare(userId: string) {
  const rows = await supabaseRest<import("./location-share").LocationShare[]>(
    `customer_location_shares?select=latitude,longitude,accuracy_m,captured_at,expires_at&user_id=eq.${encodeURIComponent(userId)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&limit=1`
  );
  return rows[0] ?? null;
}

export async function saveLocationShare(userId: string, coordinates: Pick<import("./location-share").LocationShare, "latitude" | "longitude" | "accuracy_m">) {
  const { LOCATION_CONSENT_VERSION, LOCATION_RETENTION_DAYS } = await import("./location-share");
  const now = new Date();
  const rows = await supabaseRest<import("./location-share").LocationShare[]>("customer_location_shares?on_conflict=user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ user_id: userId, ...coordinates, captured_at: now.toISOString(), consent_version: LOCATION_CONSENT_VERSION,
      expires_at: new Date(now.getTime() + LOCATION_RETENTION_DAYS * 86400000).toISOString() }),
  });
  const row = rows[0];
  return { latitude: row.latitude, longitude: row.longitude, accuracy_m: row.accuracy_m, captured_at: row.captured_at, expires_at: row.expires_at };
}

/** Admin-only list of every current share. Callers must check the admin role first. */
export async function listLocationShares() {
  const shares = await supabaseRest<(import("./location-share").LocationShare & { user_id: string })[]>(
    `customer_location_shares?select=user_id,latitude,longitude,accuracy_m,captured_at,expires_at&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&order=captured_at.desc&limit=500`
  );
  if (shares.length === 0) return [];
  const ids = shares.map((share) => share.user_id).join(",");
  const profiles = await supabaseRest<{ id: string; email: string; full_name: string | null; phone: string | null }[]>(
    `profiles?select=id,email,full_name,phone&id=in.(${ids})`
  );
  const byId = new Map(profiles.map((profile) => [profile.id, profile]));
  return shares.map((share) => {
    const profile = byId.get(share.user_id);
    return { ...share, email: profile?.email ?? null, full_name: profile?.full_name ?? null, phone: profile?.phone ?? null };
  });
}

export async function removeLocationShare(userId: string) {
  await supabaseRest(`customer_location_shares?user_id=eq.${encodeURIComponent(userId)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
}

export async function selectCustomerAddresses(userId: string) {
  return supabaseRest<SavedAddress[]>(
    `customer_addresses?select=id,label,recipient_name,phone,address_line1,address_line2,township,postal_code,latitude,longitude,accuracy_m,is_default,created_at,updated_at&user_id=eq.${encodeURIComponent(userId)}&order=is_default.desc,created_at.asc`
  );
}

export async function insertCustomerAddress(userId: string, input: SavedAddressInput) {
  const existing = await selectCustomerAddresses(userId);
  const makeDefault = existing.length === 0 || input.is_default;
  if (makeDefault && existing.some((address) => address.is_default)) {
    await supabaseRest(
      `customer_addresses?user_id=eq.${encodeURIComponent(userId)}&is_default=eq.true`,
      { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ is_default: false }) }
    );
  }
  const rows = await supabaseRest<SavedAddress[]>("customer_addresses", {
    method: "POST",
    body: JSON.stringify({ ...input, user_id: userId, is_default: makeDefault }),
  });
  return rows[0] ?? null;
}

export async function updateCustomerAddress(userId: string, addressId: string, input: SavedAddressInput) {
  const currentRows = await supabaseRest<SavedAddress[]>(
    `customer_addresses?select=*&id=eq.${encodeURIComponent(addressId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`
  );
  const current = currentRows[0];
  if (!current) return null;
  const staysDefault = current.is_default || input.is_default;
  if (staysDefault) {
    await supabaseRest(
      `customer_addresses?user_id=eq.${encodeURIComponent(userId)}&is_default=eq.true&id=neq.${encodeURIComponent(addressId)}`,
      { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ is_default: false }) }
    );
  }
  const rows = await supabaseRest<SavedAddress[]>(
    `customer_addresses?id=eq.${encodeURIComponent(addressId)}&user_id=eq.${encodeURIComponent(userId)}`,
    { method: "PATCH", body: JSON.stringify({ ...input, is_default: staysDefault, updated_at: new Date().toISOString() }) }
  );
  return rows[0] ?? null;
}

export async function deleteCustomerAddress(userId: string, addressId: string) {
  const matches = await supabaseRest<SavedAddress[]>(
    `customer_addresses?select=*&id=eq.${encodeURIComponent(addressId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`
  );
  const deleted = matches[0];
  if (!deleted) return false;
  await supabaseRest(
    `customer_addresses?id=eq.${encodeURIComponent(addressId)}&user_id=eq.${encodeURIComponent(userId)}`,
    { method: "DELETE", headers: { Prefer: "return=minimal" } }
  );
  if (deleted.is_default) {
    const remaining = await selectCustomerAddresses(userId);
    if (remaining[0]) {
      await supabaseRest(
        `customer_addresses?id=eq.${encodeURIComponent(remaining[0].id)}&user_id=eq.${encodeURIComponent(userId)}`,
        { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ is_default: true }) }
      );
    }
  }
  return true;
}

function upstreamSignal(signal?: AbortSignal | null) {
  return signal ?? AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
}

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function isSupabaseConfigured(options: { requireServiceRole?: boolean } = {}) {
  return Boolean(
    supabaseUrl && anonKey && (!options.requireServiceRole || serviceRoleKey)
  );
}

function requireSupabaseConfig(options: { requireServiceRole?: boolean } = {}) {
  if (!supabaseUrl || !anonKey || (options.requireServiceRole && !serviceRoleKey)) {
    throw new Error("Supabase is not configured.");
  }

  return {
    url: supabaseUrl.replace(/\/+$/, ""),
    anonKey,
    serviceRoleKey: serviceRoleKey ?? anonKey,
  };
}

async function readError(response: Response) {
  const text = await response.text();

  try {
    const parsed = JSON.parse(text) as { error?: string; msg?: string; message?: string };
    return parsed.message ?? parsed.error ?? parsed.msg ?? text;
  } catch {
    return text || `Supabase request failed: ${response.status}`;
  }
}

async function supabaseRest<T>(
  path: string,
  init: RequestInit = {},
  token = requireSupabaseConfig({ requireServiceRole: true }).serviceRoleKey,
  apiKey = token
) {
  const { url } = requireSupabaseConfig();
  const headers = new Headers(init.headers);

  headers.set("apikey", apiKey);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");

  if (!headers.has("Prefer")) {
    headers.set("Prefer", "return=representation");
  }

  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers,
    cache: "no-store",
    signal: upstreamSignal(init.signal),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  if (response.status === 204) {
    return null as T;
  }

  // An insert sent with "Prefer: return=minimal" answers 201 with an EMPTY
  // body (only updates and deletes use 204). Parsing that as JSON threw
  // "Unexpected end of JSON input" after the row was already written, which
  // turned successful admin actions (e.g. every audit-logged status change)
  // into 500 errors.
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

const RETURN_EVIDENCE_BUCKET = "return-evidence";

function encodeStoragePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

/**
 * Turns the value Supabase returns from a "sign" call into a URL a browser can
 * actually fetch.
 *
 * The API answers with `/object/sign/<bucket>/<path>?token=...` -- relative to
 * the STORAGE API, not to the project root. Joining it straight onto the
 * project URL produces `https://<project>.supabase.co/object/sign/...`, which
 * is a 404: the `/storage/v1` prefix is missing. That silently broke every
 * signed image (the admin saw a broken-image icon, not an error).
 */
function absoluteStorageUrl(projectUrl: string, signedPath: string) {
  if (signedPath.startsWith("http")) return signedPath;

  const path = signedPath.startsWith("/") ? signedPath : `/${signedPath}`;

  return path.startsWith("/storage/v1")
    ? `${projectUrl}${path}`
    : `${projectUrl}/storage/v1${path}`;
}

export async function uploadReturnEvidenceObject(
  path: string,
  bytes: ArrayBuffer,
  contentType: string
) {
  const { url, serviceRoleKey } = requireSupabaseConfig({ requireServiceRole: true });
  const response = await fetch(
    `${url}/storage/v1/object/${RETURN_EVIDENCE_BUCKET}/${encodeStoragePath(path)}`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": contentType,
        "x-upsert": "false",
      },
      body: bytes,
      cache: "no-store",
      signal: upstreamSignal(),
    }
  );

  if (!response.ok) {
    throw new Error(await readError(response));
  }
}

const PAYMENT_SLIP_BUCKET = "payment-slips";

/**
 * Transfer slips are customer payment records, so the bucket is private and
 * every read goes through a short-lived signed URL (same shape as return
 * evidence above).
 */
export async function uploadPaymentSlipObject(
  path: string,
  bytes: ArrayBuffer,
  contentType: string
) {
  const { url, serviceRoleKey } = requireSupabaseConfig({ requireServiceRole: true });
  const response = await fetch(
    `${url}/storage/v1/object/${PAYMENT_SLIP_BUCKET}/${encodeStoragePath(path)}`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": contentType,
        "x-upsert": "false",
      },
      body: bytes,
      cache: "no-store",
      signal: upstreamSignal(),
    }
  );

  if (!response.ok) {
    throw new Error(await readError(response));
  }
}

export async function createPaymentSlipSignedUrl(path: string) {
  const { url, serviceRoleKey } = requireSupabaseConfig({ requireServiceRole: true });
  const response = await fetch(
    `${url}/storage/v1/object/sign/${PAYMENT_SLIP_BUCKET}/${encodeStoragePath(path)}`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: 300 }),
      cache: "no-store",
      signal: upstreamSignal(),
    }
  );

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  const result = (await response.json()) as { signedURL?: string; signedUrl?: string };
  const signedPath = result.signedURL ?? result.signedUrl;
  if (!signedPath) throw new Error("Supabase did not return a payment slip URL.");
  return absoluteStorageUrl(url, signedPath);
}

const PRODUCT_PHOTO_BUCKET = "product-photos";

// Mirrors uploadReturnEvidenceObject, but this bucket is public, so the caller
// gets a permanent URL back instead of having to mint a short-lived signed one.
export async function uploadProductPhotoObject(
  path: string,
  bytes: ArrayBuffer,
  contentType: string
) {
  const { url, serviceRoleKey } = requireSupabaseConfig({ requireServiceRole: true });
  const encoded = encodeStoragePath(path);
  const response = await fetch(
    `${url}/storage/v1/object/${PRODUCT_PHOTO_BUCKET}/${encoded}`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": contentType,
        "Cache-Control": "max-age=31536000",
        "x-upsert": "false",
      },
      body: bytes,
      cache: "no-store",
      signal: upstreamSignal(),
    }
  );

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return `${url}/storage/v1/object/public/${PRODUCT_PHOTO_BUCKET}/${encoded}`;
}

// ---------------------------------------------------------------------------
// Live-chat attachments (private bucket, signed reads)
// ---------------------------------------------------------------------------

const SUPPORT_BUCKET = "support-uploads";

export async function uploadSupportAttachment(
  path: string,
  bytes: ArrayBuffer,
  contentType: string
) {
  const { url, serviceRoleKey } = requireSupabaseConfig({ requireServiceRole: true });
  const response = await fetch(
    `${url}/storage/v1/object/${SUPPORT_BUCKET}/${encodeStoragePath(path)}`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": contentType,
        "x-upsert": "false",
      },
      body: bytes,
      cache: "no-store",
      signal: upstreamSignal(),
    }
  );

  if (!response.ok) {
    throw new Error(await readError(response));
  }
}

/** Chat photos are customer data, so the bucket is private and every read goes
 *  through a short-lived signed URL rather than a guessable public link. */
export async function createSupportAttachmentSignedUrl(path: string) {
  const { url, serviceRoleKey } = requireSupabaseConfig({ requireServiceRole: true });
  const response = await fetch(
    `${url}/storage/v1/object/sign/${SUPPORT_BUCKET}/${encodeStoragePath(path)}`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: 600 }),
      cache: "no-store",
      signal: upstreamSignal(),
    }
  );

  if (!response.ok) return null;

  const result = (await response.json()) as { signedURL?: string; signedUrl?: string };
  const signedPath = result.signedURL ?? result.signedUrl;
  if (!signedPath) return null;

  return absoluteStorageUrl(url, signedPath);
}

// ---------------------------------------------------------------------------
// Administrator presence (single shared row, id = true)
// ---------------------------------------------------------------------------

export type AdminPresenceRow = {
  id: boolean;
  status: "online" | "away" | "busy" | "offline";
  message: string | null;
  back_at: string | null;
  updated_by: string | null;
  updated_at: string;
};

export async function selectAdminPresenceService() {
  const rows = await supabaseRest<AdminPresenceRow[]>(
    "admin_presence?select=*&id=is.true&limit=1"
  );

  return rows[0] ?? null;
}

export async function updateAdminPresenceService(fields: {
  status: AdminPresenceRow["status"];
  message: string | null;
  back_at: string | null;
  updated_by: string;
}) {
  const rows = await supabaseRest<AdminPresenceRow[]>("admin_presence?id=is.true", {
    method: "PATCH",
    body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() }),
  });

  return rows[0] ?? null;
}

export async function createReturnEvidenceSignedUrl(path: string) {
  const { url, serviceRoleKey } = requireSupabaseConfig({ requireServiceRole: true });
  const response = await fetch(
    `${url}/storage/v1/object/sign/${RETURN_EVIDENCE_BUCKET}/${encodeStoragePath(path)}`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: 300 }),
      cache: "no-store",
      signal: upstreamSignal(),
    }
  );

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  const result = (await response.json()) as { signedURL?: string; signedUrl?: string };
  const signedPath = result.signedURL ?? result.signedUrl;
  if (!signedPath) throw new Error("Supabase did not return an evidence URL.");
  return absoluteStorageUrl(url, signedPath);
}

// Returns an exact row count via PostgREST's Content-Range header instead of
// fetching (and discarding) the actual rows -- `Range: 0-0` still triggers
// `Prefer: count=exact` to compute the full count, but only transfers at
// most one row's worth of body.
async function supabaseCount(
  path: string,
  token = requireSupabaseConfig({ requireServiceRole: true }).serviceRoleKey,
  apiKey = token
) {
  const { url } = requireSupabaseConfig();
  const headers = new Headers();

  headers.set("apikey", apiKey);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Prefer", "count=exact");
  headers.set("Range-Unit", "items");
  headers.set("Range", "0-0");

  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers,
    cache: "no-store",
    signal: upstreamSignal(),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  const contentRange = response.headers.get("content-range");
  const total = contentRange ? Number(contentRange.split("/")[1]) : NaN;

  return Number.isFinite(total) ? total : 0;
}

async function supabaseAuth<T>(
  path: string,
  init: RequestInit,
  authorizationToken = requireSupabaseConfig().serviceRoleKey,
  apiKey = requireSupabaseConfig().serviceRoleKey
) {
  const { url } = requireSupabaseConfig();
  const headers = new Headers(init.headers);

  headers.set("apikey", apiKey);
  headers.set("Authorization", `Bearer ${authorizationToken}`);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${url}/auth/v1/${path}`, {
    ...init,
    headers,
    cache: "no-store",
    signal: upstreamSignal(init.signal),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return (await response.json()) as T;
}

export function mapProductRow(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    sourceSheet: row.source_sheet ?? undefined,
    category: row.category,
    brand: row.brand,
    price: row.price,
    wholesalePrice: row.wholesale_price ?? undefined,
    image: row.image,
    model3D: row.model_3d ?? undefined,
    stock: row.stock,
    stockQuantity: row.stock_quantity ?? 0,
    specs: row.specs ?? {},
    fullSpecs: row.full_specs ?? {},
  };
}

type ProductWrite = Partial<Product> & {
  sourceKey?: string;
  sourceSheet?: string;
};

export function mapProductToRow(product: ProductWrite) {
  return {
    ...(product.id !== undefined ? { id: product.id } : {}),
    name: product.name ?? null,
    type: product.type ?? null,
    category: product.category ?? null,
    brand: product.brand ?? null,
    price: product.price ?? null,
    wholesale_price: product.wholesalePrice ?? null,
    image: product.image ?? null,
    model_3d: product.model3D ?? null,
    stock: product.stock ?? null,
    // Only send stock_quantity when the caller provided one: the column is
    // NOT NULL and writers that predate numeric inventory (e.g. the Google
    // Sheets sync without a stock_quantity column) must not null it out.
    ...(product.stockQuantity !== undefined
      ? { stock_quantity: product.stockQuantity }
      : {}),
    specs: product.specs ?? {},
    full_specs: product.fullSpecs ?? {},
  };
}

function mapProductionProductToRow(
  product: ProductWrite & { sourceKey: string; sourceSheet: string }
): Record<string, unknown> {
  return {
    source_key: product.sourceKey,
    source_sheet: product.sourceSheet,
    name: product.name ?? null,
    type: product.type ?? null,
    category: product.category ?? null,
    brand: product.brand ?? null,
    price: product.price ?? null,
    stock: product.stock ?? null,
    stock_quantity: product.stockQuantity ?? 0,
    specs: product.specs ?? {},
    full_specs: product.fullSpecs ?? {},
  };
}

/** Maps a PATCH payload without manufacturing nulls for omitted properties. */
export function mapProductPatchToRow(product: Partial<Product>) {
  const row: Record<string, unknown> = {};

  if (Object.hasOwn(product, "id")) row.id = product.id;
  if (Object.hasOwn(product, "name")) row.name = product.name;
  if (Object.hasOwn(product, "type")) row.type = product.type;
  if (Object.hasOwn(product, "category")) row.category = product.category;
  if (Object.hasOwn(product, "brand")) row.brand = product.brand;
  if (Object.hasOwn(product, "price")) row.price = product.price;
  if (Object.hasOwn(product, "wholesalePrice")) {
    row.wholesale_price = product.wholesalePrice ?? null;
  }
  if (Object.hasOwn(product, "image")) row.image = product.image;
  if (Object.hasOwn(product, "model3D")) row.model_3d = product.model3D ?? null;
  if (Object.hasOwn(product, "stock")) row.stock = product.stock;
  if (Object.hasOwn(product, "stockQuantity")) {
    row.stock_quantity = product.stockQuantity;
  }
  if (Object.hasOwn(product, "specs")) row.specs = product.specs;
  if (Object.hasOwn(product, "fullSpecs")) row.full_specs = product.fullSpecs;

  return row;
}

export async function registerUser({
  email,
  password,
  fullName,
}: {
  email: string;
  password: string;
  fullName?: string;
}) {
  const { anonKey } = requireSupabaseConfig();
  const data = await supabaseAuth<AuthSignupResponse>(
    "signup",
    {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        data: { full_name: fullName ?? null },
      }),
    },
    anonKey,
    anonKey
  );

  const user = data.user ?? (data.id ? { id: data.id, email: data.email } : null);

  if (!user) {
    throw new Error("Supabase did not return a created user.");
  }

  return {
    user,
    requiresEmailVerification: !data.access_token,
  };
}

export async function loginUser(email: string, password: string) {
  const { anonKey } = requireSupabaseConfig();

  return supabaseAuth<AuthSessionResponse>(
    "token?grant_type=password",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    },
    anonKey,
    anonKey
  );
}

export async function updateUserPassword(
  accessToken: string,
  password: string
) {
  const { anonKey } = requireSupabaseConfig();

  return supabaseAuth<AuthUserResponse>(
    "user",
    {
      method: "PUT",
      body: JSON.stringify({ password }),
    },
    accessToken,
    anonKey
  );
}

/**
 * Where to send the browser to start a social sign-in.
 *
 * `code_challenge` opts Supabase into the PKCE flow, so the callback receives
 * an authorization code (redeemable only by this server, with the matching
 * verifier) instead of an access token in the URL fragment. GoTrue expects
 * the method spelled in lower case.
 */
export function oauthAuthorizeUrl({
  provider,
  redirectTo,
  codeChallenge,
}: {
  provider: SupabaseSocialProvider;
  redirectTo: string;
  codeChallenge: string;
}) {
  const { url } = requireSupabaseConfig();
  const params = new URLSearchParams({
    provider,
    redirect_to: redirectTo,
    code_challenge: codeChallenge,
    code_challenge_method: "s256",
  });

  return `${url}/auth/v1/authorize?${params.toString()}`;
}

/** Swaps the authorization code from the OAuth callback for a session. */
export async function exchangeOAuthCode(authCode: string, codeVerifier: string) {
  const { anonKey } = requireSupabaseConfig();

  return supabaseAuth<AuthSessionResponse>(
    "token?grant_type=pkce",
    {
      method: "POST",
      body: JSON.stringify({ auth_code: authCode, code_verifier: codeVerifier }),
    },
    anonKey,
    anonKey
  );
}

/**
 * Looks up an account by email address, service-role.
 *
 * Reads the `profiles` mirror rather than GoTrue's admin user list: the
 * `on_auth_user_created` trigger keeps a row there for every account, and a
 * single indexed lookup beats paging through `/admin/users`. There is no
 * caller-supplied token here by design -- it runs *before* anyone is signed
 * in, so it must not be reachable from a user-facing endpoint on its own.
 */
export async function selectProfileByEmailService(email: string) {
  const rows = await supabaseRest<Profile[]>(
    `profiles?select=*&email=eq.${encodeURIComponent(email.trim().toLowerCase())}&limit=1`
  );

  return rows[0] ?? null;
}

/**
 * Creates an account for a customer whose address a social provider has
 * already verified (currently only LINE, which Supabase cannot broker).
 *
 * No password is set: the account is reachable through that provider, or
 * through "Forgot password?", which is the ordinary way to add one later.
 * `email_confirm` is true because the provider -- not this app -- has already
 * proved the customer controls the address; sending our own confirmation mail
 * would ask them to prove it twice.
 *
 * The role is not passed and could not be honoured if it were: the
 * `on_auth_user_created` trigger always writes 'normal', so signing in with a
 * social account can never grant wholesale or admin access.
 */
export async function createFederatedUser({
  email,
  fullName,
}: {
  email: string;
  fullName?: string | null;
}) {
  const data = await supabaseAuth<AuthUserResponse>("admin/users", {
    method: "POST",
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      email_confirm: true,
      user_metadata: { full_name: fullName ?? null },
    }),
  });

  const user = data.user ?? (data.id ? { id: data.id, email: data.email } : null);

  if (!user) {
    throw new Error("Supabase did not return a created user.");
  }

  return user;
}

/**
 * Mints a session for an address, without a password.
 *
 * DANGEROUS BY CONSTRUCTION: this uses the service role key and will hand
 * back a valid session for *any* address it is given. Call it only after an
 * identity provider has verified, in this request, that the customer owns
 * that address -- today that means app/api/auth/oauth/line/callback, after
 * LINE's own `/oauth2/v2.1/verify` has passed. It must never sit behind an
 * endpoint that takes an email from the browser.
 *
 * The mechanism is the same admin "generate a link, then redeem it here"
 * two-step the password-reset email already uses, so the token is single-use
 * and the resulting session is an ordinary one: same cookie, same expiry,
 * same RLS.
 */
export async function createSessionForVerifiedEmail(email: string) {
  const { anonKey, serviceRoleKey } = requireSupabaseConfig({
    requireServiceRole: true,
  });
  const address = email.trim().toLowerCase();

  const link = await supabaseAuth<AdminGenerateLinkResponse>(
    "admin/generate_link",
    {
      method: "POST",
      body: JSON.stringify({ type: "magiclink", email: address }),
    },
    serviceRoleKey,
    serviceRoleKey
  );

  // Older GoTrue releases nest the token under `properties`.
  const tokenHash = link.hashed_token ?? link.properties?.hashed_token;

  if (!tokenHash) {
    throw new Error("Supabase did not return a sign-in token.");
  }

  // Redeemed with the anon key, exactly as a customer clicking the link
  // would: the service role key takes no part in creating the session itself.
  return supabaseAuth<AuthSessionResponse>(
    "verify",
    {
      method: "POST",
      body: JSON.stringify({ type: "magiclink", token_hash: tokenHash }),
    },
    anonKey,
    anonKey
  );
}

/**
 * Mints a password-recovery token for an existing account.
 *
 * Uses the admin endpoint so the shop can send the email itself, through the
 * same Gmail account as order receipts, instead of relying on Supabase's
 * built-in mailer (which is rate limited to a handful of messages per hour on
 * the free tier). Returns the hashed token that /reset-password redeems.
 *
 * Throws when the address has no account -- callers must swallow that and
 * still answer "check your inbox", or the endpoint becomes a way to discover
 * which email addresses are registered.
 */
export async function generatePasswordRecoveryToken(email: string) {
  const { serviceRoleKey } = requireSupabaseConfig({ requireServiceRole: true });
  const data = await supabaseAuth<AdminGenerateLinkResponse>(
    "admin/generate_link",
    {
      method: "POST",
      body: JSON.stringify({ type: "recovery", email }),
    },
    serviceRoleKey,
    serviceRoleKey
  );

  // Older GoTrue releases nest the token under `properties`.
  return data.hashed_token ?? data.properties?.hashed_token ?? null;
}

/**
 * Fallback for deployments with no outgoing mail of their own: let Supabase
 * send the recovery email. The dashboard template must be the one in
 * docs/email-templates/supabase-reset-password.html so the link lands on this
 * app's /reset-password page with the same `?token=` shape.
 */
export async function requestPasswordRecoveryEmail(
  email: string,
  redirectTo: string
) {
  const { anonKey } = requireSupabaseConfig();

  return supabaseAuth<unknown>(
    `recover?redirect_to=${encodeURIComponent(redirectTo)}`,
    {
      method: "POST",
      body: JSON.stringify({ email }),
    },
    anonKey,
    anonKey
  );
}

/**
 * Redeems a recovery token and returns the short-lived session it grants.
 * That session is the only thing that authorises the password change, so it
 * stays on the server: it is used once and discarded, never sent to the
 * browser.
 */
export async function verifyRecoveryToken(tokenHash: string) {
  const { anonKey } = requireSupabaseConfig();

  return supabaseAuth<AuthSessionResponse>(
    "verify",
    {
      method: "POST",
      body: JSON.stringify({ type: "recovery", token_hash: tokenHash }),
    },
    anonKey,
    anonKey
  );
}

export async function getAuthUser(token: string) {
  const { anonKey } = requireSupabaseConfig();

  let data: AuthUserResponse;

  try {
    data = await supabaseAuth<AuthUserResponse>(
      "user",
      { method: "GET" },
      token,
      anonKey
    );
  } catch {
    // Expired/invalid/malformed token -- a normal, expected condition, not
    // a server error. Don't leak GoTrue's raw error text; it's just a 401.
    throw unauthorized();
  }

  const user = data.user ?? (data.id ? { id: data.id, email: data.email } : null);

  if (!user) {
    throw unauthorized();
  }

  return { user };
}

export async function getProfile(userId: string, accessToken?: string) {
  const { anonKey } = requireSupabaseConfig();
  const rows = await supabaseRest<Profile[]>(
    `profiles?select=*&id=eq.${encodeURIComponent(userId)}&limit=1`,
    {},
    // A profile lookup always targets the caller's own row (RLS: "Users
    // read own profile" -> id = auth.uid()), so we can safely run it under
    // the user's own token instead of the service role key. Fall back to
    // service role only for the pre-authentication case (e.g. right after
    // login, before the caller has been fully verified elsewhere).
    accessToken ?? undefined,
    accessToken ? anonKey : undefined
  );

  return rows[0] ?? null;
}

// Requires the "Admins read all profiles" RLS policy (see
// supabase/schema.sql -- public.is_admin()); the caller must pass an admin's
// own access token, not the service role key, so this stays covered by RLS
// like the rest of the admin-scoped queries.
// Service-role read, like selectCustomerProfiles: the caller is already
// admin-gated, and counting via the admin's own token requires the
// "Admins read all profiles" policy, which not every environment has.
export async function countCustomers() {
  return supabaseCount(`profiles?select=id&role=neq.admin`);
}

export async function requireUserFromRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const cookieHeader = request.headers.get("cookie");
  // Ordinary logins set an httpOnly session cookie (app/lib/user-session.ts);
  // admin logins set a separate one (app/lib/admin-session.ts). The bearer
  // header still wins so legacy localStorage sessions keep working until
  // they expire.
  const userCookieToken = parseCookieHeader(cookieHeader, USER_SESSION_COOKIE);
  const adminCookieToken = parseCookieHeader(cookieHeader, ADMIN_SESSION_COOKIE);
  const token = bearerToken ?? userCookieToken ?? adminCookieToken;

  if (!token) {
    throw unauthorized();
  }

  const { user } = await getAuthUser(token);
  const profile = await getProfile(user.id, token);

  if (!profile) {
    throw notFound("Profile not found.");
  }

  return {
    id: user.id,
    email: profile.email ?? user.email ?? "",
    role: profile.role,
    profile,
    accessToken: token,
  } satisfies CurrentUser;
}

export function requireAdmin(user: CurrentUser) {
  if (user.role !== "admin") {
    throw forbidden();
  }
}

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 100;

/**
 * Clamps caller-supplied pagination to a safe window. Query-string values
 * arrive as `Number(param)`, so `?limit=abc` produces NaN -- without this
 * guard that NaN survives `Math.min`/`Math.max` and reaches PostgREST as
 * `limit=NaN`, which fails the whole request with a 500.
 */
export function sanitizePagination(
  limit?: number | null,
  offset?: number | null
) {
  const safeLimit =
    typeof limit === "number" && Number.isFinite(limit)
      ? Math.min(Math.max(1, Math.floor(limit)), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;
  const safeOffset =
    typeof offset === "number" && Number.isFinite(offset)
      ? Math.max(0, Math.floor(offset))
      : 0;

  return { limit: safeLimit, offset: safeOffset };
}

/** Every version of one model (see product-variants.ts), public columns only. */
export async function selectProductVariants(group: string) {
  const params = new URLSearchParams({
    select: PUBLIC_PRODUCT_COLUMNS,
    "full_specs->variant->>group": `eq.${group}`,
    order: "id.asc",
    limit: "50",
  });
  const { anonKey } = requireSupabaseConfig();
  return supabaseRest<ProductRow[]>(`products?${params.toString()}`, {}, anonKey);
}

export async function selectProducts(filters: {
  search?: string | null;
  type?: string | null;
  category?: string | null;
  sourceSheet?: string | null;
  stock?: string | null;
  limit?: number | null;
  offset?: number | null;
  } = {}) {
  const params = new URLSearchParams({
    select: PUBLIC_PRODUCT_COLUMNS,
    order: "id.asc",
  });

  if (filters.type) params.set("type", `eq.${filters.type}`);
  if (filters.category) params.set("category", `eq.${filters.category}`);
  if (filters.sourceSheet) {
    params.set("source_sheet", `eq.${filters.sourceSheet}`);
  }
  if (filters.stock) params.set("stock", `eq.${filters.stock}`);

  const search = filters.search?.trim().toLowerCase();

  // Search still filters client-side (post-fetch), so it can't be combined
  // with server-side limit/offset without returning incomplete results --
  // a search request fetches the full filtered set, same as before. Browsing
  // without a search term is the common case and the one that needs the cap,
  // so that path is paginated.
  if (!search) {
    const { limit, offset } = sanitizePagination(filters.limit, filters.offset);

    params.set("limit", String(limit));
    params.set("offset", String(offset));
  }

  const { anonKey } = requireSupabaseConfig();
  const rows = await supabaseRest<ProductRow[]>(
    `products?${params.toString()}`,
    {},
    anonKey
  );

  return search
    ? rows.filter((product) =>
        `${product.name} ${product.brand} ${product.category}`
          .toLowerCase()
          .includes(search)
      )
    : rows;
}

export async function selectProductsService(filters: {
  search?: string | null;
  type?: string | null;
  category?: string | null;
  sourceSheet?: string | null;
  stock?: string | null;
  limit?: number | null;
  offset?: number | null;
} = {}) {
  const params = new URLSearchParams({ select: "*", order: "id.asc" });

  if (filters.type) params.set("type", `eq.${filters.type}`);
  if (filters.category) params.set("category", `eq.${filters.category}`);
  if (filters.sourceSheet) {
    params.set("source_sheet", `eq.${filters.sourceSheet}`);
  }
  if (filters.stock) params.set("stock", `eq.${filters.stock}`);

  const search = filters.search?.trim().toLowerCase();

  if (!search) {
    const { limit, offset } = sanitizePagination(filters.limit, filters.offset);
    params.set("limit", String(limit));
    params.set("offset", String(offset));
  }

  const rows = await supabaseRest<ProductRow[]>(`products?${params.toString()}`);

  return search
    ? rows.filter((product) =>
        `${product.name} ${product.brand} ${product.category}`
          .toLowerCase()
          .includes(search)
      )
    : rows;
}

export async function selectProductById(id: number) {
  const { anonKey } = requireSupabaseConfig();
  const rows = await supabaseRest<ProductRow[]>(
    `products?select=${PUBLIC_PRODUCT_COLUMNS}&id=eq.${id}&limit=1`,
    {},
    anonKey
  );

  return rows[0] ?? null;
}

export async function selectProductByIdService(id: number) {
  const rows = await supabaseRest<ProductRow[]>(
    `products?select=*&id=eq.${id}&limit=1`
  );

  return rows[0] ?? null;
}

export async function selectProductsByIdsService(ids: number[]) {
  const idList = Array.from(
    new Set(ids.filter((id) => Number.isInteger(id) && id > 0))
  ).join(",");

  if (!idList) return [];

  return supabaseRest<ProductRow[]>(
    `products?select=*&id=in.(${idList})&order=id.asc`
  );
}

export async function countProducts(stock?: "In Stock" | "Out of Stock") {
  const { anonKey } = requireSupabaseConfig();
  const params = new URLSearchParams({ select: "id" });

  if (stock) params.set("stock", `eq.${stock}`);

  return supabaseCount(`products?${params.toString()}`, anonKey);
}

export async function insertProduct(product: Partial<Product>) {
  const rows = await supabaseRest<ProductRow[]>(
    "products",
    {
      method: "POST",
      body: JSON.stringify(mapProductToRow(product)),
    }
  );

  return rows[0];
}

// Bulk sync from the Google Sheet is a service-level job, not a single
// admin's own write, and merge-duplicates across many rows is not something
// the per-row RLS policies are designed to authorize efficiently -- this one
// intentionally keeps using the service_role key (see "Admin setup" in README.md / the
// admin `requireAdmin()` gate in the route handler for the actual auth check).
type ProductionStockRow = {
  source_key: string;
  stock_quantity: number | null;
  sheet_stock_quantity: number | null;
  image?: string;
  full_specs?: Product["fullSpecs"];
};

const PRODUCT_SYNC_BATCH_SIZE = 100;
const PRODUCT_LOOKUP_BATCH_SIZE = 60;

function chunksOf<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

/**
 * Inventory has two writers: the production workbook (restocks, corrections)
 * and checkout (sales). Neither is a complete record, so a sync applies the
 * workbook's change since the previous sync rather than its absolute number.
 *
 * `sheetQuantity` is what the workbook says now, `current` is the stored row.
 * A row with no recorded baseline predates delta tracking, so the workbook is
 * treated as unchanged and the stored quantity is kept.
 */
/** The delta rule on its own: storefront stock moved by the sheet's change. */
function stockAfterSheetChange(
  sheetQuantity: number,
  current: Pick<ProductionStockRow, "stock_quantity" | "sheet_stock_quantity"> | undefined
) {
  if (!current) return sheetQuantity;

  const lastSheetQuantity = current.sheet_stock_quantity ?? sheetQuantity;
  const storefrontQuantity = current.stock_quantity ?? 0;

  return Math.max(0, storefrontQuantity + (sheetQuantity - lastSheetQuantity));
}

/**
 * Stock to show on the website after a sync.
 *
 * Applies the sheet's change since the last sync, so a sale the sheet has not
 * recorded yet is kept -- but the result is never MORE than the sheet.
 *
 * The website can legitimately be below the sheet (a checkout whose sheet
 * write-back failed), never above it. Being above means units were restocked
 * on the website that the sheet never received, e.g. an order cancelled before
 * cancellations updated the sheet. The delta rule alone cannot repair that --
 * the sheet's change is zero -- which is how a quantity of 0 in the sheet kept
 * showing as In Stock.
 */
export function reconcileStockQuantity(
  sheetQuantity: number,
  current: Pick<ProductionStockRow, "stock_quantity" | "sheet_stock_quantity"> | undefined
) {
  return Math.min(
    Math.max(0, sheetQuantity),
    stockAfterSheetChange(sheetQuantity, current)
  );
}

export type StockCorrection = {
  id: number | null;
  sourceKey: string;
  sourceSheet: string;
  name: string;
  websiteQuantity: number;
  sheetQuantity: number;
};

export type StockCorrectionPlan = {
  /** Website showed more units than the sheet; the sync lowers them. */
  aboveSheet: StockCorrection[];
  /** No longer in the sheet but still in stock; marked out of stock. */
  removedFromSheet: StockCorrection[];
  /** Missing from the sheet, but too many at once to trust; left unchanged. */
  heldBack: StockCorrection[];
};

export type SyncedStockRow = {
  id: number;
  name: string;
  source_sheet: string | null;
  source_key: string;
  stock_quantity: number | null;
  sheet_stock_quantity: number | null;
};

/**
 * Which synced products a sync will bring back in line with the sheet.
 * Pure, so the dry run can show it and tests can pin it down.
 */
export function planStockCorrections(
  sheetProducts: {
    sourceKey: string;
    sourceSheet: string;
    name?: string;
    stockQuantity?: number;
  }[],
  dbRows: SyncedStockRow[]
): StockCorrectionPlan {
  const rowsByKey = new Map(dbRows.map((row) => [row.source_key, row]));
  const sheetKeys = new Set(sheetProducts.map((product) => product.sourceKey));

  const aboveSheet = sheetProducts.flatMap((product) => {
    const row = rowsByKey.get(product.sourceKey);
    if (!row) return [];

    const sheetQuantity = Math.max(0, product.stockQuantity ?? 0);
    const uncapped = stockAfterSheetChange(sheetQuantity, row);
    if (uncapped <= sheetQuantity) return [];

    return [
      {
        id: row.id,
        sourceKey: product.sourceKey,
        sourceSheet: product.sourceSheet,
        name: product.name ?? row.name,
        websiteQuantity: uncapped,
        sheetQuantity,
      },
    ];
  });

  const removedFromSheet: StockCorrection[] = [];
  const heldBack: StockCorrection[] = [];
  const missingBySheet = new Map<string, StockCorrection[]>();

  for (const row of dbRows) {
    if (sheetKeys.has(row.source_key) || (row.stock_quantity ?? 0) <= 0) continue;

    const sheet = row.source_sheet ?? "Unknown";
    const list = missingBySheet.get(sheet) ?? [];
    list.push({
      id: row.id,
      sourceKey: row.source_key,
      sourceSheet: sheet,
      name: row.name,
      websiteQuantity: row.stock_quantity ?? 0,
      sheetQuantity: 0,
    });
    missingBySheet.set(sheet, list);
  }

  for (const [sheet, missing] of missingBySheet) {
    const loadedFromSheet = sheetProducts.filter(
      (product) => product.sourceSheet === sheet
    ).length;
    const onWebsite = dbRows.filter((row) => row.source_sheet === sheet).length;
    // A handful of deleted rows is normal. Many at once more likely means the
    // tab did not load fully, and marking them out of stock would empty the
    // shop -- so hold those back and warn instead.
    const limit = Math.max(3, Math.ceil(onWebsite * 0.05));

    if (loadedFromSheet > 0 && missing.length <= limit) {
      removedFromSheet.push(...missing);
    } else {
      heldBack.push(...missing);
    }
  }

  return { aboveSheet, removedFromSheet, heldBack };
}

/** Reads the website's synced stock and plans the corrections. Read-only. */
export async function previewStockCorrections(
  sheetProducts: Parameters<typeof planStockCorrections>[0]
) {
  let rows: SyncedStockRow[];

  try {
    rows = await supabaseRest<SyncedStockRow[]>(
      "products?select=id,name,source_sheet,source_key,stock_quantity,sheet_stock_quantity&source_key=not.is.null&limit=10000"
    );
  } catch (error) {
    if (!isMissingSheetBaselineColumn(error)) throw error;
    rows = (
      await supabaseRest<Omit<SyncedStockRow, "sheet_stock_quantity">[]>(
        "products?select=id,name,source_sheet,source_key,stock_quantity&source_key=not.is.null&limit=10000"
      )
    ).map((row) => ({ ...row, sheet_stock_quantity: null }));
  }

  return planStockCorrections(sheetProducts, rows);
}

/**
 * Marks products that were deleted from the sheet as out of stock (they are
 * not deleted from the shop). The baseline is reset to 0 as well, so putting
 * the row back in the sheet with N units shows N again on the next sync.
 */
export async function markRemovedProductsOutOfStock(corrections: StockCorrection[]) {
  const ids = corrections
    .map((correction) => correction.id)
    .filter((id): id is number => Number.isInteger(id));
  if (ids.length === 0) return 0;

  const path = `products?id=in.(${ids.join(",")})`;

  try {
    await supabaseRest(path, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ stock_quantity: 0, sheet_stock_quantity: 0 }),
    });
  } catch (error) {
    if (!isMissingSheetBaselineColumn(error)) throw error;
    await supabaseRest(path, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ stock_quantity: 0 }),
    });
  }

  return ids.length;
}

function isMissingSheetBaselineColumn(error: unknown) {
  return (
    error instanceof Error && error.message.includes("sheet_stock_quantity")
  );
}

/**
 * Returns null when 2026-08-10-sheet-stock-delta.sql has not been applied yet,
 * which tells callers to fall back to the pre-delta behaviour instead of
 * failing the whole sync on an unknown column.
 */
async function selectProductionStock(sourceKeys: string[]) {
  if (sourceKeys.length === 0) return new Map<string, ProductionStockRow>();

  try {
    const rows: ProductionStockRow[] = [];

    for (const batch of chunksOf(sourceKeys, PRODUCT_LOOKUP_BATCH_SIZE)) {
      const list = batch
        .map((key) => `"${key.replace(/"/g, '\\"')}"`)
        .join(",");
      rows.push(
        ...(await supabaseRest<ProductionStockRow[]>(
          `products?select=source_key,stock_quantity,sheet_stock_quantity,image,full_specs&source_key=in.(${encodeURIComponent(
            list
          )})`
        ))
      );
    }

    return new Map(rows.map((row) => [row.source_key, row]));
  } catch (error) {
    if (isMissingSheetBaselineColumn(error)) {
      console.warn(
        "[sheet-sync] sheet_stock_quantity column is missing; apply supabase/migrations/2026-08-10-sheet-stock-delta.sql. Falling back to overwriting inventory from the workbook."
      );
      return null;
    }

    throw error;
  }
}

/**
 * Records the workbook total a product has after a successful write-back, so
 * the next import sees no change for units the workbook already knows about.
 */
export async function setSheetStockBaselines(
  entries: { sourceKey: string; sheetQuantity: number }[]
) {
  for (const entry of entries) {
    try {
      await supabaseRest(
        `products?source_key=eq.${encodeURIComponent(entry.sourceKey)}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ sheet_stock_quantity: entry.sheetQuantity }),
        }
      );
    } catch (error) {
      if (!isMissingSheetBaselineColumn(error)) throw error;
      return;
    }
  }
}

/**
 * Moves each product's sync baseline BY an amount, rather than setting it to
 * an absolute sheet total.
 *
 * Used when the storefront itself writes units into the workbook (restocking a
 * cancelled order). Setting the baseline to the sheet's current total would
 * also absorb any manual sheet edit that has not been synced yet, and that
 * edit would then never reach the store. Shifting it by exactly the units we
 * wrote keeps those edits visible to the next sync.
 */
export async function adjustSheetStockBaselines(
  entries: { sourceKey: string; delta: number }[]
) {
  const wanted = entries.filter((entry) => entry.delta !== 0);
  if (wanted.length === 0) return;

  const current = await selectProductionStock(
    wanted.map((entry) => entry.sourceKey)
  );
  if (!current) return;

  for (const entry of wanted) {
    const baseline = current.get(entry.sourceKey)?.sheet_stock_quantity;

    // No baseline yet: the next sync treats the row as unchanged and records
    // one, which is already correct.
    if (baseline === null || baseline === undefined) continue;

    try {
      await supabaseRest(
        `products?source_key=eq.${encodeURIComponent(entry.sourceKey)}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            sheet_stock_quantity: Math.max(0, baseline + entry.delta),
          }),
        }
      );
    } catch (error) {
      if (!isMissingSheetBaselineColumn(error)) throw error;
      return;
    }
  }
}

/**
 * Reconciles workbook inventory with storefront inventory.
 *
 * The workbook is authoritative for restocks, but it is not the only writer:
 * checkout deducts stock_quantity immediately and only tells the workbook on a
 * best-effort basis. Overwriting stock_quantity with the workbook's absolute
 * number therefore resurrects sold units whenever write-back has not landed.
 * Instead, apply the workbook's change since the previous sync -- capped so the
 * website never shows more units than the sheet (see reconcileStockQuantity).
 */
export async function upsertProductionProducts(
  products: (ProductWrite & { sourceKey: string; sourceSheet: string })[]
) {
  if (products.length === 0) return [];

  const baseKeys = products.flatMap((product) => {
    const baseKey = specVariantBaseKey(product.sourceKey);
    return baseKey ? [baseKey] : [];
  });
  const existing = await selectProductionStock([
    ...new Set([...products.map((product) => product.sourceKey), ...baseKeys]),
  ]);

  const rows = products.map((product) => {
    const row = mapProductionProductToRow(product);
    const baseKey = specVariantBaseKey(product.sourceKey);
    // Photos only: a spec version that is new to the website (e.g. the 512 GB
    // of a laptop already on sale) starts with the photos of its model.
    const previous =
      existing?.get(product.sourceKey) ??
      (baseKey ? existing?.get(baseKey) : undefined);
    const { normalizeGallery } = galleryHelpers;
    const suppliedGallery = normalizeGallery(product.fullSpecs?.gallery);
    const oldGallery = normalizeGallery(previous?.full_specs?.gallery);
    const keepAdminGallery = previous?.full_specs?.galleryManagedBy === "admin";
    const gallery = keepAdminGallery ? oldGallery : suppliedGallery.length ? suppliedGallery : oldGallery;
    row.full_specs = { ...product.fullSpecs, gallery,
      galleryManagedBy: keepAdminGallery ? "admin" : "sheet",
      photoSource: keepAdminGallery || !suppliedGallery.length ? previous?.full_specs?.photoSource ?? "" : product.fullSpecs?.photoSource ?? "" };
    // Always provide a cover per row so mixed upsert batches cannot turn a
    // previous manual cover into NULL. Preserve admin overrides and old covers.
    row.image = keepAdminGallery ? previous?.image ?? gallery[0]?.url ?? galleryHelpers.PRODUCT_PLACEHOLDER
      : gallery[0]?.url ?? previous?.image ?? galleryHelpers.PRODUCT_PLACEHOLDER;
    const sheetQuantity = product.stockQuantity ?? 0;

    if (!existing) return row;

    row.stock_quantity = reconcileStockQuantity(
      sheetQuantity,
      existing.get(product.sourceKey)
    );
    row.sheet_stock_quantity = sheetQuantity;
    row.stock = (row.stock_quantity as number) > 0 ? "In Stock" : "Out of Stock";

    return row;
  });

  const synced: ProductRow[] = [];
  for (const batch of chunksOf(rows, PRODUCT_SYNC_BATCH_SIZE)) {
    synced.push(
      ...(await supabaseRest<ProductRow[]>("products?on_conflict=source_key", {
        method: "POST",
        headers: {
          Prefer:
            "resolution=merge-duplicates,return=representation,missing=default",
        },
        // Image/model/wholesale fields are deliberately omitted. The database
        // supplies the production placeholder on insert, and later manual
        // catalogue edits remain untouched when an existing source_key is
        // synchronized.
        body: JSON.stringify(batch),
      }))
    );
  }

  return synced;
}

export async function updateProduct(
  id: number,
  product: Partial<Product>
) {
  const rows = await supabaseRest<ProductRow[]>(
    `products?id=eq.${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(mapProductPatchToRow(product)),
    }
  );

  return rows[0] ?? null;
}

export async function deleteProduct(id: number) {
  await supabaseRest(
    `products?id=eq.${id}`,
    { method: "DELETE" }
  );
}

// Cart/wishlist rows are always scoped to the calling user's own account, so
// every one of these runs under the caller's own access token (not the
// service_role key) -- PostgREST then executes as `authenticated` and the
// "Users manage own cart" / "Users manage own wishlist" RLS policies in
// supabase/schema.sql are the real enforcement boundary, not just the
// `user_id=eq.` filter below.
export async function selectCart(userId: string, accessToken: string) {
  const { anonKey } = requireSupabaseConfig();
  return supabaseRest<CartItemRow[]>(
    `cart_items?select=id,user_id,product_id,quantity,created_at,updated_at,products(${PUBLIC_PRODUCT_COLUMNS})&user_id=eq.${encodeURIComponent(
      userId
    )}&order=created_at.asc`,
    {},
    accessToken,
    anonKey
  );
}

export async function upsertCartItem(
  userId: string,
  productId: number,
  quantity: number,
  accessToken: string
) {
  const { anonKey } = requireSupabaseConfig();
  const rows = await supabaseRest<CartItemRow[]>(
    "cart_items",
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({
        user_id: userId,
        product_id: productId,
        quantity,
      }),
    },
    accessToken,
    anonKey
  );

  return rows[0];
}

export async function updateCartItem(
  userId: string,
  id: string,
  quantity: number,
  accessToken: string
) {
  const { anonKey } = requireSupabaseConfig();
  const rows = await supabaseRest<CartItemRow[]>(
    `cart_items?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ quantity }),
    },
    accessToken,
    anonKey
  );

  return rows[0] ?? null;
}

export async function deleteCartItem(userId: string, id: string, accessToken: string) {
  const { anonKey } = requireSupabaseConfig();
  await supabaseRest(
    `cart_items?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,
    { method: "DELETE" },
    accessToken,
    anonKey
  );
}

export async function clearCart(userId: string, accessToken: string) {
  const { anonKey } = requireSupabaseConfig();
  await supabaseRest(
    `cart_items?user_id=eq.${encodeURIComponent(userId)}`,
    { method: "DELETE" },
    accessToken,
    anonKey
  );
}

export async function selectWishlist(userId: string, accessToken: string) {
  const { anonKey } = requireSupabaseConfig();
  return supabaseRest<WishlistItemRow[]>(
    `wishlist_items?select=id,user_id,product_id,created_at,products(${PUBLIC_PRODUCT_COLUMNS})&user_id=eq.${encodeURIComponent(
      userId
    )}&order=created_at.asc`,
    {},
    accessToken,
    anonKey
  );
}

export async function insertWishlistItem(
  userId: string,
  productId: number,
  accessToken: string
) {
  const { anonKey } = requireSupabaseConfig();
  const rows = await supabaseRest<WishlistItemRow[]>(
    "wishlist_items",
    {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        product_id: productId,
      }),
    },
    accessToken,
    anonKey
  );

  return rows[0];
}

export async function deleteWishlistItem(userId: string, id: string, accessToken: string) {
  const { anonKey } = requireSupabaseConfig();
  await supabaseRest(
    `wishlist_items?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,
    { method: "DELETE" },
    accessToken,
    anonKey
  );
}

// ---------------------------------------------------------------------------
// Back-in-stock and price-drop alerts
// ---------------------------------------------------------------------------

export type ProductAlertRow = {
  id: string;
  user_id: string;
  product_id: number;
  kind: "back_in_stock" | "price_drop";
  baseline_price: number;
  baseline_stock: string;
  target_price: number | null;
  created_at: string;
  products?: ProductRow | null;
};

// These three use the SERVICE ROLE, like recently_viewed_products: the table
// is closed to browser roles (see the migration), and the calling route has
// already authenticated the customer. Every query is scoped by user_id, which
// is what keeps one customer out of another's alerts -- passing the customer's
// own token here instead would fail with "permission denied for table".
export async function selectProductAlerts(userId: string) {
  return supabaseRest<ProductAlertRow[]>(
    `product_alerts?select=id,user_id,product_id,kind,baseline_price,baseline_stock,target_price,created_at,products(${PUBLIC_PRODUCT_COLUMNS})&user_id=eq.${encodeURIComponent(
      userId
    )}&order=created_at.desc`
  );
}

export async function insertProductAlert(alert: {
  userId: string;
  productId: number;
  kind: "back_in_stock" | "price_drop";
  baselinePrice: number;
  baselineStock: string;
  targetPrice: number | null;
}) {
  const rows = await supabaseRest<ProductAlertRow[]>(
    // Re-following a product refreshes the baseline instead of failing on the
    // (user_id, product_id, kind) unique constraint.
    "product_alerts?on_conflict=user_id,product_id,kind",
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        user_id: alert.userId,
        product_id: alert.productId,
        kind: alert.kind,
        baseline_price: alert.baselinePrice,
        baseline_stock: alert.baselineStock,
        target_price: alert.targetPrice,
      }),
    }
  );

  return rows[0];
}

export async function deleteProductAlert(userId: string, id: string) {
  await supabaseRest(
    `product_alerts?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,
    { method: "DELETE" }
  );
}

// The payment_slips table arrives with
// supabase/migrations/2026-09-16-prepaid-payments-and-slips.sql. Until that is
// run, PostgREST rejects the embed with "Could not find a relationship", which
// would take the whole order list and the admin dashboard down. So ask for the
// slips, and stop asking for the rest of this process the first time the
// database says they are not there.
let paymentSlipsEmbed = true;

export function orderSelect() {
  // `profiles!orders_user_id_fkey` names WHICH link to follow: orders now
  // point at profiles twice (the customer, and payment_verified_by), and a
  // plain `profiles(...)` embed fails with "more than one relationship".
  return `*,profiles!orders_user_id_fkey(email,full_name,role),order_items(*,products(${PUBLIC_PRODUCT_COLUMNS})),delivery_events(*),return_evidence(*)${
    paymentSlipsEmbed ? ",payment_slips(*)" : ""
  }`;
}

function isMissingPaymentSlips(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("payment_slips");
}

/**
 * Runs an order query, retrying once without the slips embed when the table is
 * not there yet. The query is rebuilt inside, so the retry uses the shorter
 * select.
 */
async function withOptionalPaymentSlips<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!paymentSlipsEmbed || !isMissingPaymentSlips(error)) throw error;

    console.warn(
      "[orders] payment_slips is missing; run supabase/migrations/2026-09-16-prepaid-payments-and-slips.sql. Loading orders without transfer slips."
    );
    paymentSlipsEmbed = false;
    return run();
  }
}

// Orders run under the caller's own access token, not the service role key.
// The "Owners or admins read/update orders" RLS policies re-derive the same
// ownership/admin check from auth.uid() server-side, so this is real
// defense-in-depth rather than just the `user_id=eq.` filter below.
export async function selectOrders(
  user: CurrentUser,
  pagination: { limit?: number | null; offset?: number | null } = {}
) {
  const { anonKey } = requireSupabaseConfig();
  const ownerFilter =
    user.role === "admin" ? "" : `&user_id=eq.${encodeURIComponent(user.id)}`;
  const { limit, offset } = sanitizePagination(
    pagination.limit,
    pagination.offset
  );

  return withOptionalPaymentSlips(() =>
    supabaseRest<OrderRow[]>(
      `orders?select=${orderSelect()}${ownerFilter}&order=created_at.desc&limit=${limit}&offset=${offset}`,
      {},
      user.accessToken,
      anonKey
    )
  );
}

export async function selectOrderById(user: CurrentUser, id: string) {
  const { anonKey } = requireSupabaseConfig();
  const ownerFilter =
    user.role === "admin" ? "" : `&user_id=eq.${encodeURIComponent(user.id)}`;
  const rows = await withOptionalPaymentSlips(() =>
    supabaseRest<OrderRow[]>(
      `orders?select=${orderSelect()}&id=eq.${encodeURIComponent(id)}${ownerFilter}&limit=1`,
      {},
      user.accessToken,
      anonKey
    )
  );

  return rows[0] ?? null;
}

/**
 * Orders whose shipping phone ends in `tail`, service-role.
 *
 * For the signed-out delivery lookup (app/api/track/route.ts). It runs before
 * anyone is identified, so it deliberately takes no token -- and it is
 * therefore only safe behind a caller that has already matched the order code
 * *and* the phone number, and that returns nothing but guestTrackingView().
 *
 * Matching on the tail rather than the whole number is what lets
 * "+959420082522" find an order saved as "09420082522". The result is capped
 * because a tail is not unique: a handful of customers can share one, and the
 * caller filters by order code afterwards.
 */
export async function selectOrdersByPhoneTailService(tail: string) {
  const digits = tail.replace(/\D+/g, "");

  if (digits.length < 6) return [];

  return withOptionalPaymentSlips(() =>
    supabaseRest<OrderRow[]>(
      `orders?select=${orderSelect()}&shipping_phone=like.*${encodeURIComponent(digits)}` +
        `&order=created_at.desc&limit=50`
    )
  );
}

export async function countOrders(
  accessToken: string,
  status?: OrderRow["status"]
) {
  const { anonKey } = requireSupabaseConfig();
  const params = new URLSearchParams({ select: "id" });

  if (status) params.set("status", `eq.${status}`);

  return supabaseCount(`orders?${params.toString()}`, accessToken, anonKey);
}

// Slim projection for dashboard aggregates (revenue, monthly trend, status
// breakdown) -- avoids the full order_items/products join that the orders
// management table needs, since only these three columns are used here.
export type OrderStatsRow = Pick<OrderRow, "total_amount" | "status" | "created_at">;

export async function selectOrderStats(accessToken: string) {
  const { anonKey } = requireSupabaseConfig();
  return supabaseRest<OrderStatsRow[]>(
    "orders?select=total_amount,status,created_at",
    {},
    accessToken,
    anonKey
  );
}

export type TopProductRow = {
  product_id: number;
  quantity: number;
  products: Pick<ProductRow, "name" | "image"> | null;
};

// Slim projection over order_items for a "best sellers" aggregate -- summed
// client-side in app/lib/backend.ts since PostgREST (without a custom SQL
// view) doesn't expose a GROUP BY/SUM endpoint.
export async function selectOrderItemStats(accessToken: string) {
  const { anonKey } = requireSupabaseConfig();
  return supabaseRest<TopProductRow[]>(
    "order_items?select=product_id,quantity,products(name,image)",
    {},
    accessToken,
    anonKey
  );
}

export async function updateOrderStatus(
  id: string,
  status: OrderRow["status"],
  accessToken: string,
  options: {
    paymentStatus?: OrderRow["payment_status"];
    confirmedAt?: string;
    deliveredAt?: string;
    receiptNumber?: string;
    receiptEmailStatus?: OrderRow["receipt_email_status"];
    receiptSentAt?: string | null;
    receiptEmailError?: string | null;
  } = {}
) {
  const { anonKey } = requireSupabaseConfig();
  const rows = await supabaseRest<OrderRow[]>(
    `orders?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status,
        ...(options.paymentStatus ? { payment_status: options.paymentStatus } : {}),
        ...(options.confirmedAt ? { confirmed_at: options.confirmedAt } : {}),
        ...(options.deliveredAt ? { delivered_at: options.deliveredAt } : {}),
        ...(options.receiptNumber ? { receipt_number: options.receiptNumber } : {}),
        ...(options.receiptEmailStatus
          ? { receipt_email_status: options.receiptEmailStatus }
          : {}),
        ...(options.receiptSentAt !== undefined
          ? { receipt_sent_at: options.receiptSentAt }
          : {}),
        ...(options.receiptEmailError !== undefined
          ? { receipt_email_error: options.receiptEmailError }
          : {}),
      }),
    },
    accessToken,
    anonKey
  ).catch(throwCodError);

  return rows[0] ?? null;
}

export async function updateOrderDeliveryService(
  id: string,
  fields: {
    cod_verification_status?: CodVerificationStatus;
    cod_verification_method?: "phone_callback" | "cod_deposit" | "admin_review" | null;
    cod_verified_at?: string | null;
    delivery_latitude?: number | null;
    delivery_longitude?: number | null;
    delivery_accuracy_m?: number | null;
    delivery_location_consent?: boolean;
    delivery_location_captured_at?: string | null;
    courier_name?: string | null;
    delivery_tracking_number?: string | null;
    estimated_delivery_at?: string | null;
    delivery_status_detail?: string | null;
    delivery_last_event_at?: string | null;
  }
) {
  const rows = await supabaseRest<OrderRow[]>(
    `orders?id=eq.${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(fields) }
  );
  return rows[0] ?? null;
}

export async function insertDeliveryEvent(fields: {
  order_id: string;
  stage: DeliveryEventStage;
  title: string;
  description?: string | null;
  location_label?: string | null;
  happened_at?: string;
  created_by?: string | null;
  visible_to_customer?: boolean;
}) {
  const rows = await supabaseRest<DeliveryEventRow[]>("delivery_events", {
    method: "POST",
    body: JSON.stringify({
      ...fields,
      description: fields.description ?? null,
      location_label: fields.location_label ?? null,
      happened_at: fields.happened_at ?? new Date().toISOString(),
      created_by: fields.created_by ?? null,
      visible_to_customer: fields.visible_to_customer ?? true,
    }),
  });
  return rows[0];
}

export async function insertReturnEvidence(fields: {
  order_id: string;
  uploaded_by: string;
  evidence_kind: ReturnEvidenceKind;
  storage_path?: string | null;
  external_url?: string | null;
  file_name?: string | null;
  content_type?: string | null;
  size_bytes?: number | null;
  case_id?: string | null;
  return_request_id?: string | null;
}) {
  const rows = await supabaseRest<ReturnEvidenceRow[]>("return_evidence", {
    method: "POST",
    body: JSON.stringify({
      ...fields,
      storage_path: fields.storage_path ?? null,
      external_url: fields.external_url ?? null,
      file_name: fields.file_name ?? null,
      content_type: fields.content_type ?? null,
      size_bytes: fields.size_bytes ?? null,
      case_id: fields.case_id ?? null,
      return_request_id: fields.return_request_id ?? null,
    }),
  });
  return rows[0];
}

export async function selectReturnEvidenceById(id: string) {
  const rows = await supabaseRest<ReturnEvidenceRow[]>(
    `return_evidence?select=*&id=eq.${encodeURIComponent(id)}&limit=1`
  );
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Help cases and per-item return requests
//
// Service-role only, like every other order-lifecycle helper here: the route
// authenticates the account and checks ownership before calling in.
// ---------------------------------------------------------------------------

/** `profiles!order_help_cases_customer_id_fkey` names WHICH link to follow:
 *  a case points at profiles twice (the customer, and assigned_admin_id). */
const helpCaseSelect =
  "*,profiles!order_help_cases_customer_id_fkey(email,full_name,role),return_evidence(*)";

export async function insertOrderHelpCase(fields: {
  order_id: string;
  customer_id: string;
  topic: HelpCaseTopic;
  summary: string;
  conversation_id?: string | null;
}) {
  const rows = await supabaseRest<OrderHelpCaseRow[]>("order_help_cases", {
    method: "POST",
    body: JSON.stringify({
      ...fields,
      conversation_id: fields.conversation_id ?? null,
    }),
  });
  return rows[0];
}

export async function selectHelpCasesForCustomer(customerId: string) {
  return supabaseRest<OrderHelpCaseRow[]>(
    `order_help_cases?select=${encodeURIComponent(
      helpCaseSelect
    )}&customer_id=eq.${encodeURIComponent(customerId)}&order=created_at.desc`
  );
}

export async function selectHelpCases() {
  return supabaseRest<OrderHelpCaseRow[]>(
    `order_help_cases?select=${encodeURIComponent(
      helpCaseSelect
    )}&order=created_at.desc&limit=200`
  );
}

export async function selectHelpCaseById(id: string) {
  const rows = await supabaseRest<OrderHelpCaseRow[]>(
    `order_help_cases?select=${encodeURIComponent(
      helpCaseSelect
    )}&id=eq.${encodeURIComponent(id)}&limit=1`
  );
  return rows[0] ?? null;
}

export async function updateHelpCaseService(
  id: string,
  fields: Partial<
    Pick<
      OrderHelpCaseRow,
      "status" | "admin_note" | "assigned_admin_id" | "resolved_at" | "conversation_id"
    >
  >
) {
  const rows = await supabaseRest<OrderHelpCaseRow[]>(
    `order_help_cases?id=eq.${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(fields) }
  );
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Admin work queue: ownership + internal notes
//
// The LANE is derived in work-queue.ts and never stored. Only the things that
// cannot be derived live in the database.
// ---------------------------------------------------------------------------

export type QueueSubjectType = "order" | "help_case" | "return_request";

export type WorkQueueItemRow = {
  id: string;
  subject_type: QueueSubjectType;
  subject_id: string;
  owner_id: string | null;
  next_action: string | null;
  due_at: string | null;
  created_at: string;
  updated_at: string;
};

export type StaffNoteRow = {
  id: string;
  subject_type: QueueSubjectType;
  subject_id: string;
  author_id: string;
  body: string;
  created_at: string;
  profiles?: Pick<Profile, "email" | "full_name" | "role"> | null;
};

export async function selectWorkQueueItems() {
  return supabaseRest<WorkQueueItemRow[]>(
    "work_queue_items?select=*&limit=500"
  );
}

/** One assignment per case, so this is an upsert on (subject_type, subject_id). */
export async function upsertWorkQueueItem(fields: {
  subject_type: QueueSubjectType;
  subject_id: string;
  owner_id?: string | null;
  next_action?: string | null;
  due_at?: string | null;
}) {
  const rows = await supabaseRest<WorkQueueItemRow[]>(
    "work_queue_items?on_conflict=subject_type,subject_id",
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({
        ...fields,
        owner_id: fields.owner_id ?? null,
        next_action: fields.next_action ?? null,
        due_at: fields.due_at ?? null,
        updated_at: new Date().toISOString(),
      }),
    }
  );

  return rows[0] ?? null;
}

const staffNoteSelect =
  "*,profiles!staff_notes_author_id_fkey(email,full_name,role)";

export async function selectStaffNotes(
  subjectType: QueueSubjectType,
  subjectId: string
) {
  return supabaseRest<StaffNoteRow[]>(
    `staff_notes?select=${encodeURIComponent(
      staffNoteSelect
    )}&subject_type=eq.${encodeURIComponent(
      subjectType
    )}&subject_id=eq.${encodeURIComponent(subjectId)}&order=created_at.desc&limit=100`
  );
}

export async function insertStaffNote(fields: {
  subject_type: QueueSubjectType;
  subject_id: string;
  author_id: string;
  body: string;
}) {
  const rows = await supabaseRest<StaffNoteRow[]>("staff_notes", {
    method: "POST",
    body: JSON.stringify(fields),
  });

  return rows[0] ?? null;
}

const returnRequestSelect =
  "*,profiles!return_requests_customer_id_fkey(email,full_name,role),order_items(*,products(id,name,brand,image)),return_evidence(*)";

export async function insertReturnRequest(fields: {
  order_id: string;
  order_item_id: string;
  customer_id: string;
  quantity: number;
  reason_code: ReturnReasonCode;
  description: string;
  preferred_resolution: ReturnResolution;
  collection_method: ReturnPickupMethod;
  pickup_address?: string | null;
  unboxing_video_confirmed: boolean;
}) {
  const rows = await supabaseRest<ReturnRequestRow[]>("return_requests", {
    method: "POST",
    body: JSON.stringify({
      ...fields,
      pickup_address: fields.pickup_address ?? null,
    }),
  });
  return rows[0];
}

export async function selectReturnRequestsForCustomer(customerId: string) {
  return supabaseRest<ReturnRequestRow[]>(
    `return_requests?select=${encodeURIComponent(
      returnRequestSelect
    )}&customer_id=eq.${encodeURIComponent(customerId)}&order=created_at.desc`
  );
}

export async function selectReturnRequests() {
  return supabaseRest<ReturnRequestRow[]>(
    `return_requests?select=${encodeURIComponent(
      returnRequestSelect
    )}&order=created_at.desc&limit=200`
  );
}

export async function selectReturnRequestById(id: string) {
  const rows = await supabaseRest<ReturnRequestRow[]>(
    `return_requests?select=${encodeURIComponent(
      returnRequestSelect
    )}&id=eq.${encodeURIComponent(id)}&limit=1`
  );
  return rows[0] ?? null;
}

export async function updateReturnRequestService(
  id: string,
  fields: Partial<
    Pick<
      ReturnRequestRow,
      | "status"
      | "resolution_granted"
      | "admin_decision_note"
      | "decided_by"
      | "decided_at"
      | "review_requested_at"
      | "review_request_note"
      | "refund_amount"
      | "refund_method"
      | "refund_reference"
      | "refund_approved_at"
      | "refund_sent_at"
      | "expected_refund_at"
      | "delay_reason"
    >
  >
) {
  const rows = await supabaseRest<ReturnRequestRow[]>(
    `return_requests?id=eq.${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(fields) }
  );
  return rows[0] ?? null;
}

export type PaymentSlipRow = {
  id: string;
  order_id: string;
  uploaded_by: string;
  storage_path: string;
  file_name: string | null;
  content_type: string | null;
  size_bytes: number | null;
  note: string | null;
  created_at: string;
};

export async function insertPaymentSlip(fields: {
  order_id: string;
  uploaded_by: string;
  storage_path: string;
  file_name?: string | null;
  content_type?: string | null;
  size_bytes?: number | null;
  note?: string | null;
}) {
  const rows = await supabaseRest<PaymentSlipRow[]>("payment_slips", {
    method: "POST",
    body: JSON.stringify({
      ...fields,
      file_name: fields.file_name ?? null,
      content_type: fields.content_type ?? null,
      size_bytes: fields.size_bytes ?? null,
      note: fields.note ?? null,
    }),
  });
  return rows[0];
}

export async function selectPaymentSlipById(id: string) {
  const rows = await supabaseRest<PaymentSlipRow[]>(
    `payment_slips?select=*&id=eq.${encodeURIComponent(id)}&limit=1`
  );
  return rows[0] ?? null;
}

/** Payment fields only: kept apart from the delivery updater above. */
export async function updateOrderPaymentService(
  id: string,
  fields: {
    payment_account?: string | null;
    payment_reference?: string | null;
    payment_verification_status?: PaymentVerificationStatus;
    payment_verified_at?: string | null;
    payment_verified_by?: string | null;
    payment_rejected_reason?: string | null;
    payment_amount_received?: number | null;
    payment_correction_reason?: PaymentCorrectionReason | null;
    payment_correction_requested_at?: string | null;
    payment_status?: OrderRow["payment_status"];
  }
) {
  const rows = await supabaseRest<OrderRow[]>(
    `orders?id=eq.${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(fields) }
  );
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Price lists + quantity tiers
//
// Reads for pricing run under the CUSTOMER'S own token: RLS only exposes the
// price list a wholesale-approved profile is assigned to, so an unapproved or
// suspended account reads nothing even if this code were called for them.
// Admin CRUD runs under the admin's token ("Admins manage ..." policies).
// ---------------------------------------------------------------------------

export async function selectPriceListById(id: string, accessToken: string) {
  const { anonKey } = requireSupabaseConfig();
  const rows = await supabaseRest<PriceListRow[]>(
    `price_lists?select=*&id=eq.${encodeURIComponent(id)}&limit=1`,
    {},
    accessToken,
    anonKey
  );

  return rows[0] ?? null;
}

export async function selectTiersForProducts(
  priceListId: string,
  productIds: number[],
  accessToken: string
) {
  if (productIds.length === 0) return [];

  const { anonKey } = requireSupabaseConfig();
  const idList = productIds
    .filter((id) => Number.isInteger(id) && id > 0)
    .join(",");

  return supabaseRest<PriceTierRow[]>(
    `product_price_tiers?select=*&price_list_id=eq.${encodeURIComponent(
      priceListId
    )}&product_id=in.(${idList})&order=min_quantity.asc`,
    {},
    accessToken,
    anonKey
  );
}

export async function selectPriceLists(adminToken: string) {
  const { anonKey } = requireSupabaseConfig();
  return supabaseRest<PriceListRow[]>(
    "price_lists?select=*&order=created_at.asc",
    {},
    adminToken,
    anonKey
  );
}

export async function insertPriceList(
  fields: Pick<PriceListRow, "name" | "description" | "is_active">,
  adminToken: string
) {
  const { anonKey } = requireSupabaseConfig();
  const rows = await supabaseRest<PriceListRow[]>(
    "price_lists",
    { method: "POST", body: JSON.stringify(fields) },
    adminToken,
    anonKey
  );

  return rows[0];
}

export async function updatePriceList(
  id: string,
  fields: Partial<Pick<PriceListRow, "name" | "description" | "is_active">>,
  adminToken: string
) {
  const { anonKey } = requireSupabaseConfig();
  const rows = await supabaseRest<PriceListRow[]>(
    `price_lists?id=eq.${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(fields) },
    adminToken,
    anonKey
  );

  return rows[0] ?? null;
}

export async function selectTiersAdmin(
  filters: { priceListId?: string | null; productId?: number | null },
  adminToken: string
) {
  const { anonKey } = requireSupabaseConfig();
  const params = new URLSearchParams({
    select: "*",
    order: "product_id.asc,min_quantity.asc",
  });

  if (filters.priceListId) params.set("price_list_id", `eq.${filters.priceListId}`);
  if (filters.productId) params.set("product_id", `eq.${filters.productId}`);

  return supabaseRest<PriceTierRow[]>(
    `product_price_tiers?${params.toString()}`,
    {},
    adminToken,
    anonKey
  );
}

export type TierInput = {
  price_list_id: string;
  product_id: number;
  min_quantity: number;
  unit_price: number;
  is_active: boolean;
  effective_from: string | null;
  effective_to: string | null;
};

export async function insertTier(fields: TierInput, adminToken: string) {
  const { anonKey } = requireSupabaseConfig();
  const rows = await supabaseRest<PriceTierRow[]>(
    "product_price_tiers",
    { method: "POST", body: JSON.stringify(fields) },
    adminToken,
    anonKey
  );

  return rows[0];
}

export async function updateTier(
  id: string,
  fields: Partial<Omit<TierInput, "price_list_id" | "product_id">>,
  adminToken: string
) {
  const { anonKey } = requireSupabaseConfig();
  const rows = await supabaseRest<PriceTierRow[]>(
    `product_price_tiers?id=eq.${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(fields) },
    adminToken,
    anonKey
  );

  return rows[0] ?? null;
}

export async function deleteTier(id: string, adminToken: string) {
  const { anonKey } = requireSupabaseConfig();
  await supabaseRest(
    `product_price_tiers?id=eq.${encodeURIComponent(id)}`,
    { method: "DELETE" },
    adminToken,
    anonKey
  );
}

// ---------------------------------------------------------------------------
// Percentage ("% off retail") bands
// ---------------------------------------------------------------------------

// Structurally identical to PercentBand in lib/pricing.ts, declared here so the
// data layer stays free of pricing imports.
export type PercentBandRow = {
  id: string;
  price_list_id: string;
  product_id: number | null;
  min_quantity: number;
  discount_percent: number;
  is_active: boolean;
  effective_from: string | null;
  effective_to: string | null;
};

let warnedMissingPercentTable = false;

/** True only for "the percentage table isn't there yet", i.e. the state before
 *  the 2026-09-13 migration has been run. Any other failure still throws. */
function isMissingPercentTable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes("price_list_percent_tiers") &&
    /does not exist|could not find the table|PGRST205/i.test(message)
  );
}

/** List-wide bands (product_id is null) plus any per-product override rows for
 *  the products actually being priced. */
export async function selectPercentBandsForList(
  priceListId: string,
  productIds: number[],
  accessToken: string
) {
  const { anonKey } = requireSupabaseConfig();
  const idList = productIds
    .filter((id) => Number.isInteger(id) && id > 0)
    .join(",");

  const filter = idList
    ? `&or=(product_id.is.null,product_id.in.(${idList}))`
    : "&product_id=is.null";

  try {
    return await supabaseRest<PercentBandRow[]>(
      `price_list_percent_tiers?select=*&price_list_id=eq.${encodeURIComponent(
        priceListId
      )}${filter}&order=min_quantity.asc`,
      {},
      accessToken,
      anonKey
    );
  } catch (error) {
    // Deploy-order safety net: if the migration has not been run yet, fall back
    // to the previous behaviour (fixed tiers / retail) instead of failing the
    // whole cart. A missing discount is recoverable; a 500 at checkout is not.
    // Loud on the server so this can never be mistaken for correct pricing.
    if (isMissingPercentTable(error)) {
      if (!warnedMissingPercentTable) {
        warnedMissingPercentTable = true;
        console.warn(
          "[pricing] price_list_percent_tiers is missing - run supabase/migrations/2026-09-13-b2b-percent-tiers-and-invite-codes.sql. Wholesale accounts keep their old prices until then."
        );
      }

      return [];
    }

    throw error;
  }
}

export async function selectPercentBandsAdmin(priceListId: string | null, adminToken: string) {
  const { anonKey } = requireSupabaseConfig();
  const scope = priceListId
    ? `&price_list_id=eq.${encodeURIComponent(priceListId)}`
    : "";

  return supabaseRest<PercentBandRow[]>(
    `price_list_percent_tiers?select=*${scope}&order=min_quantity.asc`,
    {},
    adminToken,
    anonKey
  );
}

export async function upsertPercentBandService(fields: {
  price_list_id: string;
  product_id: number | null;
  min_quantity: number;
  discount_percent: number;
  is_active?: boolean;
}) {
  const rows = await supabaseRest<PercentBandRow[]>("price_list_percent_tiers", {
    method: "POST",
    body: JSON.stringify(fields),
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
  });

  return rows[0] ?? null;
}

export async function deletePercentBandService(id: string) {
  await supabaseRest(`price_list_percent_tiers?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// ---------------------------------------------------------------------------
// One-time wholesale registration codes
// ---------------------------------------------------------------------------

export type WholesaleInviteRow = {
  id: string;
  code_hash: string;
  code_hint: string;
  label: string | null;
  price_list_id: string | null;
  max_uses: number;
  use_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  last_used_at: string | null;
};

export async function insertInviteCodeService(fields: {
  code_hash: string;
  code_hint: string;
  label: string | null;
  price_list_id: string | null;
  max_uses: number;
  expires_at: string | null;
  created_by: string;
}) {
  const rows = await supabaseRest<WholesaleInviteRow[]>("wholesale_invite_codes", {
    method: "POST",
    body: JSON.stringify(fields),
  });

  return rows[0];
}

/** Never selects code_hash: the plain code is unrecoverable by design and the
 *  hash has no business being sent to a browser. */
export async function selectInviteCodesService() {
  return supabaseRest<Omit<WholesaleInviteRow, "code_hash">[]>(
    "wholesale_invite_codes?select=id,code_hint,label,price_list_id,max_uses,use_count,expires_at,is_active,created_by,created_at,last_used_at&order=created_at.desc&limit=100"
  );
}

/** Cheap pre-check so an invalid code is rejected BEFORE an auth account is
 *  created. The authoritative consume still happens in redeemInviteCodeService. */
export async function selectInviteByHashService(codeHash: string) {
  const rows = await supabaseRest<WholesaleInviteRow[]>(
    `wholesale_invite_codes?select=*&code_hash=eq.${encodeURIComponent(codeHash)}&limit=1`
  );

  return rows[0] ?? null;
}

export async function deactivateInviteCodeService(id: string) {
  const rows = await supabaseRest<WholesaleInviteRow[]>(
    `wholesale_invite_codes?id=eq.${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify({ is_active: false }) }
  );

  return rows[0] ?? null;
}

/** Atomically consumes one use of a code. Returns null when the code is
 *  unknown, inactive, expired or already fully used -- the check and the
 *  increment happen in one statement so concurrent signups cannot both win. */
export async function redeemInviteCodeService(codeHash: string) {
  const result = await supabaseRest<WholesaleInviteRow | WholesaleInviteRow[] | null>(
    "rpc/redeem_wholesale_invite",
    { method: "POST", body: JSON.stringify({ p_code_hash: codeHash }) }
  );

  const row = Array.isArray(result) ? result[0] ?? null : result;
  return row && row.id ? row : null;
}

export async function insertRegistrationRequestService(fields: {
  user_id: string;
  invite_id: string;
}) {
  await supabaseRest("wholesale_registration_requests", {
    method: "POST",
    body: JSON.stringify(fields),
    headers: { Prefer: "resolution=merge-duplicates" },
  });
}

// ---------------------------------------------------------------------------
// Wholesale account administration (customer listing)
// ---------------------------------------------------------------------------

// Service-role read, like the other admin profile helpers below: deployed
// databases created before the "Admins read all profiles" policy existed
// would return an empty list under the admin's own token. Callers MUST run
// requireAdmin() first (adminListWholesaleAccounts does).
export async function selectCustomerProfiles(
  filters: { search?: string | null; wholesaleOnly?: boolean } = {}
) {
  const params = new URLSearchParams({
    select: "id,email,full_name,role,wholesale_status,price_list_id,business_name,business_verified_at,created_at",
    role: "neq.admin",
    order: "created_at.desc",
    limit: "200",
  });

  if (filters.wholesaleOnly) {
    params.set("wholesale_status", "in.(approved,suspended)");
  }

  const search = filters.search?.trim();

  if (search) {
    // PostgREST `or` filter over email/full_name. `*` is the wildcard; commas
    // and parens would change the filter grammar, so strip them.
    const term = search.replace(/[,()*]/g, "");
    params.set("or", `(email.ilike.*${term}*,full_name.ilike.*${term}*)`);
  }

  return supabaseRest<Profile[]>(`profiles?${params.toString()}`);
}

// ---------------------------------------------------------------------------
// Admin-only profile mutations + audit trail (service role)
//
// (These bypass RLS deliberately: authenticated users -- including admins --
// have no UPDATE privilege on role/wholesale_status/price_list_id columns.
// Callers MUST run requireAdmin() first; every route that reaches these is
// audited via insertAuditLog.)
// ---------------------------------------------------------------------------

/** The owner dropdown in the work queue. `selectCustomerProfiles` filters
 *  administrators OUT, so it cannot answer this. */
export async function selectAdminProfiles() {
  return supabaseRest<Profile[]>(
    "profiles?select=id,email,full_name,role&role=eq.admin&order=email.asc&limit=50"
  );
}

export async function selectProfileByIdService(userId: string) {
  const rows = await supabaseRest<Profile[]>(
    `profiles?select=*&id=eq.${encodeURIComponent(userId)}&limit=1`
  );

  return rows[0] ?? null;
}

export async function updateProfileWholesaleService(
  userId: string,
  fields: Partial<Pick<Profile, "role" | "wholesale_status" | "price_list_id" | "business_name" | "business_verified_at">>
) {
  const rows = await supabaseRest<Profile[]>(
    `profiles?id=eq.${encodeURIComponent(userId)}`,
    { method: "PATCH", body: JSON.stringify(fields) }
  );

  return rows[0] ?? null;
}

export async function updateCustomerSettingsService(
  userId: string,
  fields: CustomerSettingsFields
) {
  const rows = await supabaseRest<Profile[]>(
    `profiles?id=eq.${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(fields),
    }
  );

  return rows[0] ?? null;
}

export async function insertAuditLog(entry: {
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string;
  previous_data?: Record<string, unknown> | null;
  new_data?: Record<string, unknown> | null;
}) {
  await supabaseRest("audit_log", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      actor_id: entry.actor_id,
      action: entry.action,
      target_type: entry.target_type,
      target_id: entry.target_id,
      previous_data: entry.previous_data ?? null,
      new_data: entry.new_data ?? null,
    }),
  });
}

/** An order's audit events of the given kinds, oldest first. Service role. */
export async function selectOrderAuditEvents(orderId: string, actions: string[]) {
  if (actions.length === 0) return [];

  return supabaseRest<Pick<AuditLogRow, "action" | "new_data" | "created_at">[]>(
    `audit_log?select=action,new_data,created_at&target_type=eq.order&target_id=eq.${encodeURIComponent(
      orderId
    )}&action=in.(${actions.map(encodeURIComponent).join(",")})&order=created_at.asc`
  );
}

export async function selectAuditLog(limit: number, adminToken: string) {
  const { anonKey } = requireSupabaseConfig();
  const safeLimit = Math.min(Math.max(1, limit), 200);

  return supabaseRest<AuditLogRow[]>(
    `audit_log?select=*&order=created_at.desc&limit=${safeLimit}`,
    {},
    adminToken,
    anonKey
  );
}

// ---------------------------------------------------------------------------
// Atomic checkout (service role RPC)
//
// checkout_order() is EXECUTE-able only by service_role -- browsers cannot
// call it through PostgREST. The route handler authenticates the user and
// backend.ts recomputes every price from tiers before invoking this.
// ---------------------------------------------------------------------------

export type CheckoutLine = {
  product_id: number;
  quantity: number;
  unit_price: number;
  retail_unit_price: number;
  price_list_id: string | null;
  tier_id: string | null;
  tier_min_quantity: number | null;
};

export async function checkoutOrderRpc(payload: {
  user_id: string;
  shipping_name: string;
  shipping_phone: string;
  shipping_address: string;
  shipping_address_line1: string;
  shipping_address_line2: string | null;
  shipping_city: string;
  shipping_state: string;
  shipping_postal_code: string;
  shipping_country: string;
  payment_method: "cash_on_delivery" | "bank_transfer" | "mmqr";
  notes: string | null;
  lines: CheckoutLine[];
}) {
  return supabaseRest<{ order_id: string; total_amount: number }>(
    "rpc/checkout_order",
    {
      method: "POST",
      body: JSON.stringify({
        p_user_id: payload.user_id,
        p_shipping_name: payload.shipping_name,
        p_shipping_phone: payload.shipping_phone,
        p_shipping_address: payload.shipping_address,
        p_shipping_address_line1: payload.shipping_address_line1,
        p_shipping_address_line2: payload.shipping_address_line2,
        p_shipping_city: payload.shipping_city,
        p_shipping_state: payload.shipping_state,
        p_shipping_postal_code: payload.shipping_postal_code,
        p_shipping_country: payload.shipping_country,
        p_payment_method: payload.payment_method,
        p_notes: payload.notes,
        p_lines: payload.lines,
      }),
    }
  );
}

export async function requestOrderActionRpc(payload: {
  user_id: string;
  order_id: string;
  request_type: "cancellation" | "return";
  reason: string;
  reason_code: string | null;
  pickup_method: ReturnPickupMethod | null;
  pickup_address: string | null;
}) {
  return supabaseRest<{ ok: true }>(
    "rpc/request_order_action",
    {
      method: "POST",
      body: JSON.stringify({
        p_user_id: payload.user_id,
        p_order_id: payload.order_id,
        p_request_type: payload.request_type,
        p_reason: payload.reason,
        p_reason_code: payload.reason_code,
        p_pickup_method: payload.pickup_method,
        p_pickup_address: payload.pickup_address,
      }),
    }
  );
}

export async function resolveOrderActionRpc(payload: {
  actor_id: string;
  order_id: string;
  request_type: "cancellation" | "return";
  decision: "approve" | "reject";
  admin_note: string | null;
}) {
  return supabaseRest<{ ok: true }>(
    "rpc/resolve_order_action",
    {
      method: "POST",
      body: JSON.stringify({
        p_actor_id: payload.actor_id,
        p_order_id: payload.order_id,
        p_request_type: payload.request_type,
        p_decision: payload.decision,
        p_admin_note: payload.admin_note,
      }),
    }
  );
}

export async function adminCancelOrderRpc(payload: {
  actor_id: string;
  order_id: string;
  reason_code: string;
  reason: string;
  admin_note: string | null;
}) {
  return supabaseRest<{ ok: true }>(
    "rpc/admin_cancel_order",
    {
      method: "POST",
      body: JSON.stringify({
        p_actor_id: payload.actor_id,
        p_order_id: payload.order_id,
        p_reason_code: payload.reason_code,
        p_reason: payload.reason,
        p_admin_note: payload.admin_note,
      }),
    }
  );
}

export async function advanceReturnWorkflowRpc(payload: {
  actor_id: string;
  order_id: string;
  action: "schedule_pickup" | "mark_received" | "complete_refund";
  scheduled_for?: string | null;
  instructions?: string | null;
  tracking_number?: string | null;
  inspection_notes?: string | null;
  restock_approved?: boolean | null;
  refund_method?: RefundMethod | null;
  refund_reference?: string | null;
  refund_amount?: number | null;
  admin_note?: string | null;
}) {
  return supabaseRest<{ ok: true }>(
    "rpc/advance_return_workflow",
    {
      method: "POST",
      body: JSON.stringify({
        p_actor_id: payload.actor_id,
        p_order_id: payload.order_id,
        p_action: payload.action,
        p_scheduled_for: payload.scheduled_for ?? null,
        p_instructions: payload.instructions ?? null,
        p_tracking_number: payload.tracking_number ?? null,
        p_inspection_notes: payload.inspection_notes ?? null,
        p_restock_approved: payload.restock_approved ?? null,
        p_refund_method: payload.refund_method ?? null,
        p_refund_reference: payload.refund_reference ?? null,
        p_refund_amount: payload.refund_amount ?? null,
        p_admin_note: payload.admin_note ?? null,
      }),
    }
  );
}

// ---------------------------------------------------------------------------
// Private customer-to-admin support chat.
//
// These helpers deliberately use the server-only service role. Every caller
// must authenticate the request in backend.ts before selecting or mutating a
// conversation. Browser roles have no direct table privileges.
// ---------------------------------------------------------------------------

const supportConversationSelect =
  "*,profiles!support_conversations_customer_id_fkey(email,full_name,role)";

export async function selectSupportConversationByCustomer(customerId: string) {
  const rows = await supabaseRest<SupportConversationRow[]>(
    `support_conversations?select=${encodeURIComponent(
      supportConversationSelect
    )}&customer_id=eq.${encodeURIComponent(customerId)}&limit=1`
  );

  return rows[0] ?? null;
}

export async function selectSupportConversationById(conversationId: string) {
  const rows = await supabaseRest<SupportConversationRow[]>(
    `support_conversations?select=${encodeURIComponent(
      supportConversationSelect
    )}&id=eq.${encodeURIComponent(conversationId)}&limit=1`
  );

  return rows[0] ?? null;
}

export async function selectSupportConversations() {
  return supabaseRest<SupportConversationRow[]>(
    `support_conversations?select=${encodeURIComponent(
      supportConversationSelect
    )}&order=last_message_at.desc`
  );
}

export async function ensureSupportConversation(customerId: string) {
  const existing = await selectSupportConversationByCustomer(customerId);

  if (existing) return existing;

  await supabaseRest<SupportConversationRow[]>(
    "support_conversations?on_conflict=customer_id",
    {
      method: "POST",
      headers: {
        Prefer: "resolution=ignore-duplicates,return=representation",
      },
      body: JSON.stringify({ customer_id: customerId }),
    }
  );

  return selectSupportConversationByCustomer(customerId);
}

export async function selectSupportMessages(
  conversationId: string,
  limit = 200
) {
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 500);

  return supabaseRest<SupportMessageRow[]>(
    `support_messages?select=*&conversation_id=eq.${encodeURIComponent(
      conversationId
    )}&order=created_at.asc&limit=${safeLimit}`
  );
}

export async function insertSupportMessage(fields: {
  conversation_id: string;
  sender_id: string;
  sender_role: SupportSenderRole;
  body: string;
  attachment_path?: string | null;
  attachment_type?: string | null;
  product_id?: number | null;
}) {
  const rows = await supabaseRest<SupportMessageRow[]>("support_messages", {
    method: "POST",
    body: JSON.stringify(fields),
  });

  return rows[0] ?? null;
}

export async function updateSupportConversation(
  conversationId: string,
  fields: Partial<
    Pick<
      SupportConversationRow,
      | "assigned_admin_id"
      | "status"
      | "customer_last_read_at"
      | "admin_last_read_at"
    >
  >
) {
  const rows = await supabaseRest<SupportConversationRow[]>(
    `support_conversations?id=eq.${encodeURIComponent(conversationId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(fields),
    }
  );

  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Account-based recently viewed products.
// ---------------------------------------------------------------------------

export async function selectRecentlyViewedRows(userId: string, limit = 8) {
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 20);

  return supabaseRest<RecentlyViewedRow[]>(
    `recently_viewed_products?select=*&user_id=eq.${encodeURIComponent(
      userId
    )}&order=viewed_at.desc&limit=${safeLimit}`
  );
}

export async function upsertRecentlyViewedProduct(
  userId: string,
  productId: number
) {
  const rows = await supabaseRest<RecentlyViewedRow[]>(
    "recently_viewed_products?on_conflict=user_id,product_id",
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({
        user_id: userId,
        product_id: productId,
        viewed_at: new Date().toISOString(),
      }),
    }
  );

  return rows[0] ?? null;
}

export async function deleteRecentlyViewedRows(userId: string) {
  await supabaseRest(
    `recently_viewed_products?user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    }
  );
}

function throwCodError(error: unknown): never {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("COD_REVIEW_REQUIRED")) throw conflict("Complete the phone callback and address checks, then approve COD in COD & delivery details.");
    if (message.includes("COD_COURIER_REQUIRED")) throw conflict("Enter the courier and tracking/reference number before dispatch.");
    if (message.includes("COD_EVENT_STATUS")) throw conflict("Update the order status before adding this delivery event. Delivered events require a delivered order.");
    if (message.includes("COD_ORDER_CLOSED")) throw conflict("This order is closed.");
    if (message.includes("COD_OPEN_LIMIT")) throw conflict("You already have 3 pending COD orders. Please contact support or cancel an accidental duplicate first.");
    if (/schema cache|does not exist|could not find the function/i.test(message)) throw serviceUnavailable("Apply the COD/B2B migration in the supplied setup guide, then try again.");
    throw error;
}

async function codRpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  try {
    return await supabaseRest<T>(`rpc/${name}`, { method: "POST", body: JSON.stringify(body) });
  } catch (error) { return throwCodError(error); }
}

export function reviewOrderDeliveryRpc(actorId: string, orderId: string, input: object) {
  return codRpc("review_cod_delivery", { p_actor_id: actorId, p_order_id: orderId, p_input: input });
}

export function getCodReviewContext(actorId: string, orderId: string) {
  return codRpc("cod_review_context", { p_actor_id: actorId, p_order_id: orderId });
}

export function syncSheetWholesale(rows: { source_key: string; unit_price: number | null; min_quantity: number | null }[]) {
  return codRpc<{ synced: number; price_list_id: string }>("sync_sheet_b2b", { p_rows: rows });
}
