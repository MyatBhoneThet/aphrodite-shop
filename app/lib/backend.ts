import type { Product, UserRole } from "../data/products";
import {
  clearCart,
  countCustomers,
  countOrders,
  countProducts,
  deleteCartItem,
  deleteProduct,
  deleteWishlistItem,
  insertOrder,
  insertOrderItems,
  insertProduct,
  insertWishlistItem,
  mapProductRow,
  requireAdmin,
  requireUserFromRequest,
  selectCart,
  selectOrderById,
  selectOrderItemStats,
  selectOrderStats,
  selectOrders,
  selectProductById,
  selectProducts,
  selectWishlist,
  updateCartItem,
  updateOrderStatus,
  updateProduct,
  upsertCartItem,
  type CartItemRow,
  type CurrentUser,
  type OrderRow,
  type ProductRow,
  type WishlistItemRow,
} from "./supabase";
import { badRequest, conflict, notFound } from "./errors";

export type { CurrentUser } from "./supabase";

export type CartLine = {
  id?: string;
  product: Product;
  product_id: number;
  quantity: number;
  lineTotal: number;
};

export type CartSummary = {
  items: CartLine[];
  subtotal: number;
  total: number;
  totalQuantity: number;
};

export function priceForRole(product: Product, role: UserRole) {
  return role === "wholesale" && product.wholesalePrice
    ? product.wholesalePrice
    : product.price;
}

function cleanQuantity(quantity: unknown) {
  const value = Number(quantity ?? 1);
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
}

function cartResponse(rows: CartItemRow[], role: UserRole): CartSummary {
  const items = rows.flatMap((row) => {
    if (!row.products) return [];

    const product = mapProductRow(row.products);
    const lineTotal = priceForRole(product, role) * row.quantity;

    return [
      {
        id: row.id,
        product,
        product_id: row.product_id,
        quantity: row.quantity,
        lineTotal,
      },
    ];
  });

  const total = items.reduce((sum, item) => sum + item.lineTotal, 0);

  return {
    items,
    subtotal: total,
    total,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
  };
}

function wishlistResponse(rows: WishlistItemRow[]) {
  return rows.flatMap((row) =>
    row.products
      ? [
          {
            id: row.id,
            product_id: row.product_id,
            product: mapProductRow(row.products),
            created_at: row.created_at,
          },
        ]
      : []
  );
}

function orderResponse(order: OrderRow) {
  return {
    ...order,
    order_items: order.order_items?.map((item) => ({
      ...item,
      product: item.products ? mapProductRow(item.products) : null,
    })),
  };
}

export async function authenticate(request: Request) {
  return requireUserFromRequest(request);
}

export async function getProducts(filters: {
  search?: string | null;
  query?: string | null;
  type?: string | null;
  category?: string | null;
  stock?: string | null;
  inStock?: boolean;
  limit?: number | null;
  offset?: number | null;
} = {}) {
  const normalized = {
    search: filters.search ?? filters.query,
    type: filters.type,
    category: filters.category,
    stock: filters.stock ?? (filters.inStock ? "In Stock" : null),
    limit: filters.limit,
    offset: filters.offset,
  };

  const rows = await selectProducts(normalized);
  return rows.map(mapProductRow);
}

export async function getProductById(id: number) {
  const row = await selectProductById(id);
  return row ? mapProductRow(row) : null;
}

export async function getRelatedProducts(product: Product) {
  return (await getProducts({ type: product.type }))
    .filter((item) => item.id !== product.id)
    .slice(0, 3);
}

export async function createProduct(user: CurrentUser, product: Partial<Product>) {
  requireAdmin(user);
  const row = await insertProduct(product, user.accessToken);
  return mapProductRow(row);
}

export async function patchProduct(
  user: CurrentUser,
  id: number,
  product: Partial<Product>
) {
  requireAdmin(user);
  const row = await updateProduct(id, product, user.accessToken);
  return row ? mapProductRow(row) : null;
}

