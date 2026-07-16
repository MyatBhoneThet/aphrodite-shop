import type { Product } from "../data/products";
import {
  checkoutOrderRpc,
  clearCart,
  countCustomers,
  countOrders,
  countProducts,
  deleteCartItem,
  deleteProduct,
  deleteTier,
  deleteWishlistItem,
  insertAuditLog,
  insertPriceList,
  insertProduct,
  insertTier,
  insertWishlistItem,
  mapProductRow,
  requireAdmin,
  requireUserFromRequest,
  selectAuditLog,
  selectCart,
  selectOrderById,
  selectOrderItemStats,
  selectOrderStats,
  selectOrders,
  selectCustomerProfiles,
  selectPriceListById,
  selectPriceLists,
  selectProductById,
  selectProducts,
  selectProfileByIdService,
  selectTiersAdmin,
  selectTiersForProducts,
  selectWishlist,
  updateCartItem,
  updateOrderStatus,
  updatePriceList,
  updateProduct,
  updateProfileWholesaleService,
  updateTier,
  upsertCartItem,
  type CartItemRow,
  type CurrentUser,
  type OrderRow,
  type PriceListRow,
  type PriceTierRow,
  type ProductRow,
  type WishlistItemRow,
} from "./supabase";
import {
  isTierEffective,
  isWholesaleApproved,
  priceLine,
  type PricingResult,
} from "./pricing";
import { badRequest, conflict, forbidden, notFound } from "./errors";

export type { CurrentUser } from "./supabase";

export type CartLine = {
  id?: string;
  product: PublicProduct;
  product_id: number;
  quantity: number;
  lineTotal: number;
  pricing: PricingResult;
};

export type CartSummary = {
  items: CartLine[];
  subtotal: number;
  total: number;
  totalQuantity: number;
  retailSubtotal: number;
  totalSavings: number;
  wholesale: boolean;
};

function cleanQuantity(quantity: unknown) {
  const value = Number(quantity ?? 1);
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
}

// Numeric inventory is authoritative. The legacy text is only consulted when
// a row predates the stock_quantity migration (column missing/null), so the
// app degrades safely instead of treating everything as sellable.
function availableStock(row: Pick<ProductRow, "stock" | "stock_quantity">) {
  return (
    row.stock_quantity ??
    (row.stock === "Out of Stock" ? 0 : Number.POSITIVE_INFINITY)
  );
}

// ---------------------------------------------------------------------------
// Product DTOs -- what each viewer is allowed to see.
//
// The legacy wholesale_price and the exact inventory count are admin-only;
// public/API responses never include them. Wholesale customers receive the
// tiers of THEIR assigned price list as a separate field.
// ---------------------------------------------------------------------------

export type PublicTier = { minQuantity: number; unitPrice: number };

export type PublicProduct = Omit<Product, "wholesalePrice" | "stockQuantity"> & {
  wholesalePrice?: number;
  stockQuantity?: number;
  tiers?: PublicTier[];
};

export function productDTO(
  product: Product,
  viewer: CurrentUser | null,
  tiers?: PriceTierRow[]
): PublicProduct {
  const { wholesalePrice, stockQuantity, ...publicFields } = product;

  if (viewer?.role === "admin") {
    return { ...publicFields, wholesalePrice, stockQuantity };
  }

  const now = new Date();
  const visibleTiers = (tiers ?? [])
    .filter((tier) => isTierEffective(tier, now))
    .sort((a, b) => a.min_quantity - b.min_quantity)
    .map((tier) => ({ minQuantity: tier.min_quantity, unitPrice: tier.unit_price }));

  return visibleTiers.length > 0
    ? { ...publicFields, tiers: visibleTiers }
    : publicFields;
}

// ---------------------------------------------------------------------------
// Wholesale pricing context -- the ONLY place entitlement is derived.
// Profile data comes from requireUserFromRequest (a fresh DB read per
// request), never from anything the browser claims.
// ---------------------------------------------------------------------------

export type WholesaleContext = {
  priceList: PriceListRow;
  tiersByProduct: Map<number, PriceTierRow[]>;
};

