import type { Product, ProductType, UserRole } from "../data/products";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  phone: string | null;
  created_at?: string;
  updated_at?: string;
};

export type CurrentUser = {
  id: string;
  email: string;
  role: UserRole;
  profile: Profile;
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
  specs: Product["specs"];
  full_specs: Product["fullSpecs"];
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
  token = requireSupabaseConfig({ requireServiceRole: true }).serviceRoleKey
) {
  const { url } = requireSupabaseConfig();
  const headers = new Headers(init.headers);

  headers.set("apikey", token);
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

  const data = await supabaseAuth<AuthUserResponse>(
    "user",
    {
      method: "GET",
    },
    token,
    anonKey
  );

  const user = data.user ?? (data.id ? { id: data.id, email: data.email } : null);

  if (!user) {
    throw new Error("Unauthorized");
  }

  return { user };
}

export async function getProfile(userId: string) {
  const rows = await supabaseRest<Profile[]>(
    `profiles?select=*&id=eq.${encodeURIComponent(userId)}&limit=1`
  );

  return rows[0] ?? null;
}

export async function getProfileByEmail(email: string) {
  const rows = await supabaseRest<Profile[]>(
    `profiles?select=*&email=eq.${encodeURIComponent(email)}&limit=1`
  );

  return rows[0] ?? null;
}

export async function requireUserFromRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    throw new Error("Unauthorized");
  }

  const { user } = await getAuthUser(token);
  const profile = await getProfile(user.id);

  if (!profile) {
    throw new Error("Profile not found.");
  }

  return {
    id: user.id,
    email: profile.email ?? user.email ?? "",
    role: profile.role,
    profile,
  } satisfies CurrentUser;
}

export function requireAdmin(user: CurrentUser) {
  if (user.role !== "admin") {
    throw new Error("Forbidden");
  }
}

export async function selectProducts(filters: {
  search?: string | null;
  type?: string | null;
  category?: string | null;
  stock?: string | null;
} = {}) {
  const params = new URLSearchParams({
    select: "*",
    order: "id.asc",
  });

  if (filters.type) params.set("type", `eq.${filters.type}`);
  if (filters.category) params.set("category", `eq.${filters.category}`);
  if (filters.stock) params.set("stock", `eq.${filters.stock}`);

  const { anonKey } = requireSupabaseConfig();
  const rows = await supabaseRest<ProductRow[]>(
    `products?${params.toString()}`,
    {},
    anonKey
  );
  const search = filters.search?.trim().toLowerCase();

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

export async function insertProduct(product: Partial<Product>) {
  const rows = await supabaseRest<ProductRow[]>("products", {
    method: "POST",
    body: JSON.stringify(mapProductToRow(product)),
  });

  return rows[0];
}

export async function upsertProducts(products: Partial<Product>[]) {
  return supabaseRest<ProductRow[]>("products", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(products.map(mapProductToRow)),
  });
}

export async function updateProduct(id: number, product: Partial<Product>) {
  const rows = await supabaseRest<ProductRow[]>(`products?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify(mapProductToRow(product)),
  });

  return rows[0] ?? null;
}

export async function deleteProduct(id: number) {
  await supabaseRest(`products?id=eq.${id}`, {
    method: "DELETE",
  });
}

export async function selectCart(userId: string) {
  return supabaseRest<CartItemRow[]>(
    `cart_items?select=*,products(*)&user_id=eq.${encodeURIComponent(
      userId
    )}&order=created_at.asc`
  );
}

export async function upsertCartItem(
  userId: string,
  productId: number,
  quantity: number
) {
  const rows = await supabaseRest<CartItemRow[]>("cart_items", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      user_id: userId,
      product_id: productId,
      quantity,
    }),
  });

  return rows[0];
}

export async function updateCartItem(userId: string, id: string, quantity: number) {
  const rows = await supabaseRest<CartItemRow[]>(
    `cart_items?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ quantity }),
    }
  );

  return rows[0] ?? null;
}

export async function deleteCartItem(userId: string, id: string) {
  await supabaseRest(
    `cart_items?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: "DELETE",
    }
  );
}

export async function clearCart(userId: string) {
  await supabaseRest(`cart_items?user_id=eq.${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
}

export async function selectWishlist(userId: string) {
  return supabaseRest<WishlistItemRow[]>(
    `wishlist_items?select=*,products(*)&user_id=eq.${encodeURIComponent(
      userId
    )}&order=created_at.asc`
  );
}

export async function insertWishlistItem(userId: string, productId: number) {
  const rows = await supabaseRest<WishlistItemRow[]>("wishlist_items", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      product_id: productId,
    }),
  });

  return rows[0];
}

export async function deleteWishlistItem(userId: string, id: string) {
  await supabaseRest(
    `wishlist_items?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: "DELETE",
    }
  );
}

export function orderSelect() {
  return "*,profiles(email,full_name,role),order_items(*,products(*))";
}

export async function selectOrders(user: CurrentUser) {
  const ownerFilter =
    user.role === "admin" ? "" : `&user_id=eq.${encodeURIComponent(user.id)}`;

  return supabaseRest<OrderRow[]>(
    `orders?select=${orderSelect()}${ownerFilter}&order=created_at.desc`
  );
}

export async function selectOrderById(user: CurrentUser, id: string) {
  const ownerFilter =
    user.role === "admin" ? "" : `&user_id=eq.${encodeURIComponent(user.id)}`;
  const rows = await supabaseRest<OrderRow[]>(
    `orders?select=${orderSelect()}&id=eq.${encodeURIComponent(id)}${ownerFilter}&limit=1`
  );

  return rows[0] ?? null;
}

export async function insertOrder(
  order: Omit<OrderRow, "created_at" | "updated_at" | "order_items" | "profiles">
) {
  const rows = await supabaseRest<OrderRow[]>("orders", {
    method: "POST",
    body: JSON.stringify(order),
  });

  return rows[0];
}

export async function insertOrderItems(
  items: Omit<OrderItemRow, "id" | "products">[]
) {
  return supabaseRest<OrderItemRow[]>("order_items", {
    method: "POST",
    body: JSON.stringify(items),
  });
}

export async function updateOrderStatus(id: string, status: OrderRow["status"]) {
  const rows = await supabaseRest<OrderRow[]>(`orders?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

  return rows[0] ?? null;
}