export async function removeProduct(user: CurrentUser, id: number) {
  requireAdmin(user);
  await deleteProduct(id, user.accessToken);
}

export async function getCart(user: CurrentUser) {
  return cartResponse(await selectCart(user.id, user.accessToken), user.role);
}

export async function addCartItem(
  user: CurrentUser,
  productId: number,
  quantity: unknown = 1
) {
  if (!Number.isFinite(productId) || productId <= 0) {
    throw badRequest("Invalid product.");
  }

  const productRow = await selectProductById(productId);

  if (!productRow) {
    throw notFound("Product not found.");
  }

  if (productRow.stock === "Out of Stock") {
    throw badRequest("This product is currently out of stock.");
  }

  const rows = await selectCart(user.id, user.accessToken);
  const existingQuantity =
    rows.find((row) => row.product_id === productId)?.quantity ?? 0;

  await upsertCartItem(
    user.id,
    productId,
    existingQuantity + cleanQuantity(quantity),
    user.accessToken
  );

  return getCart(user);
}

export async function changeCartItem(
  user: CurrentUser,
  id: string,
  quantity: unknown
) {
  await updateCartItem(user.id, id, cleanQuantity(quantity), user.accessToken);
  return getCart(user);
}

export async function removeCartItem(user: CurrentUser, id: string) {
  await deleteCartItem(user.id, id, user.accessToken);
  return getCart(user);
}

export async function clearUserCart(user: CurrentUser) {
  await clearCart(user.id, user.accessToken);
  return getCart(user);
}

export async function getWishlist(user: CurrentUser) {
  return wishlistResponse(await selectWishlist(user.id, user.accessToken));
}

export async function addWishlistItem(user: CurrentUser, productId: number) {
  if (!Number.isFinite(productId) || productId <= 0) {
    throw badRequest("Invalid product.");
  }

  const product = await selectProductById(productId);

  if (!product) {
    throw notFound("Product not found.");
  }

  const rows = await selectWishlist(user.id, user.accessToken);
  const alreadyWishlisted = rows.some((row) => row.product_id === productId);

  if (alreadyWishlisted) {
    throw conflict("Already wishlisted.");
  }

  await insertWishlistItem(user.id, productId, user.accessToken);
  return getWishlist(user);
}

export async function removeWishlistItem(user: CurrentUser, id: string) {
  await deleteWishlistItem(user.id, id, user.accessToken);
  return getWishlist(user);
}

export async function getOrders(
  user: CurrentUser,
  pagination: { limit?: number | null; offset?: number | null } = {}
) {
  return (await selectOrders(user, pagination)).map(orderResponse);
}

export async function getOrder(user: CurrentUser, id: string) {
  const order = await selectOrderById(user, id);
  return order ? orderResponse(order) : null;
}

export async function createOrder(
  user: CurrentUser,
  body: {
    shipping_name?: string;
    shipping_phone?: string;
    shipping_address?: string;
    notes?: string | null;
  }
) {
  if (!body.shipping_name || !body.shipping_phone || !body.shipping_address) {
    throw badRequest("Shipping name, phone, and address are required.");
  }

  const cart = await selectCart(user.id, user.accessToken);

  if (cart.length === 0) {
    throw badRequest("Cart is empty.");
  }

  const lines = cart.map((item) => {
    if (!item.products) {
      throw badRequest("Cart contains an unavailable product.");
    }

    if (item.products.stock === "Out of Stock") {
      throw badRequest(`${item.products.name} is currently out of stock.`);
    }

    const product = mapProductRow(item.products as ProductRow);
    const unitPrice = priceForRole(product, user.role);

    return {
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: unitPrice,
      lineTotal: unitPrice * item.quantity,
    };
  });

  const orderId = crypto.randomUUID();
  const totalAmount = lines.reduce((sum, item) => sum + item.lineTotal, 0);

  const order = await insertOrder(
    {
      id: orderId,
      user_id: user.id,
      status: "pending",
      total_amount: totalAmount,
      shipping_name: body.shipping_name,
      shipping_phone: body.shipping_phone,
      shipping_address: body.shipping_address,
      notes: body.notes ?? null,
    },
    user.accessToken
  );

  await insertOrderItems(
    lines.map((item) => ({
      order_id: orderId,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
    })),
    user.accessToken
  );
  await clearCart(user.id, user.accessToken);

  return orderResponse({ ...order, order_items: [] });
}