export async function wholesaleContext(
  user: CurrentUser | null,
  productIds: number[]
): Promise<WholesaleContext | null> {
  if (!user || !isWholesaleApproved(user.profile)) return null;

  const priceList = await selectPriceListById(
    user.profile.price_list_id as string,
    user.accessToken
  );

  if (!priceList || !priceList.is_active) return null;

  const tiersByProduct = new Map<number, PriceTierRow[]>();

  if (productIds.length > 0) {
    const tiers = await selectTiersForProducts(
      priceList.id,
      productIds,
      user.accessToken
    );

    for (const tier of tiers) {
      const list = tiersByProduct.get(tier.product_id) ?? [];
      list.push(tier);
      tiersByProduct.set(tier.product_id, list);
    }
  }

  return { priceList, tiersByProduct };
}

function cartResponse(
  rows: CartItemRow[],
  user: CurrentUser,
  context: WholesaleContext | null
): CartSummary {
  const items = rows.flatMap((row) => {
    if (!row.products) return [];

    const product = mapProductRow(row.products);
    const tiers = context?.tiersByProduct.get(product.id) ?? [];
    const pricing = priceLine({
      retailPrice: product.price,
      quantity: row.quantity,
      tiers,
    });

    return [
      {
        id: row.id,
        product: productDTO(product, user.role === "admin" ? user : null, tiers),
        product_id: row.product_id,
        quantity: row.quantity,
        lineTotal: pricing.lineTotal,
        pricing,
      },
    ];
  });

  const total = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const retailSubtotal = items.reduce(
    (sum, item) => sum + item.pricing.retailUnitPrice * item.quantity,
    0
  );

  return {
    items,
    subtotal: total,
    total,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    retailSubtotal,
    totalSavings: items.reduce((sum, item) => sum + item.pricing.savings, 0),
    wholesale: context !== null,
  };
}

function wishlistResponse(rows: WishlistItemRow[]) {
  return rows.flatMap((row) =>
    row.products
      ? [
          {
            id: row.id,
            product_id: row.product_id,
            product: productDTO(mapProductRow(row.products), null),
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
      product: item.products ? productDTO(mapProductRow(item.products), null) : null,
      products: undefined,
    })),
  };
}

export async function authenticate(request: Request) {
  return requireUserFromRequest(request);
}

