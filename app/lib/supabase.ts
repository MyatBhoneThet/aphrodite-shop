import type { Product, ProductType, UserRole } from "../data/products";
import type { PriceTierRow } from "./pricing";
import { ADMIN_SESSION_COOKIE, parseCookieHeader } from "./admin-session";
import { USER_SESSION_COOKIE } from "./user-session";
import { forbidden, notFound, unauthorized } from "./errors";

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
  payment_method: "cash_on_delivery";
  payment_status: "unpaid" | "collected" | "refunded";
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
  admin_order_note: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  order_items?: OrderItemRow[];
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

  return (await response.json()) as T;
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
// intentionally keeps using the service_role key (see ADMIN_SETUP.md / the
// admin `requireAdmin()` gate in the route handler for the actual auth check).
type ProductionStockRow = {
  source_key: string;
  stock_quantity: number | null;
  sheet_stock_quantity: number | null;
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
export function reconcileStockQuantity(
  sheetQuantity: number,
  current: Pick<ProductionStockRow, "stock_quantity" | "sheet_stock_quantity"> | undefined
) {
  if (!current) return sheetQuantity;

  const lastSheetQuantity = current.sheet_stock_quantity ?? sheetQuantity;
  const storefrontQuantity = current.stock_quantity ?? 0;

  return Math.max(0, storefrontQuantity + (sheetQuantity - lastSheetQuantity));
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
          `products?select=source_key,stock_quantity,sheet_stock_quantity&source_key=in.(${encodeURIComponent(
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
 * Reconciles workbook inventory with storefront inventory.
 *
 * The workbook is authoritative for restocks, but it is not the only writer:
 * checkout deducts stock_quantity immediately and only tells the workbook on a
 * best-effort basis. Overwriting stock_quantity with the workbook's absolute
 * number therefore resurrects sold units whenever write-back has not landed.
 * Instead, apply the workbook's change since the previous sync.
 */
export async function upsertProductionProducts(
  products: (ProductWrite & { sourceKey: string; sourceSheet: string })[]
) {
  if (products.length === 0) return [];

  const existing = await selectProductionStock(
    products.map((product) => product.sourceKey)
  );

  const rows = products.map((product) => {
    const row = mapProductionProductToRow(product);
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

export function orderSelect() {
  return `*,profiles(email,full_name,role),order_items(*,products(${PUBLIC_PRODUCT_COLUMNS}))`;
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

  return supabaseRest<OrderRow[]>(
    `orders?select=${orderSelect()}${ownerFilter}&order=created_at.desc&limit=${limit}&offset=${offset}`,
    {},
    user.accessToken,
    anonKey
  );
}

export async function selectOrderById(user: CurrentUser, id: string) {
  const { anonKey } = requireSupabaseConfig();
  const ownerFilter =
    user.role === "admin" ? "" : `&user_id=eq.${encodeURIComponent(user.id)}`;
  const rows = await supabaseRest<OrderRow[]>(
    `orders?select=${orderSelect()}&id=eq.${encodeURIComponent(id)}${ownerFilter}&limit=1`,
    {},
    user.accessToken,
    anonKey
  );

  return rows[0] ?? null;
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
    select: "id,email,full_name,role,wholesale_status,price_list_id,created_at",
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

export async function selectProfileByIdService(userId: string) {
  const rows = await supabaseRest<Profile[]>(
    `profiles?select=*&id=eq.${encodeURIComponent(userId)}&limit=1`
  );

  return rows[0] ?? null;
}

export async function updateProfileWholesaleService(
  userId: string,
  fields: Partial<Pick<Profile, "role" | "wholesale_status" | "price_list_id">>
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
  payment_method: "cash_on_delivery";
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
