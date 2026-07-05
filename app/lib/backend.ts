import type { Product, UserRole } from "../data/products";
import {
  clearCart,
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
} = {}) {
  const normalized = {
    search: filters.search ?? filters.query,
    type: filters.type,
    category: filters.category,
    stock: filters.stock ?? (filters.inStock ? "In Stock" : null),
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
  const row = await insertProduct(product);
  return mapProductRow(row);
}

export async function patchProduct(
  user: CurrentUser,
  id: number,
  product: Partial<Product>
) {
  requireAdmin(user);
  const row = await updateProduct(id, product);
  return row ? mapProductRow(row) : null;
}

export async function removeProduct(user: CurrentUser, id: number) {
  requireAdmin(user);
  await deleteProduct(id);
}

export async function getCart(user: CurrentUser) {
  return cartResponse(await selectCart(user.id), user.role);
}

export async function addCartItem(
  user: CurrentUser,
  productId: number,
  quantity: unknown = 1
) {
  const productRow = await selectProductById(productId);

  if (!productRow) {
    throw new Error("Product not found.");
  }

  if (productRow.stock === "Out of Stock") {
    throw new Error("This product is currently out of stock.");
  }

  const rows = await selectCart(user.id);
  const existingQuantity =
    rows.find((row) => row.product_id === productId)?.quantity ?? 0;

  await upsertCartItem(
    user.id,
    productId,
    existingQuantity + cleanQuantity(quantity)
  );

  return getCart(user);
}

export async function changeCartItem(
  user: CurrentUser,
  id: string,
  quantity: unknown
) {
  await updateCartItem(user.id, id, cleanQuantity(quantity));
  return getCart(user);
}

export async function removeCartItem(user: CurrentUser, id: string) {
  await deleteCartItem(user.id, id);
  return getCart(user);
}

export async function clearUserCart(user: CurrentUser) {
  await clearCart(user.id);
  return getCart(user);
}

export async function getWishlist(user: CurrentUser) {
  return wishlistResponse(await selectWishlist(user.id));
}

export async function addWishlistItem(user: CurrentUser, productId: number) {
  const product = await selectProductById(productId);

  if (!product) {
    throw new Error("Product not found.");
  }

  const rows = await selectWishlist(user.id);
  const alreadyWishlisted = rows.some((row) => row.product_id === productId);

  if (alreadyWishlisted) {
    throw new Error("Already wishlisted.");
  }

  await insertWishlistItem(user.id, productId);
  return getWishlist(user);
}

export async function removeWishlistItem(user: CurrentUser, id: string) {
  await deleteWishlistItem(user.id, id);
  return getWishlist(user);
}

export async function getOrders(user: CurrentUser) {
  return (await selectOrders(user)).map(orderResponse);
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
    throw new Error("Shipping name, phone, and address are required.");
  }

  const cart = await selectCart(user.id);

  if (cart.length === 0) {
    throw new Error("Cart is empty.");
  }

  const lines = cart.map((item) => {
    if (!item.products) {
      throw new Error("Cart contains an unavailable product.");
    }

    if (item.products.stock === "Out of Stock") {
      throw new Error(`${item.products.name} is currently out of stock.`);
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

  const order = await insertOrder({
    id: orderId,
    user_id: user.id,
    status: "pending",
    total_amount: totalAmount,
    shipping_name: body.shipping_name,
    shipping_phone: body.shipping_phone,
    shipping_address: body.shipping_address,
    notes: body.notes ?? null,
  });

  await insertOrderItems(
    lines.map((item) => ({
      order_id: orderId,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
    }))
  );
  await clearCart(user.id);

  return orderResponse({ ...order, order_items: [] });
}

export async function patchOrderStatus(
  user: CurrentUser,
  id: string,
  status: OrderRow["status"]
) {
  requireAdmin(user);
  const order = await updateOrderStatus(id, status);
  return order ? orderResponse(order) : null;
}