// For public endpoints that render differently for signed-in viewers
// (e.g. wholesale tiers on product responses). An invalid/expired/missing
// session simply means "anonymous viewer" -- never an error.
export async function authenticateOptional(request: Request) {
  try {
    return await requireUserFromRequest(request);
  } catch {
    return null;
  }
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

// Viewer-aware product listing: admins get the full record (incl. legacy
// wholesale price + inventory count), approved wholesale customers get their
// own tiers attached, everyone else gets the public shape only.
export async function getProductsForViewer(
  viewer: CurrentUser | null,
  filters: Parameters<typeof getProducts>[0] = {}
) {
  const products = await getProducts(filters);
  const context = await wholesaleContext(
    viewer,
    products.map((product) => product.id)
  );

  return products.map((product) =>
    viewer?.role === "admin"
      ? productDTO(product, viewer)
      : productDTO(product, null, context?.tiersByProduct.get(product.id))
  );
}

export async function getProductForViewer(
  viewer: CurrentUser | null,
  id: number,
  quantity = 1
) {
  const product = await getProductById(id);

  if (!product) return null;

  const context = await wholesaleContext(viewer, [id]);
  const tiers = context?.tiersByProduct.get(id) ?? [];
  const pricing = priceLine({
    retailPrice: product.price,
    quantity: cleanQuantity(quantity),
    tiers,
  });

  const related = await getRelatedProducts(product);

  return {
    product:
      viewer?.role === "admin"
        ? productDTO(product, viewer)
        : productDTO(product, null, tiers),
    pricing,
    wholesale: context !== null,
    relatedProducts: related.map((item) => productDTO(item, null)),
  };
}

// Admin "what would this customer type pay?" preview. Uses the exact same
// priceLine() logic as the storefront and checkout.
export async function adminPricePreview(
  user: CurrentUser,
  params: { productId: number; quantity: number; priceListId?: string | null }
) {
  requireAdmin(user);

  const productRow = await selectProductById(params.productId);

  if (!productRow) {
    throw notFound("Product not found.");
  }

  let tiers: PriceTierRow[] = [];

  if (params.priceListId) {
    const priceList = await selectPriceListById(params.priceListId, user.accessToken);

    if (!priceList) {
      throw notFound("Price list not found.");
    }

    // Mirror production behavior: an inactive list never discounts.
    if (priceList.is_active) {
      tiers = await selectTiersForProducts(
        priceList.id,
        [params.productId],
        user.accessToken
      );
    }
  }

  return priceLine({
    retailPrice: productRow.price,
    quantity: cleanQuantity(params.quantity),
    tiers,
  });
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
  const rows = await selectCart(user.id, user.accessToken);
  const context = await wholesaleContext(
    user,
    rows.map((row) => row.product_id)
  );

  return cartResponse(rows, user, context);
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

  const available = availableStock(productRow);

  if (available <= 0) {
    throw badRequest("This product is currently out of stock.");
  }

  const rows = await selectCart(user.id, user.accessToken);
  const existingQuantity =
    rows.find((row) => row.product_id === productId)?.quantity ?? 0;
  const requestedQuantity = existingQuantity + cleanQuantity(quantity);

  if (requestedQuantity > available) {
    throw badRequest(
      `Only ${available} unit(s) of ${productRow.name} available.`
    );
  }

  await upsertCartItem(user.id, productId, requestedQuantity, user.accessToken);

  return getCart(user);
}

export async function changeCartItem(
  user: CurrentUser,
  id: string,
  quantity: unknown
) {
  const requestedQuantity = cleanQuantity(quantity);
  const rows = await selectCart(user.id, user.accessToken);
  const row = rows.find((item) => item.id === id);

  if (!row) {
    throw notFound("Cart item not found.");
  }

  if (row.products && requestedQuantity > availableStock(row.products)) {
    throw badRequest(
      `Only ${availableStock(row.products)} unit(s) of ${row.products.name} available.`
    );
  }

  await updateCartItem(user.id, id, requestedQuantity, user.accessToken);
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

// Checkout is authoritative: the user's profile, wholesale entitlement,
// price list, tiers, and inventory are all re-read here (the `user` argument
// comes from requireUserFromRequest, which loads the profile fresh from the
// database for every request). The browser contributes shipping details and,
// optionally, the total it last displayed -- never a price.
export async function createOrder(
  user: CurrentUser,
  body: {
    shipping_name?: string;
    shipping_phone?: string;
    shipping_address?: string;
    notes?: string | null;
    /** The total the client last saw. Used ONLY to detect price drift
     *  between the cart view and checkout; never to set prices. */
    expected_total?: number;
  }
) {
  if (!body.shipping_name || !body.shipping_phone || !body.shipping_address) {
    throw badRequest("Shipping name, phone, and address are required.");
  }

  const cart = await selectCart(user.id, user.accessToken);

  if (cart.length === 0) {
    throw badRequest("Cart is empty.");
  }

  const context = await wholesaleContext(
    user,
    cart.map((row) => row.product_id)
  );

  const lines = cart.map((item) => {
    if (!item.products) {
      throw badRequest("Cart contains an unavailable product.");
    }

    const available = availableStock(item.products);

    if (available < item.quantity) {
      throw badRequest(
        available <= 0
          ? `${item.products.name} is currently out of stock.`
          : `Only ${available} unit(s) of ${item.products.name} available.`
      );
    }

    const pricing = priceLine({
      retailPrice: item.products.price,
      quantity: item.quantity,
      tiers: context?.tiersByProduct.get(item.product_id) ?? [],
    });

    return {
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: pricing.unitPrice,
      retail_unit_price: pricing.retailUnitPrice,
      price_list_id: pricing.priceListId,
      tier_id: pricing.tierId,
      tier_min_quantity: pricing.tierMinQuantity,
    };
  });

  const totalAmount = lines.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0
  );

  if (body.expected_total !== undefined && body.expected_total !== totalAmount) {
    throw conflict(
      "Prices were updated while you were checking out. Please review your cart and try again."
    );
  }

  // Single transaction: order + items + inventory deduction + cart clear all
  // succeed or all roll back (see checkout_order in supabase/schema.sql).
  let result: { order_id: string };

  try {
    result = await checkoutOrderRpc({
      user_id: user.id,
      shipping_name: body.shipping_name,
      shipping_phone: body.shipping_phone,
      shipping_address: body.shipping_address,
      notes: body.notes ?? null,
      lines,
    });
  } catch (error) {
    throw mapCheckoutError(error, cart);
  }

  const order = await selectOrderById(user, result.order_id);

  return order
    ? orderResponse(order)
    : orderResponse({
        id: result.order_id,
        user_id: user.id,
        status: "pending",
        total_amount: totalAmount,
        shipping_name: body.shipping_name,
        shipping_phone: body.shipping_phone,
        shipping_address: body.shipping_address,
        notes: body.notes ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        order_items: [],
      });
}

function mapCheckoutError(error: unknown, cart: CartItemRow[]) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("CART_EMPTY")) {
    return badRequest("Cart is empty.");
  }

  if (message.includes("CART_CHANGED")) {
    return conflict(
      "Your cart changed while checking out. Please review it and try again."
    );
  }

  const stockMatch = message.match(/INSUFFICIENT_STOCK:(\d+):(\d+)/);

  if (stockMatch) {
    const productId = Number(stockMatch[1]);
    const available = Number(stockMatch[2]);
    const name =
      cart.find((row) => row.product_id === productId)?.products?.name ??
      `Product #${productId}`;

    return conflict(
      available <= 0
        ? `${name} sold out while you were checking out.`
        : `Only ${available} unit(s) of ${name} are left. Please adjust the quantity.`
    );
  }

  if (message.includes("PRODUCT_NOT_FOUND")) {
    return badRequest("Cart contains an unavailable product.");
  }

  return error instanceof Error ? error : new Error("Checkout failed.");
}

