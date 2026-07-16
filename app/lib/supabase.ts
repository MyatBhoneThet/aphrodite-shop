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
  name: string;
  type: ProductType;
  category: string;
  brand: string;
  price: number;
  wholesale_price: number | null;
  image: string;
  model_3d: string | null;
  stock: "In Stock" | "Out of Stock";
  stock_quantity: number;
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

export type OrderRow = {
  id: string;
  user_id: string;
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  total_amount: number;
  shipping_name: string;
  shipping_phone: string;
  shipping_address: string;
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

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && anonKey);
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

export function mapProductToRow(product: Partial<Product>) {
  return {
    id: product.id ?? null,
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

export async function registerUser({
  email,
  password,
  fullName,
  role,
}: {
  email: string;
  password: string;
  fullName?: string;
  role?: UserRole;
}) {
  const data = await supabaseAuth<AuthUserResponse>("admin/users", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      raw_user_meta_data: {
        full_name: fullName ?? null,
        role: role ?? "normal",
      },
      user_metadata: {
        full_name: fullName ?? null,
        role: role ?? "normal",
      },
    }),
  });

  const user = data.user ?? (data.id ? { id: data.id, email: data.email } : null);

  if (!user) {
    throw new Error("Supabase did not return a created user.");
  }

  return user;
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
export async function countCustomers(accessToken: string) {
  const { anonKey } = requireSupabaseConfig();
  return supabaseCount(
    `profiles?select=id&role=neq.admin`,
    accessToken,
    anonKey
  );
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

export async function selectProducts(filters: {
  search?: string | null;
  type?: string | null;
  category?: string | null;
  stock?: string | null;
  limit?: number | null;
  offset?: number | null;
} = {}) {
  const params = new URLSearchParams({
    select: "*",
    order: "id.asc",
  });

  if (filters.type) params.set("type", `eq.${filters.type}`);
  if (filters.category) params.set("category", `eq.${filters.category}`);
  if (filters.stock) params.set("stock", `eq.${filters.stock}`);

  const search = filters.search?.trim().toLowerCase();

  // Search still filters client-side (post-fetch), so it can't be combined
  // with server-side limit/offset without returning incomplete results --
  // a search request fetches the full filtered set, same as before. Browsing
  // without a search term is the common case and the one that needs the cap,
  // so that path is paginated.
  if (!search) {
    const limit = Math.min(
      Math.max(1, filters.limit ?? DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE
    );
    const offset = Math.max(0, filters.offset ?? 0);

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

export async function selectProductById(id: number) {
  const { anonKey } = requireSupabaseConfig();
  const rows = await supabaseRest<ProductRow[]>(
    `products?select=*&id=eq.${id}&limit=1`,
    {},
    anonKey
  );

  return rows[0] ?? null;
}

export async function countProducts(stock?: "In Stock" | "Out of Stock") {
  const { anonKey } = requireSupabaseConfig();
  const params = new URLSearchParams({ select: "id" });

  if (stock) params.set("stock", `eq.${stock}`);

  return supabaseCount(`products?${params.toString()}`, anonKey);
}

export async function insertProduct(product: Partial<Product>, accessToken: string) {
  const { anonKey } = requireSupabaseConfig();
  const rows = await supabaseRest<ProductRow[]>(
    "products",
    {
      method: "POST",
      body: JSON.stringify(mapProductToRow(product)),
    },
    accessToken,
    anonKey
  );

  return rows[0];
}

// Bulk sync from the Google Sheet is a service-level job, not a single
// admin's own write, and merge-duplicates across many rows is not something
// the per-row RLS policies are designed to authorize efficiently -- this one
// intentionally keeps using the service_role key (see ADMIN_SETUP.md / the
// admin `requireAdmin()` gate in the route handler for the actual auth check).
export async function upsertProducts(products: Partial<Product>[]) {
  return supabaseRest<ProductRow[]>("products", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(products.map(mapProductToRow)),
  });
}

export async function updateProduct(
  id: number,
  product: Partial<Product>,
  accessToken: string
) {
  const { anonKey } = requireSupabaseConfig();
  const rows = await supabaseRest<ProductRow[]>(
    `products?id=eq.${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(mapProductToRow(product)),
    },
    accessToken,
    anonKey
  );

  return rows[0] ?? null;
}

export async function deleteProduct(id: number, accessToken: string) {
  const { anonKey } = requireSupabaseConfig();
  await supabaseRest(
    `products?id=eq.${id}`,
    { method: "DELETE" },
    accessToken,
    anonKey
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
    `cart_items?select=*,products(*)&user_id=eq.${encodeURIComponent(
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
    `wishlist_items?select=*,products(*)&user_id=eq.${encodeURIComponent(
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
  return "*,profiles(email,full_name,role),order_items(*,products(*))";
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
  const limit = Math.min(
    Math.max(1, pagination.limit ?? DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE
  );
  const offset = Math.max(0, pagination.offset ?? 0);

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

export async function insertOrder(
  order: Omit<OrderRow, "created_at" | "updated_at" | "order_items" | "profiles">,
  accessToken: string
) {
  const { anonKey } = requireSupabaseConfig();
  const rows = await supabaseRest<OrderRow[]>(
    "orders",
    {
      method: "POST",
      body: JSON.stringify(order),
    },
    accessToken,
    anonKey
  );

  return rows[0];
}

export async function insertOrderItems(
  items: Omit<OrderItemRow, "id" | "products">[],
  accessToken: string
) {
  const { anonKey } = requireSupabaseConfig();
  return supabaseRest<OrderItemRow[]>(
    "order_items",
    {
      method: "POST",
      body: JSON.stringify(items),
    },
    accessToken,
    anonKey
  );
}

export async function updateOrderStatus(
  id: string,
  status: OrderRow["status"],
  accessToken: string
) {
  const { anonKey } = requireSupabaseConfig();
  const rows = await supabaseRest<OrderRow[]>(
    `orders?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
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
        p_notes: payload.notes,
        p_lines: payload.lines,
      }),
    }
  );
}
