import { activePromotion } from "./promotions";
import { createHash, randomUUID } from "node:crypto";
import { codReviewError } from "./cod-verification";
import { reviewOrderDeliveryRpc } from "./supabase";
import { isApproximatelyInMyanmar, isMyanmarCountry, normalizeMyanmarRegion } from "./delivery-country";
import type { Product } from "../data/products";
import { isSameVariantGroup, productVariant, variantOptions } from "./product-variants";
import {
  checkoutOrderRpc,
  clearCart,
  countCustomers,
  countOrders,
  countProducts,
  deleteCartItem,
  deleteProduct,
  deleteRecentlyViewedRows,
  deleteTier,
  deleteWishlistItem,
  deleteProductAlert,
  selectProductAlerts,
  insertProductAlert,
  type ProductAlertRow,
  ensureSupportConversation,
  insertAuditLog,
  insertDeliveryEvent,
  insertPaymentSlip,
  selectPaymentSlipById,
  updateOrderPaymentService,
  uploadPaymentSlipObject,
  createPaymentSlipSignedUrl,
  deactivateInviteCodeService,
  insertInviteCodeService,
  insertRegistrationRequestService,
  redeemInviteCodeService,
  registerUser,
  selectInviteByHashService,
  selectInviteCodesService,
  selectPercentBandsForList,
  type PercentBandRow,
  insertPriceList,
  insertProduct,
  insertReturnEvidence,
  insertOrderHelpCase,
  selectAdminProfiles,
  selectWorkQueueItems,
  upsertWorkQueueItem,
  selectStaffNotes,
  insertStaffNote,
  type QueueSubjectType,
  selectHelpCasesForCustomer,
  selectHelpCases,
  selectHelpCaseById,
  updateHelpCaseService,
  insertReturnRequest,
  selectReturnRequestsForCustomer,
  selectReturnRequests,
  selectReturnRequestById,
  updateReturnRequestService,
  insertSupportMessage,
  uploadSupportAttachment,
  createSupportAttachmentSignedUrl,
  selectAdminPresenceService,
  updateAdminPresenceService,
  type AdminPresenceRow,
  setSheetStockBaselines,
  adjustSheetStockBaselines,
  selectOrderAuditEvents,
  insertTier,
  insertWishlistItem,
  loginUser,
  mapProductRow,
  adminCancelOrderRpc,
  advanceReturnWorkflowRpc,
  requireAdmin,
  requireUserFromRequest,
  requestOrderActionRpc,
  resolveOrderActionRpc,
  selectAuditLog,
  selectCart,
  selectOrderById,
  selectReturnEvidenceById,
  selectOrderItemStats,
  selectOrderStats,
  selectOrders,
  selectCustomerProfiles,
  selectPriceListById,
  selectPriceLists,
  selectProductById,
  selectProductByIdService,
  selectProducts,
  selectProductVariants,
  selectProductsByIdsService,
  selectProductsService,
  selectProfileByIdService,
  selectRecentlyViewedRows,
  selectSupportConversationByCustomer,
  selectSupportConversationById,
  selectSupportConversations,
  selectSupportMessages,
  selectTiersAdmin,
  selectTiersForProducts,
  selectWishlist,
  updateCartItem,
  updateOrderStatus,
  updateOrderDeliveryService,
  updatePriceList,
  updateProduct,
  updateCustomerSettingsService,
  updateProfileWholesaleService,
  updateSupportConversation,
  updateTier,
  updateUserPassword,
  upsertCartItem,
  upsertRecentlyViewedProduct,
  uploadReturnEvidenceObject,
  createReturnEvidenceSignedUrl,
  type CodVerificationStatus,
  type DeliveryEventStage,
  type CartItemRow,
  type CustomerSettingsFields,
  type CurrentUser,
  type OrderRow,
  type PaymentCorrectionReason,
  type OrderStatus,
  type PriceListRow,
  type PriceTierRow,
  type Profile,
  type ProductRow,
  type RefundMethod,
  type ReturnPickupMethod,
  type ReturnEvidenceKind,
  type ReturnReasonCode,
  type HelpCaseTopic,
  type HelpCaseStatus,
  type ReturnResolution,
  type ReturnRequestRow,
  type SupportConversationRow,
  type SupportConversationStatus,
  type SupportMessageRow,
  type WishlistItemRow,
} from "./supabase";
import { isOverdue, queueLane, type QueueLane } from "./work-queue";
import { makeReceiptNumber, sendOrderEmail, type ReceiptEmailResult } from "./receipt-email";
import {
  alertBaseline,
  evaluateAlert,
  type AlertKind,
} from "./product-alerts";
import {
  expandPercentBands,
  isTierEffective,
  isWholesaleApproved,
  priceLine,
  type PricingResult,
} from "./pricing";
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  serviceUnavailable,
} from "./errors";
import { withSheetStockLock } from "./sheet-stock-lock";
import { translate } from "./translations";
import { isPrepaidMethod, type PaymentMethod } from "./payment-accounts";
import {
  decrementSheetQuantities,
  hasGoogleSheetsConfig,
  incrementSheetQuantities,
  setSheetProductQuantity,
  readSheetDeductionRecord,
  sheetDeductionRecord,
  type SheetRestockItem,
} from "./google-sheets";

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
  const promo = activePromotion(product.price, product.fullSpecs?.promotion, now);
  const visibleTiers = (tiers ?? [])
    .filter((tier) => isTierEffective(tier, now))
    .sort((a, b) => a.min_quantity - b.min_quantity)
    .map((tier) => ({
      minQuantity: tier.min_quantity,
      unitPrice: promo ? Math.min(tier.unit_price, promo.price) : tier.unit_price,
    }));

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
  /** "% off retail" bands for this list: list-wide rows plus any per-product
   *  overrides. Empty for lists that still use fixed per-product prices. */
  percentBands: PercentBandRow[];
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

  const [tiers, percentBands] = await Promise.all([
    productIds.length > 0
      ? selectTiersForProducts(priceList.id, productIds, user.accessToken)
      : Promise.resolve([] as PriceTierRow[]),
    selectPercentBandsForList(priceList.id, productIds, user.accessToken),
  ]);

  for (const tier of tiers) {
    const list = tiersByProduct.get(tier.product_id) ?? [];
    list.push(tier);
    tiersByProduct.set(tier.product_id, list);
  }

  return { priceList, tiersByProduct, percentBands };
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
      promotion: product.fullSpecs?.promotion,
      quantity: row.quantity,
      tiers,
      percentBands: context?.percentBands ?? [],
      productId: product.id,
    });
    // The visible tier ladder must show percentage bands too, otherwise a
    // customer on a "% off retail" list would see an empty price table.
    const ladder = context
      ? [
          ...tiers,
          ...expandPercentBands(
            product.price,
            context.percentBands,
            product.id
          ).filter(
            (band) => !tiers.some((t) => t.min_quantity === band.min_quantity)
          ),
        ]
      : tiers;

    return [
      {
        id: row.id,
        product: productDTO(product, user.role === "admin" ? user : null, ladder),
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
    delivery_events: [...(order.delivery_events ?? [])].sort(
      (left, right) =>
        new Date(left.happened_at).getTime() - new Date(right.happened_at).getTime()
    ),
    return_evidence: [...(order.return_evidence ?? [])].sort(
      (left, right) =>
        new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
    ),
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

function customerSettingsResponse(
  profile: Profile,
  priceListName: string | null
) {
  return {
    email: profile.email,
    full_name: profile.full_name ?? "",
    phone: profile.phone ?? "",
    shipping_address_line1: profile.shipping_address_line1 ?? "",
    shipping_address_line2: profile.shipping_address_line2 ?? "",
    shipping_city: profile.shipping_city ?? "",
    shipping_state: profile.shipping_state ?? "",
    shipping_postal_code: profile.shipping_postal_code ?? "",
    shipping_country: profile.shipping_country ?? "Myanmar",
    preferred_language: profile.preferred_language ?? "en",
    order_updates_enabled: profile.order_updates_enabled ?? true,
    support_updates_enabled: profile.support_updates_enabled ?? true,
    marketing_emails_enabled: profile.marketing_emails_enabled ?? false,
    account: {
      role: profile.role,
      wholesale_status: profile.wholesale_status,
      price_list_id: profile.price_list_id,
      price_list_name: priceListName,
    },
  };
}

async function customerPriceListName(user: CurrentUser) {
  if (!user.profile.price_list_id) return null;

  const priceList = await selectPriceListById(
    user.profile.price_list_id,
    user.accessToken
  );

  return priceList?.name ?? null;
}

function requireCustomerAccount(user: CurrentUser) {
  if (user.role === "admin") {
    throw forbidden("Customer settings are not available for administrators.");
  }
}

export async function getCustomerSettings(user: CurrentUser) {
  requireCustomerAccount(user);
  return customerSettingsResponse(
    user.profile,
    await customerPriceListName(user)
  );
}

export async function updateCustomerSettings(
  user: CurrentUser,
  input: {
    full_name: string;
    phone: string;
    shipping_address_line1: string;
    shipping_address_line2: string;
    shipping_city: string;
    shipping_state: string;
    shipping_postal_code: string;
    shipping_country: string;
    preferred_language: "en" | "my";
    order_updates_enabled: boolean;
    support_updates_enabled: boolean;
    marketing_emails_enabled: boolean;
  }
) {
  requireCustomerAccount(user);

  const nullable = (value: string) => value.trim() || null;
  const fields: CustomerSettingsFields = {
    full_name: nullable(input.full_name),
    phone: nullable(input.phone),
    shipping_address_line1: nullable(input.shipping_address_line1),
    shipping_address_line2: nullable(input.shipping_address_line2),
    shipping_city: nullable(input.shipping_city),
    shipping_state: nullable(input.shipping_state),
    shipping_postal_code: nullable(input.shipping_postal_code),
    shipping_country: input.shipping_country.trim(),
    preferred_language: input.preferred_language,
    order_updates_enabled: input.order_updates_enabled,
    support_updates_enabled: input.support_updates_enabled,
    marketing_emails_enabled: input.marketing_emails_enabled,
  };

  try {
    const updated = await updateCustomerSettingsService(user.id, fields);

    if (!updated) throw notFound("Customer profile not found.");

    return customerSettingsResponse(
      updated,
      await customerPriceListName({ ...user, profile: updated })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (
      message.includes("shipping_address_line1") ||
      message.includes("preferred_language")
    ) {
      throw serviceUnavailable(
        "Customer settings database setup is incomplete. Run supabase/migrations/2026-07-29-customer-settings-recently-viewed.sql in the Supabase SQL Editor."
      );
    }

    throw error;
  }
}

export async function changeCustomerPassword(
  user: CurrentUser,
  currentPassword: string,
  newPassword: string
) {
  requireCustomerAccount(user);

  try {
    await loginUser(user.email, currentPassword);
  } catch {
    throw badRequest("Current password is incorrect.");
  }

  try {
    await updateUserPassword(user.accessToken, newPassword);
    return { ok: true };
  } catch {
    throw badRequest(
      "Unable to change the password. Please log in again and retry."
    );
  }
}

export async function getProducts(filters: {
  search?: string | null;
  query?: string | null;
  type?: string | null;
  category?: string | null;
  sourceSheet?: string | null;
  stock?: string | null;
  inStock?: boolean;
  limit?: number | null;
  offset?: number | null;
} = {}) {
  const normalized = {
    search: filters.search ?? filters.query,
    type: filters.type,
    category: filters.category,
    sourceSheet: filters.sourceSheet,
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

async function getProductByIdService(id: number) {
  const row = await selectProductByIdService(id);
  return row ? mapProductRow(row) : null;
}

export async function getRelatedProducts(product: Product) {
  return (await getProducts({ type: product.type }))
    // Another version of the same model is offered by the version buttons.
    .filter((item) => item.id !== product.id && !isSameVariantGroup(item, product))
    .slice(0, 3);
}

// Viewer-aware product listing: admins get the full record (incl. legacy
// wholesale price + inventory count), approved wholesale customers get their
// own tiers attached, everyone else gets the public shape only.
export async function getProductsForViewer(
  viewer: CurrentUser | null,
  filters: Parameters<typeof getProducts>[0] = {}
) {
  const products = (viewer?.role === "admin"
    ? await selectProductsService({
        search: filters.search ?? filters.query,
        type: filters.type,
        category: filters.category,
        sourceSheet: filters.sourceSheet,
        stock: filters.stock ?? (filters.inStock ? "In Stock" : null),
        limit: filters.limit,
        offset: filters.offset,
      })
    : await selectProducts({
        search: filters.search ?? filters.query,
        type: filters.type,
        category: filters.category,
        sourceSheet: filters.sourceSheet,
        stock: filters.stock ?? (filters.inStock ? "In Stock" : null),
        limit: filters.limit,
        offset: filters.offset,
      })).map(mapProductRow);
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
  const product =
    viewer?.role === "admin"
      ? await getProductByIdService(id)
      : await getProductById(id);

  if (!product) return null;

  const context = await wholesaleContext(viewer, [id]);
  const tiers = context?.tiersByProduct.get(id) ?? [];
  const pricing = priceLine({
    retailPrice: product.price,
    promotion: product.fullSpecs?.promotion,
    quantity: cleanQuantity(quantity),
    tiers,
    percentBands: context?.percentBands ?? [],
    productId: id,
  });

  const variant = productVariant(product);
  const [related, versions] = await Promise.all([
    getRelatedProducts(product),
    variant ? selectProductVariants(variant.group) : Promise.resolve([]),
  ]);

  // Percentage bands are part of the visible ladder as well (see cartResponse).
  const ladder = context
    ? [
        ...tiers,
        ...expandPercentBands(product.price, context.percentBands, id).filter(
          (band) => !tiers.some((t) => t.min_quantity === band.min_quantity)
        ),
      ]
    : tiers;

  return {
    product:
      viewer?.role === "admin"
        ? productDTO(product, viewer)
        : productDTO(product, null, ladder),
    pricing,
    wholesale: context !== null,
    relatedProducts: related.map((item) => productDTO(item, null)),
    // Versions of the same model the customer can switch between (256 GB /
    // 512 GB). Each is its own product with its own stock.
    variants: variantOptions(versions.map(mapProductRow)),
  };
}

function mapRecentlyViewedError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (
    message.includes("recently_viewed_products") &&
    (message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("Could not find"))
  ) {
    return serviceUnavailable(
      "Recently viewed database setup is incomplete. Run supabase/migrations/2026-07-29-customer-settings-recently-viewed.sql in the Supabase SQL Editor."
    );
  }

  return error instanceof Error
    ? error
    : new Error("Unable to load recently viewed products.");
}

export async function getRecentlyViewedProducts(user: CurrentUser) {
  requireCustomerAccount(user);

  try {
    const history = await selectRecentlyViewedRows(user.id, 8);
    const productIds = history.map((row) => row.product_id);
    const rows = await selectProductsByIdsService(productIds);
    const productsById = new Map(
      rows.map((row) => [row.id, mapProductRow(row)])
    );
    const context = await wholesaleContext(user, productIds);

    return history.flatMap((entry) => {
      const product = productsById.get(entry.product_id);

      return product
        ? [
            {
              viewed_at: entry.viewed_at,
              product: productDTO(
                product,
                null,
                context?.tiersByProduct.get(product.id)
              ),
            },
          ]
        : [];
    });
  } catch (error) {
    throw mapRecentlyViewedError(error);
  }
}

export async function recordRecentlyViewedProduct(
  user: CurrentUser,
  productId: number
) {
  requireCustomerAccount(user);

  try {
    const product = await selectProductByIdService(productId);

    if (!product) throw notFound("Product not found.");

    await upsertRecentlyViewedProduct(user.id, productId);
    return getRecentlyViewedProducts(user);
  } catch (error) {
    throw mapRecentlyViewedError(error);
  }
}

export async function clearRecentlyViewedProducts(user: CurrentUser) {
  requireCustomerAccount(user);

  try {
    await deleteRecentlyViewedRows(user.id);
    return { ok: true };
  } catch (error) {
    throw mapRecentlyViewedError(error);
  }
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
  let percentBands: PercentBandRow[] = [];

  if (params.priceListId) {
    const priceList = await selectPriceListById(params.priceListId, user.accessToken);

    if (!priceList) {
      throw notFound("Price list not found.");
    }

    // Mirror production behavior: an inactive list never discounts.
    if (priceList.is_active) {
      [tiers, percentBands] = await Promise.all([
        selectTiersForProducts(priceList.id, [params.productId], user.accessToken),
        selectPercentBandsForList(priceList.id, [params.productId], user.accessToken),
      ]);
    }
  }

  return priceLine({
    retailPrice: productRow.price,
    promotion: productRow.full_specs?.promotion,
    quantity: cleanQuantity(params.quantity),
    tiers,
    percentBands,
    productId: params.productId,
  });
}

export async function createProduct(user: CurrentUser, product: Partial<Product>) {
  requireAdmin(user);
  const row = await insertProduct(product);
  return mapProductRow(row);
}

export type AdminStockSheetUpdate = {
  sheet: string;
  cells: { row: number; from: number; to: number }[];
  sheetQuantityBefore: number;
  sheetQuantityAfter: number;
  /** Set when the stock was saved but a follow-up step did not finish. */
  warning: string | null;
};

export async function patchProduct(
  user: CurrentUser,
  id: number,
  product: Partial<Product>
) {
  requireAdmin(user);

  // A stock change for a sheet product writes the sheet, the product and the
  // sync baseline, so it takes turns with the product sync (sheet-stock-lock.ts).
  return typeof product.stockQuantity === "number" && hasGoogleSheetsConfig()
    ? withSheetStockLock(() => saveProduct(user, id, product))
    : saveProduct(user, id, product);
}

async function saveProduct(user: CurrentUser, id: number, product: Partial<Product>) {
  let sheetStock: AdminStockSheetUpdate | null = null;
  let sheetSourceKey: string | null = null;
  let previousWebsiteQuantity = 0;

  // Stock for products that come from the Google Sheet belongs to the sheet:
  // the sync caps website stock at the sheet, so a number saved only here
  // would be undone. Write the sheet first, and save nothing if that fails.
  if (typeof product.stockQuantity === "number" && hasGoogleSheetsConfig()) {
    const existing = await selectProductByIdService(id);
    if (!existing) return null;

    const target = Math.max(0, Math.floor(product.stockQuantity));
    previousWebsiteQuantity = existing.stock_quantity ?? 0;

    // Saving other fields re-sends the unchanged quantity; only a real change
    // touches the sheet.
    if (existing.source_key && previousWebsiteQuantity !== target) {
      sheetSourceKey = existing.source_key;
      let result: Awaited<ReturnType<typeof setSheetProductQuantity>>;

      try {
        result = await setSheetProductQuantity(existing.source_key, target);
      } catch (error) {
        console.error("[products] stock write to the Google Sheet failed", {
          product_id: id,
          error: error instanceof Error ? error.message : String(error),
        });
        throw serviceUnavailable(
          "The new stock could not be written to the Google Sheet, so nothing was saved. Please try again."
        );
      }

      if (result.status === "not_in_sheet") {
        throw conflict(
          "This product is no longer in the Google Sheet, so its stock cannot be changed here. Add it back to the sheet, or change other fields without changing the stock."
        );
      }

      sheetStock = {
        sheet: result.sheet,
        cells: result.cells,
        sheetQuantityBefore: result.sheetQuantityBefore,
        sheetQuantityAfter: result.sheetQuantityAfter,
        warning: null,
      };
    }
  }

  // If this save fails after the sheet write, the sync baseline is untouched,
  // so the next sync applies the sheet's change and the website catches up.
  const row = await updateProduct(id, product);
  if (!row) return null;

  if (sheetStock && sheetSourceKey) {
    try {
      // The sheet now holds exactly this number. Record it as the sync
      // baseline so the next sync sees no change instead of applying it again.
      await setSheetStockBaselines([
        { sourceKey: sheetSourceKey, sheetQuantity: sheetStock.sheetQuantityAfter },
      ]);
    } catch (error) {
      console.error("[products] sheet sync baseline update failed", {
        product_id: id,
        error: error instanceof Error ? error.message : String(error),
      });
      sheetStock.warning =
        "Saved and written to the Google Sheet, but the sync record could not be updated. Check this product's stock after the next Sync Products.";
    }

    await insertAuditLog({
      actor_id: user.id,
      action: "product.stock.sheet_write",
      target_type: "product",
      target_id: String(id),
      previous_data: {
        website_quantity: previousWebsiteQuantity,
        sheet_quantity: sheetStock.sheetQuantityBefore,
      },
      new_data: {
        quantity: sheetStock.sheetQuantityAfter,
        sheet: sheetStock.sheet,
        cells: sheetStock.cells,
      },
    }).catch((error) => {
      console.error("[products] could not record the sheet stock write", {
        product_id: id,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  return { product: mapProductRow(row), sheetStock };
}

export async function removeProduct(user: CurrentUser, id: number) {
  requireAdmin(user);
  await deleteProduct(id);
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

  const productRow = await selectProductByIdService(productId);

  if (!productRow) {
    throw notFound("Product not found.");
  }

  if (!Number.isFinite(productRow.price) || productRow.price <= 0) {
    throw badRequest("This product is awaiting a confirmed MMK price. Please contact support.");
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

  const product = await selectProductByIdService(row.product_id);

  if (!product) {
    throw notFound("Product not found.");
  }

  if (requestedQuantity > availableStock(product)) {
    throw badRequest(
      `Only ${availableStock(product)} unit(s) of ${product.name} available.`
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

// ---------------------------------------------------------------------------
// Back-in-stock and price-drop alerts
// ---------------------------------------------------------------------------

/**
 * Alerts carry their live status, worked out by comparing the baseline stored
 * when the customer started following with the product's current row. The
 * storefront therefore never has to poll, and there is no background job that
 * could silently stop running.
 */
function productAlertResponse(rows: ProductAlertRow[]) {
  return rows.flatMap((row) => {
    if (!row.products) return [];

    const product = mapProductRow(row.products);
    const alert = {
      id: row.id,
      product_id: row.product_id,
      kind: row.kind,
      baseline_price: row.baseline_price,
      baseline_stock:
        row.baseline_stock === "In Stock"
          ? ("In Stock" as const)
          : ("Out of Stock" as const),
      target_price: row.target_price,
      created_at: row.created_at,
    };

    return [
      {
        ...alert,
        product: productDTO(product, null),
        status: evaluateAlert(alert, product),
      },
    ];
  });
}

export async function getProductAlerts(user: CurrentUser) {
  return productAlertResponse(await selectProductAlerts(user.id));
}

export async function addProductAlert(
  user: CurrentUser,
  input: { product_id: number; kind: AlertKind; target_price?: number }
) {
  const product = await selectProductById(input.product_id);

  if (!product) {
    throw notFound("Product not found.");
  }

  const mapped = mapProductRow(product);

  // Following something already in stock would be an alert that can never
  // fire; say so rather than storing a dead row.
  if (input.kind === "back_in_stock" && mapped.stock === "In Stock") {
    throw badRequest("This product is already in stock.");
  }

  const baseline = alertBaseline(mapped);

  await insertProductAlert({
    userId: user.id,
    productId: input.product_id,
    kind: input.kind,
    baselinePrice: baseline.baseline_price,
    baselineStock: baseline.baseline_stock,
    targetPrice: input.target_price ?? null,
  });

  return getProductAlerts(user);
}

export async function removeProductAlert(user: CurrentUser, id: string) {
  await deleteProductAlert(user.id, id);
  return getProductAlerts(user);
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
    shipping_address_line1?: string;
    shipping_address_line2?: string | null;
    shipping_city?: string;
    shipping_state?: string;
    shipping_postal_code?: string;
    shipping_country?: string;
    payment_method?: PaymentMethod;
    payment_account?: "kbz" | "aya" | "mmqr" | null;
    notes?: string | null;
    cod_confirmation?: true;
    cod_contact_confirmation?: true;
    delivery_location_consent?: boolean;
    delivery_location?: {
      latitude: number;
      longitude: number;
      accuracy_m: number | null;
      captured_at: string;
    } | null;
    /** The total the client last saw. Used ONLY to detect price drift
     *  between the cart view and checkout; never to set prices. */
    expected_total?: number;
  }
) {
  const shippingAddressLine1 =
    body.shipping_address_line1?.trim() || body.shipping_address?.trim() || "";
  const shippingAddressLine2 = body.shipping_address_line2?.trim() || null;
  const shippingCity = body.shipping_city?.trim() || "";
  const shippingState = normalizeMyanmarRegion(body.shipping_state);
  const shippingPostalCode = body.shipping_postal_code?.trim() || "";
  if (!isMyanmarCountry(body.shipping_country) || !shippingState) {
    throw badRequest("We currently deliver within Myanmar only. Select a Myanmar state or region and enter the recipient’s complete address.");
  }
  const shippingCountry = "Myanmar";
  if (body.delivery_location && (!body.delivery_location_consent || !isApproximatelyInMyanmar(body.delivery_location.latitude, body.delivery_location.longitude))) {
    throw badRequest("A delivery pin needs your consent and must be in Myanmar. Remove an incorrect pin and ask staff to verify your written address.");
  }
  const shippingAddress =
    body.shipping_address?.trim() ||
    [
      shippingAddressLine1,
      shippingAddressLine2,
      shippingCity,
      shippingState,
      shippingPostalCode,
      shippingCountry,
    ]
      .filter(Boolean)
      .join(", ");

  if (!body.shipping_name || !body.shipping_phone || !shippingAddress) {
    throw badRequest("Shipping name, phone, and address are required.");
  }

  const cart = await selectCart(user.id, user.accessToken);

  if (cart.length === 0) {
    throw badRequest("Cart is empty.");
  }

  const productRows = await selectProductsByIdsService(
    cart.map((row) => row.product_id)
  );
  const productsById = new Map(productRows.map((row) => [row.id, row]));

  const context = await wholesaleContext(
    user,
    cart.map((row) => row.product_id)
  );

  const lines = cart.map((item) => {
    const product = productsById.get(item.product_id);

    if (!product) {
      throw badRequest("Cart contains an unavailable product.");
    }

    if (!Number.isFinite(product.price) || product.price <= 0) {
      throw badRequest(`${product.name} is awaiting a confirmed MMK price. Remove it from the cart or contact support.`);
    }

    const available = availableStock(product);

    if (available < item.quantity) {
      throw badRequest(
        available <= 0
          ? `${product.name} is currently out of stock.`
          : `Only ${available} unit(s) of ${product.name} available.`
      );
    }

    const pricing = priceLine({
      retailPrice: product.price,
      promotion: product.full_specs?.promotion,
      quantity: item.quantity,
      tiers: context?.tiersByProduct.get(item.product_id) ?? [],
      percentBands: context?.percentBands ?? [],
      productId: item.product_id,
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

  // Bank transfer and MMQR are paid before delivery: the order waits for a
  // transfer slip that an admin verifies (see verifyOrderPayment).
  const paymentMethod: PaymentMethod = body.payment_method ?? "cash_on_delivery";
  const prepaid = isPrepaidMethod(paymentMethod);

  // Single transaction: order + items + inventory deduction + cart clear all
  // succeed or all roll back (see checkout_order in supabase/schema.sql).
  let result: { order_id: string };

  try {
    result = await checkoutOrderRpc({
      user_id: user.id,
      shipping_name: body.shipping_name,
      shipping_phone: body.shipping_phone,
      shipping_address: shippingAddress,
      shipping_address_line1: shippingAddressLine1,
      shipping_address_line2: shippingAddressLine2,
      shipping_city: shippingCity,
      shipping_state: shippingState,
      shipping_postal_code: shippingPostalCode,
      shipping_country: shippingCountry,
      payment_method: paymentMethod,
      notes: body.notes ?? null,
      lines,
    });
  } catch (error) {
    throw mapCheckoutError(error, cart);
  }

  // Geolocation is optional and collected only after an explicit checkout
  // action. It helps a courier find the address; it is not identity proof and
  // is never used as the sole COD approval signal.
  try {
    const location =
      body.delivery_location_consent && body.delivery_location
        ? body.delivery_location
        : null;
    await updateOrderDeliveryService(result.order_id, {
      cod_verification_status: "pending",
      delivery_location_consent: Boolean(location),
      delivery_latitude: location?.latitude ?? null,
      delivery_longitude: location?.longitude ?? null,
      delivery_accuracy_m: location?.accuracy_m != null ? Math.round(location.accuracy_m) : null,
      delivery_location_captured_at: location?.captured_at ?? null,
      delivery_last_event_at: new Date().toISOString(),
      delivery_status_detail: prepaid
        ? "Order received; waiting for your transfer slip and payment check."
        : location
          ? "Order received; customer-selected delivery pin supplied. COD verification is pending."
          : "Order received; confirm the written address by phone. No delivery pin supplied. COD verification is pending.",
    });
    if (prepaid && body.payment_account) {
      await updateOrderPaymentService(result.order_id, {
        payment_account: body.payment_account,
      });
    }
    await insertDeliveryEvent({
      order_id: result.order_id,
      stage: "order_placed",
      title: "Order received",
      description: prepaid
        ? "Upload your transfer slip so we can check your payment."
        : "Your cash-on-delivery order is waiting for verification.",
      created_by: user.id,
    });
  } catch (error) {
    // Do not create a duplicate order by reporting checkout failure after the
    // transaction already committed. The migration/setup guide explains how
    // to enable these optional tracking fields.
    console.error("[orders] delivery metadata setup is incomplete", {
      order_id: result.order_id,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // The order is committed; mirror the deduction into the production
  // workbook's quantity cells. Best-effort only — the workbook may be
  // temporarily unreachable, and the admin sheet sync reconciles later.
  if (hasGoogleSheetsConfig()) {
    const sheetItems = lines.flatMap((line) => {
      const sourceKey = productsById.get(line.product_id)?.source_key;
      return sourceKey ? [{ sourceKey, quantity: line.quantity }] : [];
    });

    if (sheetItems.length > 0) {
      // The sheet write and its baseline must not interleave with a product
      // sync, or the sale is subtracted twice; see sheet-stock-lock.ts.
      await withSheetStockLock(async () => {
        try {
          const updates = await decrementSheetQuantities(sheetItems);

          // Only rows we actually wrote advance the baseline. Anything left
          // unwritten stays behind, so the next import re-reconciles it.
          await setSheetStockBaselines(
            updates
              .filter((update) => update.cells.length > 0)
              .map((update) => ({
                sourceKey: update.sourceKey,
                sheetQuantity: update.sheetQuantityAfter,
              }))
          );

          // Remember exactly what reached the workbook, so cancelling this order
          // later puts the same units back into the same rows -- and nothing if
          // this write never landed.
          const deduction = sheetDeductionRecord(updates);
          if (deduction.items.length > 0) {
            await recordOrderSheetEvent(
              user.id,
              result.order_id,
              SHEET_STOCK_DEDUCTED,
              deduction
            );
          }

          const shortfalls = updates.filter((update) => update.shortfall > 0);
          if (shortfalls.length > 0) {
            console.warn(
              "[orders] workbook quantities were already lower than the storefront's",
              { order_id: result.order_id, shortfalls }
            );
          }
        } catch (error) {
          // The order stands and the database inventory is correct; the workbook
          // is now stale. Record it so an admin can see the divergence instead of
          // it living only in server logs.
          console.error("[orders] sheet quantity write-back failed", {
            order_id: result.order_id,
            error: error instanceof Error ? error.message : String(error),
          });

          await insertAuditLog({
            actor_id: user.id,
            action: "sheet_write_back_failed",
            target_type: "order",
            target_id: result.order_id,
            new_data: {
              items: sheetItems,
              error: error instanceof Error ? error.message : String(error),
            },
          }).catch(() => undefined);
        }
      });
    }
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
        shipping_address: shippingAddress,
        shipping_address_line1: shippingAddressLine1,
        shipping_address_line2: shippingAddressLine2,
        shipping_city: shippingCity,
        shipping_state: shippingState,
        shipping_postal_code: shippingPostalCode,
        shipping_country: shippingCountry,
        payment_method: "cash_on_delivery",
        payment_status: "unpaid",
        cod_verification_status: "pending",
        cod_verification_method: null,
        cod_verified_at: null,
        delivery_latitude: body.delivery_location?.latitude ?? null,
        delivery_longitude: body.delivery_location?.longitude ?? null,
        delivery_accuracy_m: body.delivery_location?.accuracy_m ?? null,
        delivery_location_consent: Boolean(body.delivery_location_consent),
        delivery_location_captured_at: body.delivery_location?.captured_at ?? null,
        courier_name: null,
        delivery_tracking_number: null,
        estimated_delivery_at: null,
        delivery_status_detail: "Order received; COD verification is pending.",
        delivery_last_event_at: new Date().toISOString(),
        cancellation_request_status: "none",
        cancellation_reason: null,
        cancellation_requested_at: null,
        cancellation_resolved_at: null,
        return_request_status: "none",
        return_reason: null,
        return_requested_at: null,
        return_resolved_at: null,
        admin_order_note: null,
        notes: body.notes ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        order_items: [],
      });
}

function mapCheckoutError(error: unknown, cart: CartItemRow[]) {
  if (error instanceof Error && error.message.includes("COD_OPEN_LIMIT")) {
    return conflict("You already have 3 pending COD orders. Contact support or cancel an accidental duplicate before placing another.");
  }
  const message = error instanceof Error ? error.message : "";

  if (
    message.includes("Could not find the function public.checkout_order") ||
    (message.includes("checkout_order") && message.includes("schema cache"))
  ) {
    return serviceUnavailable(
      "Checkout database setup is incomplete. Run supabase/migrations/2026-07-28-cod-order-lifecycle.sql in the Supabase SQL Editor, then try again."
    );
  }

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

// ---------------------------------------------------------------------------
// One-time wholesale registration codes
// ---------------------------------------------------------------------------

// Unambiguous alphabet: no O/0, I/1, so a code read over the phone or copied
// off a printed slip cannot be mistyped into a different valid code.
const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function hashInviteCode(plain: string) {
  return createHash("sha256").update(plain.trim().toUpperCase()).digest("hex");
}

function generateInviteCode() {
  const bytes = randomUUID().replace(/-/g, "");
  let code = "";

  for (let i = 0; i < 12; i += 1) {
    code += INVITE_ALPHABET[parseInt(bytes[i], 16) % INVITE_ALPHABET.length];
  }

  // APH-XXXX-XXXX-XXXX
  return `APH-${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;
}

export async function adminListInviteCodes(user: CurrentUser) {
  requireAdmin(user);
  return selectInviteCodesService();
}

export async function adminCreateInviteCode(
  user: CurrentUser,
  input: {
    label?: string;
    price_list_id?: string;
    max_uses?: number;
    expires_in_days?: number;
  }
) {
  requireAdmin(user);

  let priceListId = input.price_list_id ?? null;

  if (priceListId) {
    const priceList = await selectPriceListById(priceListId, user.accessToken);
    if (!priceList) throw notFound("Price list not found.");
    if (!priceList.is_active) throw badRequest("Choose an active price list.");
  } else {
    // Always store a list, so redemption never has to guess later.
    priceListId = await resolveDefaultPriceListId(user);
  }

  const plain = generateInviteCode();
  const expiresAt = input.expires_in_days
    ? new Date(Date.now() + input.expires_in_days * 86_400_000).toISOString()
    : null;

  const invite = await insertInviteCodeService({
    code_hash: hashInviteCode(plain),
    code_hint: plain.slice(-4),
    label: input.label?.trim() || null,
    price_list_id: priceListId,
    max_uses: input.max_uses ?? 1,
    expires_at: expiresAt,
    created_by: user.id,
  });

  await insertAuditLog({
    actor_id: user.id,
    action: "wholesale.invite.create",
    target_type: "wholesale_invite_code",
    target_id: invite.id,
    new_data: {
      label: invite.label,
      price_list_id: invite.price_list_id,
      max_uses: invite.max_uses,
      expires_at: invite.expires_at,
    },
  });

  // The plain code is returned exactly once; only its hash is stored.
  // The hash never leaves the server, not even to an admin screen.
  const safeInvite: Partial<typeof invite> = { ...invite };
  delete safeInvite.code_hash;

  return { code: plain, invite: safeInvite };
}

export async function adminDeactivateInviteCode(user: CurrentUser, id: string) {
  requireAdmin(user);

  const invite = await deactivateInviteCodeService(id);

  if (!invite) throw notFound("Registration code not found.");

  await insertAuditLog({
    actor_id: user.id,
    action: "wholesale.invite.deactivate",
    target_type: "wholesale_invite_code",
    target_id: id,
    new_data: { is_active: false },
  });

  // The hash never leaves the server, not even to an admin screen.
  const safeInvite: Partial<typeof invite> = { ...invite };
  delete safeInvite.code_hash;

  return safeInvite;
}

/**
 * Wholesale (B2B) self-registration.
 *
 * The client never sends a role. A valid one-time code is the ONLY way to get
 * wholesale pricing, and the code is what stands in for the admin's business
 * check -- so redeeming it also sets business_verified_at, which
 * isWholesaleApproved() requires.
 *
 * Order matters: the code is validated first (so a wrong code does not leave a
 * half-made account behind), the account is created next, and the code is
 * consumed last through an atomic UPDATE ... WHERE use_count < max_uses, so two
 * people racing for the final use cannot both succeed.
 */
export async function registerWholesaleAccount(input: {
  email: string;
  password: string;
  full_name?: string;
  invite_code: string;
  business_name: string;
  contact_person?: string;
  phone?: string;
}) {
  const codeHash = hashInviteCode(input.invite_code);
  const candidate = await selectInviteByHashService(codeHash);

  const unusable =
    !candidate ||
    !candidate.is_active ||
    candidate.use_count >= candidate.max_uses ||
    (candidate.expires_at && new Date(candidate.expires_at) <= new Date());

  if (unusable) {
    throw badRequest(
      "That registration code is not valid, has expired, or has already been used. Ask Aphrodite for a new code."
    );
  }

  const result = await registerUser({
    email: input.email,
    password: input.password,
    fullName: input.full_name,
  });

  const invite = await redeemInviteCodeService(codeHash);

  if (!invite) {
    // Somebody else took the last use between the check and here. The account
    // exists as an ordinary retail account; it is never silently upgraded.
    throw conflict(
      "That registration code was just used by someone else. Your account was created as a personal account — ask Aphrodite for a new code to upgrade it."
    );
  }

  const profile = await updateProfileWholesaleService(result.user.id, {
    role: "wholesale",
    wholesale_status: "approved",
    price_list_id: invite.price_list_id,
    business_name: input.business_name.trim(),
    business_verified_at: new Date().toISOString(),
  });

  await insertRegistrationRequestService({
    user_id: result.user.id,
    invite_id: invite.id,
  });

  await insertAuditLog({
    actor_id: result.user.id,
    action: "wholesale.invite.redeem",
    target_type: "wholesale_invite_code",
    target_id: invite.id,
    new_data: {
      user_id: result.user.id,
      business_name: input.business_name.trim(),
      price_list_id: invite.price_list_id,
    },
  });

  return {
    profile,
    user: profile,
    requiresEmailVerification: result.requiresEmailVerification,
  };
}

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
    lists.find(
      (list) => list.name === "B2B Wholesale (% off retail)" && list.is_active
    ) ??
    lists.find((list) => list.name === "Sheet B2B (MMK)" && list.is_active) ??
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
    | { action: "grant"; price_list_id?: string | null; business_name: string; business_review_note: string; business_verified: true }
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
    if (!update.business_verified || update.business_name.trim().length < 2 || update.business_review_note.trim().length < 10) {
      throw badRequest("Verify the business name, business contact and reseller purpose before granting B2B access.");
    }
    // Four-eyes guard: an admin must not grant wholesale to their own
    // account, and admin accounts stay admin accounts.
    if (targetUserId === user.id) {
      throw forbidden("You cannot grant wholesale access to your own account.");
    }

    if (profile.role === "admin") {
      throw conflict("Admin accounts cannot be converted to wholesale.");
    }

    if (profile.wholesale_status !== "not_applied" && profile.business_verified_at) {
      throw conflict("This account already has wholesale access.");
    }

    let priceListId = update.price_list_id ?? null;

    if (priceListId) {
      const priceList = await selectPriceListById(priceListId, user.accessToken);

      if (!priceList) {
        throw notFound("Price list not found.");
      }
      if (!priceList.is_active) throw badRequest("Choose an active price list.");
    } else {
      priceListId = await resolveDefaultPriceListId(user);
    }

    const updated = await updateProfileWholesaleService(targetUserId, {
      role: "wholesale",
      wholesale_status: "approved",
      price_list_id: priceListId,
      business_name: update.business_name.trim(),
      business_verified_at: new Date().toISOString(),
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
        business_name: update.business_name.trim(),
        business_review_note: update.business_review_note.trim(),
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
      business_verified_at: null,
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
    if (!profile.business_verified_at) throw conflict("Verify this business again before reactivating B2B access.");
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
  status: Extract<OrderStatus, "pending" | "confirmed" | "shipped" | "delivered">
) {
  requireAdmin(user);

  const existing = await selectOrderById(user, id);
  if (!existing) return null;

  const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
    pending: "confirmed",
    confirmed: "shipped",
    shipped: "delivered",
  };

  if (status !== existing.status && nextStatus[existing.status] !== status) {
    throw conflict(
      `Order cannot move from ${existing.status} to ${status}. Complete each fulfilment step in order.`
    );
  }

  if (
    existing.cancellation_request_status === "requested" &&
    status !== existing.status
  ) {
    throw conflict(
      "Resolve the customer's cancellation request before changing fulfilment status."
    );
  }

  if (status === existing.status) return orderResponse(existing);

  // Prepaid orders are gated on the transfer slip instead of the COD callback.
  if (isPrepaidMethod(existing.payment_method)) {
    if (existing.payment_verification_status !== "verified") {
      throw conflict(
        "Open the customer's transfer slip and mark the payment verified before fulfilment."
      );
    }
  } else if (existing.cod_verification_status !== "approved") {
    throw conflict("Open COD & delivery details, confirm the phone callback and address, and approve COD before fulfilment.");
  }
  if (["shipped", "delivered"].includes(status) && (!existing.courier_name || !existing.delivery_tracking_number)) {
    throw conflict("Save the courier and tracking/reference number before shipping.");
  }

  const now = new Date().toISOString();
  const receiptNumber =
    status === "confirmed"
      ? existing.receipt_number ?? makeReceiptNumber(existing.id)
      : undefined;

  await updateOrderStatus(id, status, user.accessToken, {
    paymentStatus: status === "delivered" ? "collected" : undefined,
    confirmedAt: status === "confirmed" ? now : undefined,
    deliveredAt: status === "delivered" ? now : undefined,
    receiptNumber,
  });

  // No email is sent here. The route schedules the delivery receipt with
  // next/server after(), so a slow or failing mail server can never block or
  // fail a status change -- see notifyOrderDelivered below. The receipt number
  // is still assigned at "confirmed", so it always exists by delivery.
  const order = await selectOrderById(user, id);

  if (order) {
    await insertAuditLog({
      actor_id: user.id,
      action: "order.status.update",
      target_type: "order",
      target_id: id,
      previous_data: { status: existing.status },
      new_data: { status },
    });
  }

  return order ? orderResponse(order) : null;
}

// ---------------------------------------------------------------------------
// Order emails
//
// Called by the route handlers inside next/server after(), i.e. once the
// response has already gone to the browser. Both functions swallow every
// error: an email problem must never fail or undo an order.
// ---------------------------------------------------------------------------

/** Honours the customer's "Order status updates" switch in Settings. */
async function wantsOrderUpdates(userId: string) {
  try {
    const profile = await selectProfileByIdService(userId);
    return profile?.order_updates_enabled ?? true;
  } catch {
    // If the preference cannot be read, default to sending: these are
    // transactional messages about the customer's own purchase.
    return true;
  }
}

/**
 * Fills in the customer's contact details when the caller's own token could
 * not read them.
 *
 * Orders are loaded under the *caller's* access token and the customer's
 * profile rides along as a PostgREST embed. A customer reading their own
 * order always gets it ("Users read own profile"), but an admin only does
 * where the "Admins read all profiles" policy has actually been applied --
 * and where it has not, the embed comes back null rather than erroring. Every
 * order email an admin triggers (the delivery receipt, a failed-attempt
 * notice, a manual resend) then finds no recipient and is silently recorded
 * as "not_configured".
 *
 * So the address is looked up separately, service-role, exactly as
 * wantsOrderUpdates above already reads the same profile for the same reason.
 * This widens no authorization: the caller still had to be able to load the
 * order itself, and nothing here is returned to the browser -- it only feeds
 * the message we are about to send that customer about their own purchase.
 */
async function withCustomerContact(order: OrderRow): Promise<OrderRow> {
  if (order.profiles?.email) return order;

  try {
    const profile = await selectProfileByIdService(order.user_id);
    if (!profile?.email) return order;

    return {
      ...order,
      profiles: {
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role,
      },
    };
  } catch (error) {
    // An email is never worth failing the caller for; sendOrderEmail will
    // report "not_configured" and the caller logs it.
    console.error("[orders] could not resolve customer contact", {
      order_id: order.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return order;
  }
}

type DeliveredReceiptOutcome = ReceiptEmailResult | { status: "not_sent" };

/**
 * Sends the full paid receipt for a delivered order and saves the outcome in
 * receipt_email_status / receipt_sent_at / receipt_email_error. Skips
 * customers who turned off order emails in Settings.
 */
async function emailDeliveredReceipt(
  user: CurrentUser,
  order: OrderRow,
  options: { idempotencySuffix?: string } = {}
): Promise<DeliveredReceiptOutcome> {
  if (!(await wantsOrderUpdates(order.user_id))) {
    await updateOrderStatus(order.id, "delivered", user.accessToken, {
      receiptEmailStatus: "not_sent",
      receiptSentAt: null,
      receiptEmailError: null,
    });
    return { status: "not_sent" };
  }

  const result = await sendOrderEmail(await withCustomerContact(order), {
    kind: "delivered",
    receiptNumber: order.receipt_number ?? makeReceiptNumber(order.id),
    idempotencySuffix: options.idempotencySuffix,
  });

  await updateOrderStatus(order.id, "delivered", user.accessToken, {
    receiptEmailStatus: result.status,
    receiptSentAt: result.status === "sent" ? result.sentAt : null,
    receiptEmailError: result.status === "failed" ? result.error : null,
  });

  return result;
}

/**
 * Admin "Send receipt email": sends the full receipt now, even if one was
 * already sent -- for orders delivered before Gmail was set up, or a customer
 * who lost the first one. Unlike the automatic email it waits for the mail
 * server, so the admin sees at once whether it went out.
 */
export async function resendOrderReceipt(user: CurrentUser, id: string) {
  requireAdmin(user);

  const order = await selectOrderById(user, id);
  if (!order) return null;
  if (order.status !== "delivered") {
    throw conflict("A receipt email can only be sent after the order is delivered.");
  }

  const email = await emailDeliveredReceipt(user, order, {
    idempotencySuffix: `resend-${Date.now()}`,
  });

  await insertAuditLog({
    actor_id: user.id,
    action: "order.receipt_email.resend",
    target_type: "order",
    target_id: id,
    previous_data: { receipt_email_status: order.receipt_email_status ?? null },
    new_data: { receipt_email_status: email.status },
  });

  const updated = await selectOrderById(user, id);
  return {
    order: orderResponse(updated ?? order),
    email: {
      status: email.status,
      recipient: order.profiles?.email ?? null,
      error: email.status === "failed" ? email.error : null,
    },
  };
}

/** "Order received" email, right after a successful checkout. */
export async function notifyOrderPlaced(user: CurrentUser, orderId: string) {
  try {
    const order = await selectOrderById(user, orderId);
    if (!order || !(await wantsOrderUpdates(order.user_id))) return;

    const result = await sendOrderEmail(await withCustomerContact(order), {
      kind: "placed",
    });

    if (result.status === "failed") {
      console.error("[orders] order-received email failed", {
        order_id: orderId,
        error: result.error,
      });
    }
  } catch (error) {
    console.error("[orders] order-received email could not run", {
      order_id: orderId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Paid receipt, once the admin marks the order Delivered. The outcome is saved
 * in receipt_email_status / receipt_sent_at / receipt_email_error, which the
 * admin order list already displays.
 */
export async function notifyOrderDelivered(user: CurrentUser, orderId: string) {
  try {
    const order = await selectOrderById(user, orderId);
    if (!order || order.status !== "delivered") return;

    // Re-submitting "delivered" must not email the customer a second time.
    if (order.receipt_email_status === "sent") return;

    await emailDeliveredReceipt(user, order);
  } catch (error) {
    console.error("[orders] delivery receipt email could not run", {
      order_id: orderId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const PAYMENT_SLIP_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
const MAX_PAYMENT_SLIP_BYTES = 10 * 1024 * 1024;

/**
 * The customer's proof of a bank or MMQR transfer. Uploading again after a
 * rejection puts the order back in the admin's queue.
 */
export async function addPaymentSlip(
  user: CurrentUser,
  orderId: string,
  file: File,
  note: string | null
) {
  const order = await selectOrderById(user, orderId);
  if (!order) throw notFound("Order not found.");
  if (!isPrepaidMethod(order.payment_method)) {
    throw conflict("This order is cash on delivery, so no transfer slip is needed.");
  }
  if (order.status === "cancelled" || order.status === "returned") {
    throw conflict("This order is closed.");
  }
  if (!PAYMENT_SLIP_TYPES.has(file.type)) {
    throw badRequest("Upload the slip as a JPG, PNG, WebP or PDF file.");
  }
  if (file.size <= 0 || file.size > MAX_PAYMENT_SLIP_BYTES) {
    throw badRequest("The slip must be smaller than 10 MB.");
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "slip";
  const storagePath = `${user.id}/${orderId}/${randomUUID()}-${safeName}`;
  await uploadPaymentSlipObject(storagePath, await file.arrayBuffer(), file.type);

  const slip = await insertPaymentSlip({
    order_id: orderId,
    uploaded_by: user.id,
    storage_path: storagePath,
    file_name: file.name.slice(0, 200),
    content_type: file.type,
    size_bytes: file.size,
    note: note?.trim() || null,
  });

  if (order.payment_verification_status !== "verified") {
    await updateOrderPaymentService(orderId, {
      payment_verification_status: "pending",
      payment_rejected_reason: null,
      // The correction request has been answered. What already arrived stays
      // on the record: the admin adds this new slip to it rather than
      // starting the count again.
      payment_correction_reason: null,
      payment_correction_requested_at: null,
    });
  }

  return slip;
}

/** Short-lived signed link to one slip: the customer's own, or any for an admin. */
export async function getPaymentSlipUrl(user: CurrentUser, orderId: string, slipId: string) {
  const [order, slip] = await Promise.all([
    selectOrderById(user, orderId),
    selectPaymentSlipById(slipId),
  ]);
  if (!order || !slip || slip.order_id !== order.id) {
    throw notFound("Payment slip not found.");
  }
  return createPaymentSlipSignedUrl(slip.storage_path);
}

/**
 * Admin decision on the slip. Verifying records the money as collected, which
 * is what lets the order move on to confirmed and shipped.
 *
 * "correction_requested" is the middle option: the order stays open, what
 * actually arrived is recorded, and the customer is shown the exact difference
 * instead of being told to start again.
 */
export async function verifyOrderPayment(
  user: CurrentUser,
  id: string,
  input: {
    decision: "verified" | "rejected" | "correction_requested";
    payment_reference?: string | null;
    reason?: string | null;
    amount_received?: number | null;
    correction_reason?: PaymentCorrectionReason | null;
  }
) {
  requireAdmin(user);

  const existing = await selectOrderById(user, id);
  if (!existing) return null;
  if (!isPrepaidMethod(existing.payment_method)) {
    throw conflict("This order is cash on delivery, so there is no transfer to verify.");
  }

  const correction = input.decision === "correction_requested";
  const slipCount = (existing.payment_slips ?? []).length;
  if (input.decision === "verified" && slipCount === 0) {
    throw conflict("Ask the customer to upload the transfer slip before verifying the payment.");
  }
  if (correction && slipCount === 0) {
    throw conflict("There is no slip to correct yet. Wait for the customer to upload one.");
  }

  // Null means "not counted" and is deliberately different from 0 ("nothing
  // arrived"): the customer's next-step message reads the two differently.
  const amountReceived = correction
    ? typeof input.amount_received === "number"
      ? input.amount_received
      : null
    : existing.payment_amount_received ?? null;

  if (correction && amountReceived === existing.total_amount) {
    throw conflict(
      "That is the full order total, so there is nothing to correct — verify the payment instead."
    );
  }

  const now = new Date().toISOString();
  await updateOrderPaymentService(id, {
    payment_verification_status: input.decision,
    payment_verified_at: input.decision === "verified" ? now : null,
    payment_verified_by: input.decision === "verified" ? user.id : null,
    payment_reference: input.payment_reference?.trim() || existing.payment_reference || null,
    // One column for "what we told the customer about their payment", whether
    // it was refused outright or only needs correcting.
    payment_rejected_reason: input.decision === "verified" ? null : input.reason?.trim() || null,
    payment_amount_received: amountReceived,
    payment_correction_reason: correction ? input.correction_reason ?? "other" : null,
    payment_correction_requested_at: correction ? now : null,
    payment_status: input.decision === "verified" ? "collected" : "unpaid",
  });

  await insertAuditLog({
    actor_id: user.id,
    action: "order.payment.verify",
    target_type: "order",
    target_id: id,
    previous_data: { payment_verification_status: existing.payment_verification_status ?? null },
    new_data: {
      payment_verification_status: input.decision,
      payment_reference: input.payment_reference?.trim() || null,
      reason: input.reason?.trim() || null,
      amount_received: amountReceived,
      correction_reason: correction ? input.correction_reason ?? "other" : null,
    },
  }).catch((error) => {
    console.error("[orders] could not record the payment decision", {
      order_id: id,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  const updated = await selectOrderById(user, id);
  return updated ? orderResponse(updated) : null;
}

/** Planned delivery attempts before the admin is asked to cancel instead. */
export const MAX_DELIVERY_ATTEMPTS = 3;

export type DeliveryAttemptReason =
  | "no_answer"
  | "phone_off"
  | "address_problem"
  | "customer_rescheduled"
  | "nobody_home";

function failedAttemptCount(order: OrderRow) {
  return (order.delivery_events ?? []).filter((event) => event.stage === "delivery_failed").length;
}

/**
 * The courier could not hand the order over. This records an attempt and tells
 * the customer we will contact them again; it never changes the order status,
 * so the order simply waits for the next attempt and nothing is un-shipped.
 */
export async function recordFailedDeliveryAttempt(
  user: CurrentUser,
  id: string,
  input: {
    reason: DeliveryAttemptReason;
    next_attempt_at?: string | null;
    admin_note?: string | null;
  }
) {
  requireAdmin(user);

  const existing = await selectOrderById(user, id);
  if (!existing) return null;
  if (existing.status !== "shipped") {
    throw conflict(
      "A failed delivery attempt can only be recorded while the order is shipped."
    );
  }

  const attempt = failedAttemptCount(existing) + 1;
  const reasonEn = translate("en", `delivery.reason.${input.reason}`);
  const reasonMy = translate("my", `delivery.reason.${input.reason}`);
  // Stored in both languages: the admin list and the audit log show this text
  // as-is, and the customer's order page renders its own translated version.
  const detail = [
    `${translate("en", "delivery.attempt.heading")} (${translate("en", "delivery.attempt.count", {
      attempt,
      max: MAX_DELIVERY_ATTEMPTS,
    })}): ${reasonEn}. ${translate("en", "delivery.attempt.message")}`,
    `${translate("my", "delivery.attempt.heading")} (${translate("my", "delivery.attempt.count", {
      attempt,
      max: MAX_DELIVERY_ATTEMPTS,
    })}): ${reasonMy}။ ${translate("my", "delivery.attempt.message")}`,
    input.admin_note?.trim() ? input.admin_note.trim() : "",
  ]
    .filter(Boolean)
    .join("\n");

  await insertDeliveryEvent({
    order_id: id,
    stage: "delivery_failed",
    title: `Delivery attempt ${attempt} failed`,
    description: `${reasonEn}${input.admin_note?.trim() ? ` — ${input.admin_note.trim()}` : ""}`,
    created_by: user.id,
  });

  await updateOrderDeliveryService(id, {
    delivery_status_detail: detail,
    delivery_last_event_at: new Date().toISOString(),
    // A planned next attempt doubles as the customer's new estimated arrival.
    ...(input.next_attempt_at ? { estimated_delivery_at: input.next_attempt_at } : {}),
  });

  await insertAuditLog({
    actor_id: user.id,
    action: "order.delivery.attempt_failed",
    target_type: "order",
    target_id: id,
    new_data: {
      attempt,
      reason: input.reason,
      next_attempt_at: input.next_attempt_at ?? null,
      admin_note: input.admin_note?.trim() || null,
    },
  }).catch((error) => {
    console.error("[orders] could not record the delivery attempt", {
      order_id: id,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  const updated = await selectOrderById(user, id);
  return {
    order: orderResponse(updated ?? existing),
    attempt,
    maxAttempts: MAX_DELIVERY_ATTEMPTS,
  };
}

/**
 * "We tried to deliver" email, sent after the response like the other order
 * emails. Honours the customer's order-updates setting and never throws.
 */
export async function notifyDeliveryAttemptFailed(
  user: CurrentUser,
  orderId: string,
  reason: DeliveryAttemptReason,
  nextAttemptAt: string | null
) {
  try {
    const order = await selectOrderById(user, orderId);
    if (!order || !(await wantsOrderUpdates(order.user_id))) return;

    const result = await sendOrderEmail(await withCustomerContact(order), {
      kind: "attempt_failed",
      attempt: {
        number: failedAttemptCount(order),
        max: MAX_DELIVERY_ATTEMPTS,
        reason,
        nextAttemptAt,
      },
      idempotencySuffix: `attempt-${failedAttemptCount(order)}`,
    });

    if (result.status === "failed") {
      console.error("[orders] delivery attempt email failed", {
        order_id: orderId,
        error: result.error,
      });
    }
  } catch (error) {
    console.error("[orders] delivery attempt email could not run", {
      order_id: orderId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function requestOrderAction(
  user: CurrentUser,
  id: string,
  input:
    | { action: "request_cancellation"; reason: string }
    | {
        action: "request_return";
        reason: string;
        reason_code: ReturnReasonCode;
        pickup_method: ReturnPickupMethod;
        pickup_address?: string | null;
        evidence_url?: string | null;
        evidence_attestation: true;
      }
) {
  const existing = await selectOrderById(user, id);
  if (!existing) return null;

  try {
    await requestOrderActionRpc({
      user_id: user.id,
      order_id: id,
      request_type:
        input.action === "request_cancellation" ? "cancellation" : "return",
      reason: input.reason,
      reason_code:
        input.action === "request_return" ? input.reason_code : null,
      pickup_method:
        input.action === "request_return" ? input.pickup_method : null,
      pickup_address:
        input.action === "request_return" ? input.pickup_address ?? null : null,
    });
  } catch (error) {
    throw mapOrderLifecycleError(error);
  }

  if (input.action === "request_return" && input.evidence_url) {
    await insertReturnEvidence({
      order_id: id,
      uploaded_by: user.id,
      evidence_kind:
        input.reason_code === "damaged_in_transit" || input.reason_code === "defective"
          ? "unboxing_video"
          : "other",
      external_url: input.evidence_url,
      file_name: "Customer evidence link",
    });
  }

  const updated = await selectOrderById(user, id);
  return updated ? orderResponse(updated) : null;
}

// ---------------------------------------------------------------------------
// Google Sheet stock for cancelled orders
//
// Checkout deducts from the database (atomically) and then, best-effort, from
// the workbook. Cancellation restocks the database inside the SQL function, so
// the workbook must be restocked here -- by exactly what checkout removed from
// it, once, and without ever blocking the cancellation.
// ---------------------------------------------------------------------------

const SHEET_STOCK_DEDUCTED = "sheet_stock_deducted";
const SHEET_WRITE_BACK_FAILED = "sheet_write_back_failed";
const SHEET_STOCK_RESTORED = "sheet_stock_restored";

async function recordOrderSheetEvent(
  actorId: string,
  orderId: string,
  action: string,
  newData: Record<string, unknown>
) {
  await insertAuditLog({
    actor_id: actorId,
    action,
    target_type: "order",
    target_id: orderId,
    new_data: newData,
  }).catch((error) => {
    console.error("[orders] could not record a sheet stock event", {
      order_id: orderId,
      action,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

/**
 * Orders placed before deductions were recorded: checkout always wrote the
 * ordered quantity to the sheet (failures were logged separately), so restore
 * that quantity for every line that came from the workbook.
 */
async function orderLineRestockItems(order: OrderRow): Promise<SheetRestockItem[]> {
  const lines = (order.order_items ?? []).filter((line) => line.quantity > 0);
  if (lines.length === 0) return [];

  const products = await selectProductsByIdsService(
    lines.map((line) => line.product_id)
  );
  const sourceKeyById = new Map(
    products.map((product) => [product.id, product.source_key])
  );
  const quantityByKey = new Map<string, number>();

  for (const line of lines) {
    const sourceKey = sourceKeyById.get(line.product_id);
    // Products added by hand in admin are not in the workbook.
    if (!sourceKey) continue;
    quantityByKey.set(sourceKey, (quantityByKey.get(sourceKey) ?? 0) + line.quantity);
  }

  return [...quantityByKey].map(([sourceKey, quantity]) => ({ sourceKey, quantity }));
}

/**
 * Adds a cancelled order's units back to the Google Sheet. Never throws: the
 * cancellation has already committed, so every problem is logged instead and
 * written to the audit log where an admin can see it.
 */
export async function restoreSheetStockForCancelledOrder(
  actorId: string,
  order: OrderRow
) {
  if (!hasGoogleSheetsConfig()) return;

  // Takes turns with the product sync; see sheet-stock-lock.ts.
  return withSheetStockLock(() => restoreSheetStockLocked(actorId, order));
}

async function restoreSheetStockLocked(actorId: string, order: OrderRow) {
  let wroteToSheet = false;

  try {
    const events = await selectOrderAuditEvents(order.id, [
      SHEET_STOCK_DEDUCTED,
      SHEET_WRITE_BACK_FAILED,
      SHEET_STOCK_RESTORED,
    ]);

    // Never add the same units back twice.
    if (events.some((event) => event.action === SHEET_STOCK_RESTORED)) return;

    const deducted = events.find((event) => event.action === SHEET_STOCK_DEDUCTED);
    let items: SheetRestockItem[];

    if (deducted) {
      items = readSheetDeductionRecord(deducted.new_data);
    } else if (events.some((event) => event.action === SHEET_WRITE_BACK_FAILED)) {
      // Checkout's deduction never reached the sheet. Adding units back now
      // would push the sheet above the real stock.
      await recordOrderSheetEvent(actorId, order.id, "sheet_stock_restore_skipped", {
        reason:
          "The checkout deduction never reached the Google Sheet, so there was nothing to add back.",
      });
      return;
    } else {
      items = await orderLineRestockItems(order);
    }

    if (items.length === 0) return;

    const updates = await incrementSheetQuantities(items);
    wroteToSheet = true;

    const written = updates
      .filter((update) => update.cells.length > 0)
      .map((update) => ({
        sourceKey: update.sourceKey,
        quantity: update.cells.reduce((sum, cell) => sum + (cell.to - cell.from), 0),
      }));
    const notRestored = updates
      .filter((update) => update.shortfall > 0)
      .map((update) => ({ sourceKey: update.sourceKey, quantity: update.shortfall }));

    // Recorded before the baseline step, so a baseline failure can never lead
    // to the units being added to the sheet a second time.
    await recordOrderSheetEvent(actorId, order.id, SHEET_STOCK_RESTORED, {
      items: written,
      not_restored: notRestored,
    });

    if (notRestored.length > 0) {
      console.warn("[orders] some cancelled units are no longer in the Google Sheet", {
        order_id: order.id,
        not_restored: notRestored,
      });
    }

    // The storefront wrote these units itself, so move each sync baseline by
    // the same amount; otherwise the next sync would add them to the store's
    // stock a second time.
    await adjustSheetStockBaselines(
      written.map((entry) => ({ sourceKey: entry.sourceKey, delta: entry.quantity }))
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.error("[orders] cancelled-order sheet restock failed", {
      order_id: order.id,
      wrote_to_sheet: wroteToSheet,
      error: message,
    });

    await recordOrderSheetEvent(
      actorId,
      order.id,
      wroteToSheet ? "sheet_stock_baseline_failed" : "sheet_stock_restore_failed",
      {
        error: message,
        action_needed: wroteToSheet
          ? "The units were added back to the Google Sheet, but the sync baseline was not moved. Check stock before the next sheet sync."
          : "The units were NOT added back to the Google Sheet. Add them by hand; the website stock is already correct.",
      }
    );
  }
}

export async function adminCancelOrder(
  user: CurrentUser,
  id: string,
  input: {
    reason_code: "out_of_stock" | "pricing_error" | "customer_request" | "other";
    reason: string;
    admin_note?: string | null;
  }
) {
  requireAdmin(user);
  const existing = await selectOrderById(user, id);
  if (!existing) return null;

  try {
    await adminCancelOrderRpc({
      actor_id: user.id,
      order_id: id,
      reason_code: input.reason_code,
      reason: input.reason,
      admin_note: input.admin_note ?? null,
    });
  } catch (error) {
    throw mapOrderLifecycleError(error);
  }

  // The database already put the stock back inside admin_cancel_order().
  await restoreSheetStockForCancelledOrder(user.id, existing);

  const updated = await selectOrderById(user, id);
  return updated ? orderResponse(updated) : null;
}

export async function advanceReturnWorkflow(
  user: CurrentUser,
  id: string,
  input:
    | {
        action: "advance_return";
        stage: "schedule_pickup";
        scheduled_for: string;
        instructions?: string | null;
        tracking_number?: string | null;
        admin_note?: string | null;
      }
    | {
        action: "advance_return";
        stage: "mark_received";
        inspection_notes?: string | null;
        restock_approved: boolean;
        admin_note?: string | null;
      }
    | {
        action: "advance_return";
        stage: "complete_refund";
        refund_method: RefundMethod;
        refund_reference?: string | null;
        refund_amount: number;
        admin_note?: string | null;
      }
) {
  requireAdmin(user);
  const existing = await selectOrderById(user, id);
  if (!existing) return null;

  try {
    await advanceReturnWorkflowRpc({
      actor_id: user.id,
      order_id: id,
      action: input.stage,
      scheduled_for:
        input.stage === "schedule_pickup" ? input.scheduled_for : null,
      instructions:
        input.stage === "schedule_pickup" ? input.instructions ?? null : null,
      tracking_number:
        input.stage === "schedule_pickup"
          ? input.tracking_number ?? null
          : null,
      inspection_notes:
        input.stage === "mark_received" ? input.inspection_notes ?? null : null,
      restock_approved:
        input.stage === "mark_received" ? input.restock_approved : null,
      refund_method:
        input.stage === "complete_refund" ? input.refund_method : null,
      refund_reference:
        input.stage === "complete_refund"
          ? input.refund_reference ?? null
          : null,
      refund_amount:
        input.stage === "complete_refund" ? input.refund_amount : null,
      admin_note: input.admin_note ?? null,
    });
  } catch (error) {
    throw mapOrderLifecycleError(error);
  }

  const updated = await selectOrderById(user, id);
  return updated ? orderResponse(updated) : null;
}

export async function updateOrderDelivery(
  user: CurrentUser,
  id: string,
  input: {
    verification_status: CodVerificationStatus;
    callback_confirmed: boolean;
    address_confirmed: boolean;
    verification_note?: string | null;
    verification_method?: "phone_callback" | "cod_deposit" | "admin_review" | null;
    courier_name?: string | null;
    tracking_number?: string | null;
    estimated_delivery_at?: string | null;
    stage?: DeliveryEventStage | null;
    event_title?: string | null;
    event_description?: string | null;
    event_location?: string | null;
  }
) {
  requireAdmin(user);
  const existing = await selectOrderById(user, id);
  if (!existing) return null;
  if (existing.status === "cancelled" || existing.status === "returned") {
    throw conflict("Delivery details cannot be changed for a closed order.");
  }

  const problem = codReviewError(input);
  if (problem) throw badRequest(problem);
  // One transaction: row lock, staff evidence, order fields, event and audit.
  await reviewOrderDeliveryRpc(user.id, id, input);

  const updated = await selectOrderById(user, id);
  return updated ? orderResponse(updated) : null;
}

const RETURN_EVIDENCE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
]);
const MAX_RETURN_EVIDENCE_BYTES = 25 * 1024 * 1024;

export async function addReturnEvidence(
  user: CurrentUser,
  orderId: string,
  file: File,
  evidenceKind: ReturnEvidenceKind
) {
  const order = await selectOrderById(user, orderId);
  if (!order) throw notFound("Order not found.");
  if (order.status !== "delivered" || !order.delivered_at) {
    throw conflict("Evidence can be uploaded after the order is delivered.");
  }
  if (Date.now() > new Date(order.delivered_at).getTime() + 7 * 24 * 60 * 60 * 1000) {
    throw conflict("The 7-day online return request window has expired.");
  }
  if (!RETURN_EVIDENCE_TYPES.has(file.type)) {
    throw badRequest("Upload a JPG, PNG, WebP, MP4, or MOV file.");
  }
  if (file.size <= 0 || file.size > MAX_RETURN_EVIDENCE_BYTES) {
    throw badRequest("Each evidence file must be 25 MB or smaller. Use a secure HTTPS link for a longer video.");
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "evidence";
  const storagePath = `${user.id}/${orderId}/${randomUUID()}-${safeName}`;
  await uploadReturnEvidenceObject(storagePath, await file.arrayBuffer(), file.type);
  return insertReturnEvidence({
    order_id: orderId,
    uploaded_by: user.id,
    evidence_kind: evidenceKind,
    storage_path: storagePath,
    file_name: file.name.slice(0, 200),
    content_type: file.type,
    size_bytes: file.size,
  });
}

export async function getReturnEvidenceUrl(
  user: CurrentUser,
  orderId: string,
  evidenceId: string
) {
  const [order, evidence] = await Promise.all([
    selectOrderById(user, orderId),
    selectReturnEvidenceById(evidenceId),
  ]);
  if (!order || !evidence || evidence.order_id !== order.id) {
    throw notFound("Evidence not found.");
  }
  if (evidence.external_url) return evidence.external_url;
  if (!evidence.storage_path) throw notFound("Evidence file is missing.");
  return createReturnEvidenceSignedUrl(evidence.storage_path);
}

// ---------------------------------------------------------------------------
// "Get help with this order" cases
//
// One button, one case. The order, its payment slips, its delivery events and
// the customer's existing chat are joined up server-side, so the customer
// never has to retype what the shop can already see.
// ---------------------------------------------------------------------------

const RETURN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** When the 7-day online return window closes, or null before delivery. */
export function returnWindowEndsAt(order: OrderRow) {
  return order.delivered_at
    ? new Date(new Date(order.delivered_at).getTime() + RETURN_WINDOW_MS).toISOString()
    : null;
}

function returnWindowIsOpen(order: OrderRow) {
  const endsAt = returnWindowEndsAt(order);
  return Boolean(endsAt) && Date.now() <= new Date(endsAt!).getTime();
}

const HELP_TOPIC_LABELS: Record<HelpCaseTopic, string> = {
  payment: "Payment problem",
  delivery: "Delivery problem",
  faulty_item: "Wrong or faulty item",
  cancel_order: "Cancel order",
  warranty: "Warranty help",
};

export async function openOrderHelpCase(
  user: CurrentUser,
  orderId: string,
  input: { topic: HelpCaseTopic; summary: string }
) {
  if (user.role === "admin") {
    throw forbidden("Administrators open cases from the admin inbox.");
  }

  const order = await selectOrderById(user, orderId);
  if (!order) throw notFound("Order not found.");

  // The case rides on the customer's single support thread, so the admin
  // replies in the conversation they already know instead of a second inbox.
  const conversation = await ensureSupportConversation(user.id);

  const helpCase = await insertOrderHelpCase({
    order_id: orderId,
    customer_id: user.id,
    topic: input.topic,
    summary: input.summary,
    conversation_id: conversation?.id ?? null,
  });

  if (conversation) {
    // The header is written in English because it is an admin-facing label;
    // the customer's own words follow underneath, untouched.
    await insertSupportMessage({
      conversation_id: conversation.id,
      sender_id: user.id,
      sender_role: "customer",
      body: `[${HELP_TOPIC_LABELS[input.topic]}] Order #${orderId
        .slice(0, 8)
        .toUpperCase()}\n\n${input.summary}`,
    }).catch((error) => {
      // The case itself is already saved; a failed chat post must not lose it.
      console.error("[help] could not post the opening chat message", {
        case_id: helpCase?.id,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  return helpCase;
}

export async function listCustomerHelpCases(user: CurrentUser) {
  return selectHelpCasesForCustomer(user.id);
}

export async function listAdminHelpCases(user: CurrentUser) {
  requireAdmin(user);
  return selectHelpCases();
}

/**
 * Everything the administrator needs to judge one case in a single response:
 * the order with its payment slips and delivery events, the uploaded evidence,
 * any return requests on that order, and the chat.
 */
export async function getAdminHelpCase(user: CurrentUser, caseId: string) {
  requireAdmin(user);

  const helpCase = await selectHelpCaseById(caseId);
  if (!helpCase) throw notFound("Help case not found.");

  const [order, returnRequests, conversationMessages] = await Promise.all([
    selectOrderById(user, helpCase.order_id),
    selectReturnRequestsForCustomer(helpCase.customer_id),
    helpCase.conversation_id
      ? selectSupportMessages(helpCase.conversation_id)
      : Promise.resolve([]),
  ]);

  return {
    case: helpCase,
    order: order ? orderResponse(order) : null,
    return_requests: returnRequests.filter(
      (request) => request.order_id === helpCase.order_id
    ),
    messages: await supportMessagesResponse(conversationMessages),
  };
}

export async function updateHelpCase(
  user: CurrentUser,
  caseId: string,
  input: { status: HelpCaseStatus; admin_note?: string | null }
) {
  requireAdmin(user);

  const existing = await selectHelpCaseById(caseId);
  if (!existing) throw notFound("Help case not found.");

  const updated = await updateHelpCaseService(caseId, {
    status: input.status,
    admin_note: input.admin_note?.trim() || null,
    assigned_admin_id: existing.assigned_admin_id ?? user.id,
    resolved_at:
      input.status === "resolved" || input.status === "closed"
        ? new Date().toISOString()
        : null,
  });

  await insertAuditLog({
    actor_id: user.id,
    action: `help_case.${input.status}`,
    target_type: "order_help_case",
    target_id: caseId,
    previous_data: { status: existing.status },
    new_data: { status: input.status, admin_note: input.admin_note ?? null },
  });

  return updated;
}

// ---------------------------------------------------------------------------
// Per-item return requests
//
// A request names ONE order line. Several lines of one order can sit at
// different stages, so returning a faulty mouse never touches the laptop.
// ---------------------------------------------------------------------------

export async function createItemReturnRequest(
  user: CurrentUser,
  input: {
    order_id: string;
    order_item_id: string;
    quantity: number;
    reason_code: ReturnReasonCode;
    description: string;
    preferred_resolution: ReturnResolution;
    collection_method: ReturnPickupMethod;
    pickup_address?: string | null;
    unboxing_video_confirmed: boolean;
    evidence_url?: string | null;
  }
) {
  if (user.role === "admin") {
    throw forbidden("Administrators cannot open a return for a customer.");
  }

  const order = await selectOrderById(user, input.order_id);
  if (!order) throw notFound("Order not found.");
  if (order.status !== "delivered" || !order.delivered_at) {
    throw conflict("A return can only be requested after the order is delivered.");
  }
  if (!returnWindowIsOpen(order)) {
    throw conflict("The 7-day return request window has expired.");
  }

  const line = (order.order_items ?? []).find(
    (item) => item.id === input.order_item_id
  );
  if (!line) throw badRequest("Choose an item from this order.");
  if (input.quantity > line.quantity) {
    throw badRequest(
      `You ordered ${line.quantity} of this item, so you cannot return ${input.quantity}.`
    );
  }

  let request: ReturnRequestRow;

  try {
    request = await insertReturnRequest({
      order_id: input.order_id,
      order_item_id: input.order_item_id,
      customer_id: user.id,
      quantity: input.quantity,
      reason_code: input.reason_code,
      description: input.description,
      preferred_resolution: input.preferred_resolution,
      collection_method: input.collection_method,
      pickup_address: input.pickup_address ?? null,
      unboxing_video_confirmed: input.unboxing_video_confirmed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    // The partial unique index: one live claim per line at a time.
    if (message.includes("return_requests_one_open_per_item")) {
      throw conflict(
        "You already have a return request open for this item. Please wait for our decision."
      );
    }
    if (/schema cache|does not exist|Could not find/i.test(message)) {
      throw serviceUnavailable(
        "Returns are not set up yet. Run supabase/migrations/2026-09-17-help-cases-and-item-returns.sql in the Supabase SQL Editor."
      );
    }
    throw error;
  }

  if (input.evidence_url) {
    await insertReturnEvidence({
      order_id: input.order_id,
      uploaded_by: user.id,
      evidence_kind: "unboxing_video",
      external_url: input.evidence_url,
      file_name: "Customer video link",
      return_request_id: request.id,
    });
  }

  return selectReturnRequestById(request.id);
}

const RETURN_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const RETURN_VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);
const MAX_RETURN_PHOTO_BYTES = 10 * 1024 * 1024;
// Cloud Run caps an HTTP/1 request body at 32 MiB, so a longer clip has to
// arrive as a link instead. About 30 seconds of phone video fits in 25 MB.
const MAX_RETURN_VIDEO_BYTES = 25 * 1024 * 1024;

export async function addReturnRequestEvidence(
  user: CurrentUser,
  requestId: string,
  file: File,
  evidenceKind: ReturnEvidenceKind
) {
  const request = await selectReturnRequestById(requestId);
  if (!request) throw notFound("Return request not found.");
  if (user.role !== "admin" && request.customer_id !== user.id) {
    throw notFound("Return request not found.");
  }

  const isVideo = RETURN_VIDEO_TYPES.has(file.type);
  if (!isVideo && !RETURN_PHOTO_TYPES.has(file.type)) {
    throw badRequest("Upload a JPG, PNG or WebP photo, or an MP4, MOV or WebM video.");
  }

  const limit = isVideo ? MAX_RETURN_VIDEO_BYTES : MAX_RETURN_PHOTO_BYTES;
  if (file.size <= 0 || file.size > limit) {
    throw badRequest(
      isVideo
        ? "The video must be 25 MB or smaller (about 30 seconds). For a longer video, paste a secure link instead."
        : "Each photo must be 10 MB or smaller."
    );
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "evidence";
  const storagePath = `${user.id}/${request.order_id}/${randomUUID()}-${safeName}`;
  await uploadReturnEvidenceObject(storagePath, await file.arrayBuffer(), file.type);

  return insertReturnEvidence({
    order_id: request.order_id,
    uploaded_by: user.id,
    evidence_kind: evidenceKind,
    storage_path: storagePath,
    file_name: file.name.slice(0, 200),
    content_type: file.type,
    size_bytes: file.size,
    return_request_id: request.id,
  });
}

export async function listCustomerReturnRequests(user: CurrentUser) {
  return selectReturnRequestsForCustomer(user.id);
}

export async function listAdminReturnRequests(user: CurrentUser) {
  requireAdmin(user);
  return selectReturnRequests();
}

// ---------------------------------------------------------------------------
// The admin work queue
//
// Three different kinds of case land in one list: orders needing a payment
// check, help cases, and return requests. The lane is derived; the owner,
// next action and due date come from work_queue_items.
// ---------------------------------------------------------------------------

export type QueueItem = {
  subject_type: QueueSubjectType;
  subject_id: string;
  lane: QueueLane;
  title: string;
  detail: string;
  customer: string;
  order_id: string | null;
  created_at: string;
  owner_id: string | null;
  owner_email: string | null;
  next_action: string | null;
  due_at: string | null;
  overdue: boolean;
};

export async function getAdminWorkQueue(user: CurrentUser) {
  requireAdmin(user);

  const [orders, helpCases, returnRequests, assignments, admins] =
    await Promise.all([
      selectOrders(user, { limit: 200 }),
      selectHelpCases(),
      selectReturnRequests(),
      selectWorkQueueItems(),
      selectAdminProfiles(),
    ]);

  const adminEmailById = new Map(admins.map((profile) => [profile.id, profile.email]));
  const assignmentByKey = new Map(
    assignments.map((row) => [`${row.subject_type}:${row.subject_id}`, row])
  );
  const now = Date.now();

  function decorate(
    subjectType: QueueSubjectType,
    subjectId: string,
    lane: QueueLane,
    title: string,
    detail: string,
    customer: string,
    orderId: string | null,
    createdAt: string
  ): QueueItem {
    const assignment = assignmentByKey.get(`${subjectType}:${subjectId}`);

    return {
      subject_type: subjectType,
      subject_id: subjectId,
      lane,
      title,
      detail,
      customer,
      order_id: orderId,
      created_at: createdAt,
      owner_id: assignment?.owner_id ?? null,
      owner_email: assignment?.owner_id
        ? adminEmailById.get(assignment.owner_id) ?? null
        : null,
      next_action: assignment?.next_action ?? null,
      due_at: assignment?.due_at ?? null,
      overdue: isOverdue(assignment?.due_at, now),
    };
  }

  const items: QueueItem[] = [];

  for (const order of orders) {
    const lane = queueLane({
      type: "order",
      status: order.status,
      payment_method: order.payment_method,
      payment_verification_status: order.payment_verification_status,
      hasFailedDelivery: (order.delivery_events ?? []).some(
        (event) => event.stage === "delivery_failed"
      ),
    });
    if (!lane) continue;

    items.push(
      decorate(
        "order",
        order.id,
        lane,
        `Order #${order.id.slice(0, 8).toUpperCase()}`,
        lane === "awaiting_payment_check"
          ? `${order.payment_method} · ${(order.payment_slips ?? []).length} slip(s) uploaded`
          : "Courier could not hand the order over",
        order.profiles?.email ?? order.shipping_name,
        order.id,
        order.created_at
      )
    );
  }

  for (const helpCase of helpCases) {
    const lane = queueLane({
      type: "help_case",
      topic: helpCase.topic,
      status: helpCase.status,
    });
    if (!lane) continue;

    items.push(
      decorate(
        "help_case",
        helpCase.id,
        lane,
        `Help: ${helpCase.topic.replaceAll("_", " ")}`,
        helpCase.summary.slice(0, 160),
        helpCase.profiles?.email ?? "Customer",
        helpCase.order_id,
        helpCase.created_at
      )
    );
  }

  for (const request of returnRequests) {
    const lane = queueLane({ type: "return_request", status: request.status });
    if (!lane) continue;

    items.push(
      decorate(
        "return_request",
        request.id,
        lane,
        `Return: ${request.order_items?.products?.name ?? "item"} × ${request.quantity}`,
        `${request.status.replaceAll("_", " ")} · wants ${request.preferred_resolution}`,
        request.profiles?.email ?? "Customer",
        request.order_id,
        request.created_at
      )
    );
  }

  // Overdue first, then the oldest deadline, then the oldest case.
  items.sort((left, right) => {
    if (left.overdue !== right.overdue) return left.overdue ? -1 : 1;
    if (left.due_at && right.due_at) return Date.parse(left.due_at) - Date.parse(right.due_at);
    if (left.due_at) return -1;
    if (right.due_at) return 1;
    return Date.parse(left.created_at) - Date.parse(right.created_at);
  });

  return {
    items,
    admins: admins.map((profile) => ({
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
    })),
  };
}

export async function assignWorkItem(
  user: CurrentUser,
  input: {
    subject_type: QueueSubjectType;
    subject_id: string;
    owner_id?: string | null;
    next_action?: string | null;
    due_at?: string | null;
  }
) {
  requireAdmin(user);

  return upsertWorkQueueItem({
    subject_type: input.subject_type,
    subject_id: input.subject_id,
    owner_id: input.owner_id ?? null,
    next_action: input.next_action?.trim() || null,
    due_at: input.due_at ?? null,
  });
}

export async function listStaffNotes(
  user: CurrentUser,
  subjectType: QueueSubjectType,
  subjectId: string
) {
  requireAdmin(user);
  return selectStaffNotes(subjectType, subjectId);
}

/** Internal only: these never reach the customer's support thread. */
export async function addStaffNote(
  user: CurrentUser,
  input: { subject_type: QueueSubjectType; subject_id: string; body: string }
) {
  requireAdmin(user);

  return insertStaffNote({
    subject_type: input.subject_type,
    subject_id: input.subject_id,
    author_id: user.id,
    body: input.body.trim(),
  });
}

/** Approve, ask for more information, or decline with a reason. */
export async function decideReturnRequest(
  user: CurrentUser,
  requestId: string,
  input: {
    decision: "approve" | "more_info" | "decline";
    resolution_granted?: ReturnResolution | null;
    note?: string | null;
  }
) {
  requireAdmin(user);

  const existing = await selectReturnRequestById(requestId);
  if (!existing) throw notFound("Return request not found.");
  if (["completed", "cancelled"].includes(existing.status)) {
    throw conflict("This return request is already closed.");
  }

  const status =
    input.decision === "approve"
      ? "approved"
      : input.decision === "more_info"
        ? "more_info_needed"
        : "declined";

  const updated = await updateReturnRequestService(requestId, {
    status,
    resolution_granted:
      input.decision === "approve"
        ? input.resolution_granted ?? existing.preferred_resolution
        : null,
    admin_decision_note: input.note?.trim() || null,
    decided_by: user.id,
    decided_at: new Date().toISOString(),
    // A fresh decision answers any pending "please look again".
    review_requested_at: null,
  });

  await insertAuditLog({
    actor_id: user.id,
    action: `return_request.${status}`,
    target_type: "return_request",
    target_id: requestId,
    previous_data: { status: existing.status },
    new_data: {
      status,
      resolution_granted: updated?.resolution_granted ?? null,
      note: input.note ?? null,
    },
  });

  return updated;
}

/**
 * Moves an approved return along its own ladder, so a single faulty item can
 * be collected, inspected and settled without touching the order-level return
 * workflow used for whole-order returns.
 */
type RefundStage = "collected" | "inspected" | "refund_approved" | "completed";

const RETURN_STAGE_ORDER: Record<RefundStage, string> = {
  collected: "approved",
  inspected: "collected",
  refund_approved: "inspected",
  completed: "refund_approved",
};

export async function advanceItemReturn(
  user: CurrentUser,
  requestId: string,
  input: {
    stage: RefundStage;
    note?: string | null;
    refund_amount?: number | null;
    refund_method?: RefundMethod | null;
    refund_reference?: string | null;
  }
) {
  requireAdmin(user);

  const existing = await selectReturnRequestById(requestId);
  if (!existing) throw notFound("Return request not found.");

  if (existing.status !== RETURN_STAGE_ORDER[input.stage]) {
    throw conflict(
      `This return must be ${RETURN_STAGE_ORDER[input.stage]} before it can be marked ${input.stage}.`
    );
  }

  // Money must be traceable. A refund marked as sent with nothing to trace it
  // by is exactly the dispute this whole tracker exists to prevent, so the
  // reference is required rather than merely encouraged.
  const reference = (input.refund_reference ?? existing.refund_reference ?? "").trim();

  if (input.stage === "completed" && !reference) {
    throw badRequest(
      "Enter the bank, wallet or cash payment reference before marking the refund as sent."
    );
  }

  const now = new Date().toISOString();
  const updated = await updateReturnRequestService(requestId, {
    status: input.stage,
    admin_decision_note: input.note?.trim() || existing.admin_decision_note,
    decided_by: user.id,
    decided_at: now,
    // Authorising the refund records what was agreed; sending it records when
    // the money actually left and how to trace it.
    ...(input.stage === "refund_approved"
      ? {
          refund_approved_at: now,
          refund_amount: input.refund_amount ?? existing.refund_amount ?? null,
          refund_method: input.refund_method ?? existing.refund_method ?? null,
        }
      : {}),
    ...(input.stage === "completed"
      ? {
          refund_sent_at: now,
          refund_reference: reference,
          // The money is out, so a promised date is no longer outstanding.
          delay_reason: null,
        }
      : {}),
  });

  await insertAuditLog({
    actor_id: user.id,
    action: `return_request.${input.stage}`,
    target_type: "return_request",
    target_id: requestId,
    previous_data: { status: existing.status },
    new_data: { status: input.stage },
  });

  return updated;
}

/**
 * Sets the refund date the customer sees, and the plain explanation shown
 * whenever that date moves. Deliberately does not change the status: a date
 * can be promised or corrected at any point in the ladder.
 */
export async function updateRefundPlan(
  user: CurrentUser,
  requestId: string,
  input: { expected_refund_at?: string | null; delay_reason?: string | null }
) {
  requireAdmin(user);

  const existing = await selectReturnRequestById(requestId);
  if (!existing) throw notFound("Return request not found.");

  // Moving a date the customer has already been given without saying why is
  // exactly the silence this tracker exists to remove.
  const movingAnExistingDate =
    Boolean(existing.expected_refund_at) &&
    Boolean(input.expected_refund_at) &&
    input.expected_refund_at !== existing.expected_refund_at;

  if (movingAnExistingDate && !(input.delay_reason ?? "").trim()) {
    throw badRequest(
      "Explain the delay: the customer has already been given the earlier date."
    );
  }

  return updateReturnRequestService(requestId, {
    expected_refund_at: input.expected_refund_at ?? null,
    delay_reason: input.delay_reason?.trim() || null,
  });
}

/** The customer disagrees with a decline and asks for a second look. */
export async function requestReturnReview(
  user: CurrentUser,
  requestId: string,
  note: string
) {
  const existing = await selectReturnRequestById(requestId);
  if (!existing || existing.customer_id !== user.id) {
    throw notFound("Return request not found.");
  }
  if (existing.status !== "declined" && existing.status !== "more_info_needed") {
    throw conflict("Another review can only be requested after a decision.");
  }
  if (existing.review_requested_at) {
    throw conflict("We are already looking at this again.");
  }

  return updateReturnRequestService(requestId, {
    review_requested_at: new Date().toISOString(),
    review_request_note: note.trim(),
    // Back into the queue as work for staff, not as a closed decision.
    status: "requested",
  });
}

export async function resolveOrderRequest(
  user: CurrentUser,
  id: string,
  input: {
    request_type: "cancellation" | "return";
    decision: "approve" | "reject";
    admin_note?: string | null;
  }
) {
  requireAdmin(user);
  const existing = await selectOrderById(user, id);
  if (!existing) return null;

  try {
    await resolveOrderActionRpc({
      actor_id: user.id,
      order_id: id,
      request_type: input.request_type,
      decision: input.decision,
      admin_note: input.admin_note ?? null,
    });
  } catch (error) {
    throw mapOrderLifecycleError(error);
  }

  // Approving a customer's cancellation restocks the database inside
  // resolve_order_action(); mirror that into the workbook.
  if (input.request_type === "cancellation" && input.decision === "approve") {
    await restoreSheetStockForCancelledOrder(user.id, existing);
  }

  const updated = await selectOrderById(user, id);
  return updated ? orderResponse(updated) : null;
}

function mapOrderLifecycleError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("ORDER_NOT_FOUND")) return notFound("Order not found.");
  if (message.includes("CANCELLATION_NOT_ALLOWED")) {
    return conflict(
      "Cancellation is only available while an order is pending or confirmed."
    );
  }
  if (message.includes("RETURN_NOT_ALLOWED")) {
    return conflict("A return can only be requested after delivery.");
  }
  if (message.includes("RETURN_WINDOW_EXPIRED")) {
    return conflict("The 7-day return request window has expired.");
  }
  if (message.includes("INVALID_RETURN_REASON")) {
    return badRequest("Choose a valid return reason.");
  }
  if (message.includes("INVALID_PICKUP_METHOD")) {
    return badRequest("Choose courier pickup or store drop-off.");
  }
  if (message.includes("PICKUP_ADDRESS_REQUIRED")) {
    return badRequest("Enter the address where the courier should collect the item.");
  }
  if (message.includes("ADMIN_CANCELLATION_NOT_ALLOWED")) {
    return conflict("Only pending or confirmed orders can be cancelled by an administrator.");
  }
  if (message.includes("RETURN_NOT_APPROVED")) {
    return conflict("Approve the return before scheduling pickup.");
  }
  if (message.includes("PICKUP_DATE_REQUIRED")) {
    return badRequest("Choose a pickup or drop-off date.");
  }
  if (message.includes("RETURN_NOT_READY_FOR_RECEIPT")) {
    return conflict("This return is not ready to be marked as received.");
  }
  if (message.includes("INSPECTION_DECISION_REQUIRED")) {
    return badRequest("Record whether the returned item can be restocked.");
  }
  if (message.includes("RETURN_NOT_RECEIVED")) {
    return conflict("Inspect and receive the returned item before recording a refund.");
  }
  if (message.includes("INVALID_REFUND_METHOD")) {
    return badRequest("Choose a valid refund method.");
  }
  if (message.includes("INVALID_REFUND_AMOUNT")) {
    return badRequest("Refund amount must be between 0 and the order total.");
  }
  if (message.includes("REQUEST_ALREADY_PENDING")) {
    return conflict("This request is already waiting for administrator review.");
  }
  if (message.includes("REQUEST_NOT_PENDING")) {
    return conflict("This request is no longer waiting for review.");
  }

  return error instanceof Error
    ? error
    : new Error("Unable to update the order request.");
}

const MAX_SUPPORT_MESSAGE_LENGTH = 1000;

// Matches the `support-uploads` bucket, which rejects anything else anyway.
const SUPPORT_ATTACHMENT_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_SUPPORT_ATTACHMENT_BYTES = 5 * 1024 * 1024;

/** `allowEmpty` is for messages that carry a photo or a product reference
 *  instead of words -- sending just a picture is a normal thing to do. */
function cleanSupportMessage(value: unknown, allowEmpty = false) {
  const message = typeof value === "string" ? value.trim() : "";

  if (!message && allowEmpty) return "";

  if (!message || message.length > MAX_SUPPORT_MESSAGE_LENGTH) {
    throw badRequest(
      `Message must be between 1 and ${MAX_SUPPORT_MESSAGE_LENGTH} characters.`
    );
  }

  return message;
}

function supportConversationResponse(conversation: SupportConversationRow) {
  return {
    id: conversation.id,
    customer_id: conversation.customer_id,
    assigned_admin_id: conversation.assigned_admin_id,
    status: conversation.status,
    last_message_at: conversation.last_message_at,
    last_message_preview: conversation.last_message_preview,
    last_sender_role: conversation.last_sender_role,
    needs_reply: conversation.last_sender_role === "customer",
    created_at: conversation.created_at,
    customer: {
      email: conversation.profiles?.email ?? "Unknown customer",
      full_name: conversation.profiles?.full_name ?? null,
    },
  };
}

function supportMessageResponse(message: SupportMessageRow) {
  return {
    id: message.id,
    conversation_id: message.conversation_id,
    sender_id: message.sender_id,
    sender_role: message.sender_role,
    body: message.body,
    created_at: message.created_at,
    attachment_url: null as string | null,
    attachment_type: message.attachment_type ?? null,
    product: null as
      | { id: number; name: string; brand: string; price: number; image: string }
      | null,
  };
}

/**
 * Resolves a whole conversation at once: one product query for every referenced
 * product, and the attachment signatures in parallel.
 *
 * Chat photos live in a PRIVATE bucket, so the browser never receives an object
 * path -- only a short-lived signed URL it can actually load.
 */
async function supportMessagesResponse(messages: SupportMessageRow[]) {
  const productIds = [
    ...new Set(
      messages
        .map((message) => message.product_id)
        .filter((id): id is number => typeof id === "number")
    ),
  ];

  const [productRows, signedUrls] = await Promise.all([
    productIds.length ? selectProductsByIdsService(productIds) : Promise.resolve([]),
    Promise.all(
      messages.map((message) =>
        message.attachment_path
          ? createSupportAttachmentSignedUrl(message.attachment_path)
          : Promise.resolve(null)
      )
    ),
  ]);

  const productsById = new Map(
    productRows.map((row) => {
      const product = mapProductRow(row);
      return [
        product.id,
        {
          id: product.id,
          name: product.name,
          brand: product.brand,
          price: product.price,
          image: product.image,
        },
      ] as const;
    })
  );

  return messages.map((message, index) => ({
    ...supportMessageResponse(message),
    attachment_url: signedUrls[index],
    product:
      typeof message.product_id === "number"
        ? productsById.get(message.product_id) ?? null
        : null,
  }));
}

function mapSupportError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (
    message.includes("support_conversations") ||
    message.includes("support_messages")
  ) {
    // The original table forbade an empty body, which blocks photo-only
    // messages. Say exactly which file fixes it instead of a generic 500.
    if (message.includes("support_messages_body_check")) {
      return serviceUnavailable(
        "Sending a photo without text is blocked by an old database rule. Run supabase/migrations/2026-09-13-support-message-empty-body.sql in the Supabase SQL Editor."
      );
    }

    if (
      message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("Could not find")
    ) {
      return serviceUnavailable(
        "Live chat database setup is incomplete. Run the files in supabase/migrations/ in the Supabase SQL Editor."
      );
    }
  }

  return error instanceof Error
    ? error
    : new Error("Unable to load live support chat.");
}

export async function getCustomerSupportConversation(user: CurrentUser) {
  if (user.role === "admin") {
    throw forbidden("Administrators must use the Live Chat admin inbox.");
  }

  try {
    const conversation = await selectSupportConversationByCustomer(user.id);

    if (!conversation) {
      return { conversation: null, messages: [] };
    }

    const [messages] = await Promise.all([
      selectSupportMessages(conversation.id),
      updateSupportConversation(conversation.id, {
        customer_last_read_at: new Date().toISOString(),
      }),
    ]);

    return {
      conversation: supportConversationResponse(conversation),
      messages: await supportMessagesResponse(messages),
    };
  } catch (error) {
    throw mapSupportError(error);
  }
}

export async function sendCustomerSupportMessage(
  user: CurrentUser,
  value: unknown,
  extras: {
    attachment?: { bytes: ArrayBuffer; contentType: string; fileName: string } | null;
    productId?: number | null;
  } = {}
) {
  if (user.role === "admin") {
    throw forbidden("Administrators must use the Live Chat admin inbox.");
  }

  const { attachment = null, productId = null } = extras;
  // A photo or a product reference is content in its own right, so the text
  // may be empty when one of them is present.
  const body = cleanSupportMessage(value, Boolean(attachment || productId));

  if (attachment) {
    if (!SUPPORT_ATTACHMENT_TYPES.has(attachment.contentType)) {
      throw badRequest("Attach a JPG, PNG or WebP photo.");
    }

    if (attachment.bytes.byteLength <= 0 ||
        attachment.bytes.byteLength > MAX_SUPPORT_ATTACHMENT_BYTES) {
      throw badRequest("The photo must be 5 MB or smaller.");
    }
  }

  if (productId !== null && (!Number.isInteger(productId) || productId <= 0)) {
    throw badRequest("That product is not valid.");
  }

  try {
    const conversation = await ensureSupportConversation(user.id);

    if (!conversation) {
      throw new Error("Unable to create a support conversation.");
    }

    let attachmentPath: string | null = null;

    if (attachment) {
      const safeName =
        attachment.fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-100) || "photo";
      // Scoped by account id so one customer's uploads are trivially separable.
      attachmentPath = `${user.id}/${randomUUID()}-${safeName}`;
      await uploadSupportAttachment(
        attachmentPath,
        attachment.bytes,
        attachment.contentType
      );
    }

    await insertSupportMessage({
      conversation_id: conversation.id,
      sender_id: user.id,
      sender_role: "customer",
      body,
      attachment_path: attachmentPath,
      attachment_type: attachment?.contentType ?? null,
      product_id: productId,
    });

    return getCustomerSupportConversation(user);
  } catch (error) {
    throw mapSupportError(error);
  }
}

// ---------------------------------------------------------------------------
// Administrator presence ("online" / "back in 20 minutes")
// ---------------------------------------------------------------------------

const OFFLINE_PRESENCE = {
  status: "offline" as AdminPresenceRow["status"],
  message: null as string | null,
  back_at: null as string | null,
  updated_at: null as string | null,
};

/** Readable by anyone, including signed-out visitors: the storefront shows
 *  whether anybody is there BEFORE a customer starts typing. Falls back to
 *  "offline" when the migration has not been run, rather than erroring. */
export async function getAdminPresence() {
  try {
    const row = await selectAdminPresenceService();

    if (!row) return OFFLINE_PRESENCE;

    return {
      status: row.status,
      message: row.message,
      back_at: row.back_at,
      updated_at: row.updated_at,
    };
  } catch {
    return OFFLINE_PRESENCE;
  }
}

export async function setAdminPresence(
  user: CurrentUser,
  input: {
    status: AdminPresenceRow["status"];
    message?: string;
    back_in_minutes?: number | null;
  }
) {
  requireAdmin(user);

  const backAt = input.back_in_minutes
    ? new Date(Date.now() + input.back_in_minutes * 60_000).toISOString()
    : null;

  const row = await updateAdminPresenceService({
    status: input.status,
    message: input.message?.trim() || null,
    back_at: backAt,
    updated_by: user.id,
  });

  if (!row) {
    throw serviceUnavailable(
      "Admin presence is not set up yet. Run supabase/migrations/2026-09-13-support-attachments-and-admin-presence.sql in the Supabase SQL Editor."
    );
  }

  return {
    status: row.status,
    message: row.message,
    back_at: row.back_at,
    updated_at: row.updated_at,
  };
}

export async function listAdminSupportConversations(user: CurrentUser) {
  requireAdmin(user);

  try {
    return (await selectSupportConversations()).map(
      supportConversationResponse
    );
  } catch (error) {
    throw mapSupportError(error);
  }
}

export async function getAdminSupportConversation(
  user: CurrentUser,
  conversationId: string
) {
  requireAdmin(user);

  try {
    const conversation = await selectSupportConversationById(conversationId);

    if (!conversation) {
      throw notFound("Support conversation not found.");
    }

    const [messages] = await Promise.all([
      selectSupportMessages(conversation.id),
      updateSupportConversation(conversation.id, {
        admin_last_read_at: new Date().toISOString(),
      }),
    ]);

    return {
      conversation: supportConversationResponse(conversation),
      messages: await supportMessagesResponse(messages),
    };
  } catch (error) {
    throw mapSupportError(error);
  }
}

export async function sendAdminSupportMessage(
  user: CurrentUser,
  conversationId: string,
  value: unknown
) {
  requireAdmin(user);
  const body = cleanSupportMessage(value);

  try {
    const conversation = await selectSupportConversationById(conversationId);

    if (!conversation) {
      throw notFound("Support conversation not found.");
    }

    await insertSupportMessage({
      conversation_id: conversation.id,
      sender_id: user.id,
      sender_role: "admin",
      body,
    });

    if (!conversation.assigned_admin_id) {
      await updateSupportConversation(conversation.id, {
        assigned_admin_id: user.id,
      });
    }

    return getAdminSupportConversation(user, conversation.id);
  } catch (error) {
    throw mapSupportError(error);
  }
}

export async function setAdminSupportConversationStatus(
  user: CurrentUser,
  conversationId: string,
  status: SupportConversationStatus
) {
  requireAdmin(user);

  try {
    const existing = await selectSupportConversationById(conversationId);

    if (!existing) {
      throw notFound("Support conversation not found.");
    }

    const updated = await updateSupportConversation(conversationId, {
      status,
      assigned_admin_id: existing.assigned_admin_id ?? user.id,
    });

    await insertAuditLog({
      actor_id: user.id,
      action: `support.${status}`,
      target_type: "support_conversation",
      target_id: conversationId,
      previous_data: { status: existing.status },
      new_data: { status },
    });

    return updated ? supportConversationResponse(updated) : null;
  } catch (error) {
    throw mapSupportError(error);
  }
}

const ORDER_STATUSES: OrderRow["status"][] = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
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
    countCustomers(),
    countOrders(user.accessToken),
    countOrders(user.accessToken, "pending"),
    selectOrderStats(user.accessToken),
    selectOrderItemStats(user.accessToken),
    selectOrders(user, { limit: 5 }),
  ]);

  const activeOrders = orderStats.filter(
    (order) => order.status !== "cancelled" && order.status !== "returned"
  );
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