// ---------------------------------------------------------------------------
// Wholesale administration. Wholesale accounts are provisioned by an
// administrator only (no self-service application flow): the customer
// registers a normal account, an admin grants it wholesale access, and from
// then on the customer logs in exactly like everyone else -- the only
// difference is tier pricing on multi-unit purchases. Every mutation runs
// requireAdmin() first and is recorded in audit_log with the acting admin.
// ---------------------------------------------------------------------------

export async function adminListWholesaleAccounts(
  user: CurrentUser,
  filters: { search?: string | null; wholesaleOnly?: boolean } = {}
) {
  requireAdmin(user);
  return selectCustomerProfiles(filters);
}

async function resolveDefaultPriceListId(user: CurrentUser) {
  const lists = await selectPriceLists(user.accessToken);
  const standard =
    lists.find((list) => list.name === "Standard Wholesale" && list.is_active) ??
    lists.find((list) => list.is_active);

  if (!standard) {
    throw badRequest(
      "No active price list exists. Create one before granting wholesale access."
    );
  }

  return standard.id;
}

export async function adminUpdateWholesaleAccount(
  user: CurrentUser,
  targetUserId: string,
  update:
    | { action: "grant"; price_list_id?: string | null }
    | { action: "revoke" }
    | { action: "suspend" }
    | { action: "reactivate" }
    | { action: "assign_price_list"; price_list_id: string }
) {
  requireAdmin(user);

  const profile = await selectProfileByIdService(targetUserId);

  if (!profile) {
    throw notFound("Customer not found.");
  }

  if (update.action === "grant") {
    // Four-eyes guard: an admin must not grant wholesale to their own
    // account, and admin accounts stay admin accounts.
    if (targetUserId === user.id) {
      throw forbidden("You cannot grant wholesale access to your own account.");
    }

    if (profile.role === "admin") {
      throw conflict("Admin accounts cannot be converted to wholesale.");
    }

    if (profile.wholesale_status !== "not_applied") {
      throw conflict("This account already has wholesale access.");
    }

    let priceListId = update.price_list_id ?? null;

    if (priceListId) {
      const priceList = await selectPriceListById(priceListId, user.accessToken);

      if (!priceList) {
        throw notFound("Price list not found.");
      }
    } else {
      priceListId = await resolveDefaultPriceListId(user);
    }

    const updated = await updateProfileWholesaleService(targetUserId, {
      role: "wholesale",
      wholesale_status: "approved",
      price_list_id: priceListId,
    });

    await insertAuditLog({
      actor_id: user.id,
      action: "wholesale.account.grant",
      target_type: "profile",
      target_id: targetUserId,
      previous_data: {
        role: profile.role,
        wholesale_status: profile.wholesale_status,
        price_list_id: profile.price_list_id,
      },
      new_data: {
        role: "wholesale",
        wholesale_status: "approved",
        price_list_id: priceListId,
      },
    });

    return updated;
  }

  if (update.action === "revoke") {
    if (profile.wholesale_status === "not_applied") {
      throw conflict("This account has no wholesale access to revoke.");
    }

    const updated = await updateProfileWholesaleService(targetUserId, {
      role: profile.role === "admin" ? "admin" : "normal",
      wholesale_status: "not_applied",
      price_list_id: null,
    });

    await insertAuditLog({
      actor_id: user.id,
      action: "wholesale.account.revoke",
      target_type: "profile",
      target_id: targetUserId,
      previous_data: {
        role: profile.role,
        wholesale_status: profile.wholesale_status,
        price_list_id: profile.price_list_id,
      },
      new_data: {
        role: "normal",
        wholesale_status: "not_applied",
        price_list_id: null,
      },
    });

    return updated;
  }

  if (update.action === "suspend") {
    if (profile.wholesale_status !== "approved") {
      throw conflict("Only an approved wholesale account can be suspended.");
    }

    const updated = await updateProfileWholesaleService(targetUserId, {
      wholesale_status: "suspended",
    });

    await insertAuditLog({
      actor_id: user.id,
      action: "wholesale.account.suspend",
      target_type: "profile",
      target_id: targetUserId,
      previous_data: { wholesale_status: profile.wholesale_status },
      new_data: { wholesale_status: "suspended" },
    });

    return updated;
  }

  if (update.action === "reactivate") {
    if (profile.wholesale_status !== "suspended") {
      throw conflict("Only a suspended wholesale account can be reactivated.");
    }

    const updated = await updateProfileWholesaleService(targetUserId, {
      wholesale_status: "approved",
    });

    await insertAuditLog({
      actor_id: user.id,
      action: "wholesale.account.reactivate",
      target_type: "profile",
      target_id: targetUserId,
      previous_data: { wholesale_status: profile.wholesale_status },
      new_data: { wholesale_status: "approved" },
    });

    return updated;
  }

  const priceList = await selectPriceListById(
    update.price_list_id,
    user.accessToken
  );

  if (!priceList) {
    throw notFound("Price list not found.");
  }

  const updated = await updateProfileWholesaleService(targetUserId, {
    price_list_id: update.price_list_id,
  });

  await insertAuditLog({
    actor_id: user.id,
    action: "wholesale.account.assign_price_list",
    target_type: "profile",
    target_id: targetUserId,
    previous_data: { price_list_id: profile.price_list_id },
    new_data: { price_list_id: update.price_list_id },
  });

  return updated;
}