export async function patchOrderStatus(
  user: CurrentUser,
  id: string,
  status: OrderRow["status"]
) {
  requireAdmin(user);
  const order = await updateOrderStatus(id, status, user.accessToken);
  return order ? orderResponse(order) : null;
}

const ORDER_STATUSES: OrderRow["status"][] = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
];

export type AdminStats = {
  products: { total: number; inStock: number; outOfStock: number };
  customers: { total: number };
  orders: { total: number; pending: number };
  revenue: { total: number };
  monthlySales: { label: string; value: number }[];
  ordersByStatus: { status: OrderRow["status"]; count: number; value: number }[];
  topProducts: {
    productId: number;
    name: string;
    image: string | null;
    quantitySold: number;
  }[];
  recentOrders: ReturnType<typeof orderResponse>[];
};

export async function getAdminStats(user: CurrentUser): Promise<AdminStats> {
  requireAdmin(user);

  const [
    totalProducts,
    inStockProducts,
    outOfStockProducts,
    totalCustomers,
    totalOrders,
    pendingOrders,
    orderStats,
    orderItemStats,
    recentOrdersRaw,
  ] = await Promise.all([
    countProducts(),
    countProducts("In Stock"),
    countProducts("Out of Stock"),
    countCustomers(user.accessToken),
    countOrders(user.accessToken),
    countOrders(user.accessToken, "pending"),
    selectOrderStats(user.accessToken),
    selectOrderItemStats(user.accessToken),
    selectOrders(user, { limit: 5 }),
  ]);

  const activeOrders = orderStats.filter((order) => order.status !== "cancelled");
  const totalRevenue = activeOrders.reduce(
    (sum, order) => sum + Number(order.total_amount || 0),
    0
  );

  const now = new Date();
  const monthlySales = Array.from({ length: 6 }).map((_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    const value = activeOrders
      .filter((order) => {
        const created = new Date(order.created_at);
        return (
          created.getMonth() === date.getMonth() &&
          created.getFullYear() === date.getFullYear()
        );
      })
      .reduce((sum, order) => sum + Number(order.total_amount || 0), 0);

    return {
      label: `${date.toLocaleDateString("en-US", { month: "short" })} ${String(
        date.getFullYear()
      ).slice(2)}`,
      value,
    };
  });

  const ordersByStatus = ORDER_STATUSES.map((status) => {
    const matching = orderStats.filter((order) => order.status === status);

    return {
      status,
      count: matching.length,
      value: matching.reduce((sum, order) => sum + Number(order.total_amount || 0), 0),
    };
  });

  const productSales = new Map<
    number,
    { name: string; image: string | null; quantitySold: number }
  >();

  for (const item of orderItemStats) {
    const existing = productSales.get(item.product_id);
    const name = item.products?.name ?? `Product #${item.product_id}`;
    const image = item.products?.image ?? null;

    if (existing) {
      existing.quantitySold += item.quantity;
    } else {
      productSales.set(item.product_id, { name, image, quantitySold: item.quantity });
    }
  }

  const topProducts = Array.from(productSales.entries())
    .map(([productId, data]) => ({ productId, ...data }))
    .sort((a, b) => b.quantitySold - a.quantitySold)
    .slice(0, 5);

  return {
    products: {
      total: totalProducts,
      inStock: inStockProducts,
      outOfStock: outOfStockProducts,
    },
    customers: { total: totalCustomers },
    orders: { total: totalOrders, pending: pendingOrders },
    revenue: { total: totalRevenue },
    monthlySales,
    ordersByStatus,
    topProducts,
    recentOrders: recentOrdersRaw.map(orderResponse),
  };
}