// ---------------------------------------------------------------------------
// Price list + tier administration
// ---------------------------------------------------------------------------

export async function adminListPriceLists(user: CurrentUser) {
  requireAdmin(user);
  return selectPriceLists(user.accessToken);
}

export async function adminCreatePriceList(
  user: CurrentUser,
  input: { name: string; description?: string | null; is_active?: boolean }
) {
  requireAdmin(user);

  let created;

  try {
    created = await insertPriceList(
      {
        name: input.name,
        description: input.description ?? null,
        is_active: input.is_active ?? true,
      },
      user.accessToken
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate key")) {
      throw conflict("A price list with this name already exists.");
    }

    throw error;
  }

  await insertAuditLog({
    actor_id: user.id,
    action: "price_list.create",
    target_type: "price_list",
    target_id: created.id,
    new_data: { name: created.name, is_active: created.is_active },
  });

  return created;
}

export async function adminUpdatePriceList(
  user: CurrentUser,
  id: string,
  fields: { name?: string; description?: string | null; is_active?: boolean }
) {
  requireAdmin(user);

  const previous = await selectPriceListById(id, user.accessToken);

  if (!previous) {
    throw notFound("Price list not found.");
  }

  const updated = await updatePriceList(id, fields, user.accessToken);

  await insertAuditLog({
    actor_id: user.id,
    action: "price_list.update",
    target_type: "price_list",
    target_id: id,
    previous_data: {
      name: previous.name,
      description: previous.description,
      is_active: previous.is_active,
    },
    new_data: fields,
  });

  return updated;
}

export async function adminListTiers(
  user: CurrentUser,
  filters: { priceListId?: string | null; productId?: number | null }
) {
  requireAdmin(user);
  return selectTiersAdmin(filters, user.accessToken);
}

export type TierAdminInput = {
  price_list_id: string;
  product_id: number;
  min_quantity: number;
  unit_price: number;
  is_active?: boolean;
  effective_from?: string | null;
  effective_to?: string | null;
};

function validateTierDates(from?: string | null, to?: string | null) {
  if (from && to && new Date(to) <= new Date(from)) {
    throw badRequest("The effective end date must be after the start date.");
  }
}

export async function adminCreateTier(user: CurrentUser, input: TierAdminInput) {
  requireAdmin(user);
  validateTierDates(input.effective_from, input.effective_to);

  const [product, priceList] = await Promise.all([
    selectProductById(input.product_id),
    selectPriceListById(input.price_list_id, user.accessToken),
  ]);

  if (!product) throw notFound("Product not found.");
  if (!priceList) throw notFound("Price list not found.");

  let created;

  try {
    created = await insertTier(
      {
        price_list_id: input.price_list_id,
        product_id: input.product_id,
        min_quantity: input.min_quantity,
        unit_price: input.unit_price,
        is_active: input.is_active ?? true,
        effective_from: input.effective_from ?? null,
        effective_to: input.effective_to ?? null,
      },
      user.accessToken
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate key")) {
      throw conflict(
        "A tier with this minimum quantity already exists for this product and price list."
      );
    }

    throw error;
  }

  await insertAuditLog({
    actor_id: user.id,
    action: "tier.create",
    target_type: "product_price_tier",
    target_id: created.id,
    new_data: {
      price_list_id: created.price_list_id,
      product_id: created.product_id,
      min_quantity: created.min_quantity,
      unit_price: created.unit_price,
    },
  });

  return created;
}

export async function adminUpdateTier(
  user: CurrentUser,
  id: string,
  fields: Partial<Omit<TierAdminInput, "price_list_id" | "product_id">>
) {
  requireAdmin(user);

  const existing = (await selectTiersAdmin({}, user.accessToken)).find(
    (tier) => tier.id === id
  );

  if (!existing) {
    throw notFound("Tier not found.");
  }

  validateTierDates(
    fields.effective_from !== undefined ? fields.effective_from : existing.effective_from,
    fields.effective_to !== undefined ? fields.effective_to : existing.effective_to
  );

  let updated;

  try {
    updated = await updateTier(id, fields, user.accessToken);
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate key")) {
      throw conflict(
        "A tier with this minimum quantity already exists for this product and price list."
      );
    }

    throw error;
  }

  await insertAuditLog({
    actor_id: user.id,
    action: "tier.update",
    target_type: "product_price_tier",
    target_id: id,
    previous_data: {
      min_quantity: existing.min_quantity,
      unit_price: existing.unit_price,
      is_active: existing.is_active,
      effective_from: existing.effective_from,
      effective_to: existing.effective_to,
    },
    new_data: fields,
  });

  return updated;
}

export async function adminDeleteTier(user: CurrentUser, id: string) {
  requireAdmin(user);

  const existing = (await selectTiersAdmin({}, user.accessToken)).find(
    (tier) => tier.id === id
  );

  if (!existing) {
    throw notFound("Tier not found.");
  }

  await deleteTier(id, user.accessToken);

  await insertAuditLog({
    actor_id: user.id,
    action: "tier.delete",
    target_type: "product_price_tier",
    target_id: id,
    previous_data: {
      price_list_id: existing.price_list_id,
      product_id: existing.product_id,
      min_quantity: existing.min_quantity,
      unit_price: existing.unit_price,
    },
  });
}

export async function adminAuditLog(user: CurrentUser, limit = 100) {
  requireAdmin(user);
  return selectAuditLog(limit, user.accessToken);
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
