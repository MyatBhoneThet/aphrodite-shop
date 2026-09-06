// Centralized, server-only pricing logic. Cart calculation, product price
// previews, admin previews, and order creation all price lines through
// priceLine() -- do not re-implement tier selection anywhere else (including
// React components; the UI renders the PricingResult it receives).
//
// Rules:
//   * Only an APPROVED wholesale account with an assigned ACTIVE price list
//     gets tier pricing; everyone else (normal, pending, rejected, suspended)
//     pays retail.
//   * The qualifying tier is the active, in-date tier with the highest
//     min_quantity that is <= the line quantity (so quantity 100 qualifies
//     for a min_quantity = 100 tier).
//   * If no tier qualifies, the retail price applies (wholesale discounts
//     are optional per tier -- documented assumption).
//   * Discounts apply per product line; quantities of unrelated products
//     never combine.

export type PriceTierRow = {
  id: string;
  price_list_id: string;
  product_id: number;
  min_quantity: number;
  unit_price: number;
  is_active: boolean;
  effective_from: string | null;
  effective_to: string | null;
};

export type PricingResult = {
  quantity: number;
  retailUnitPrice: number;
  unitPrice: number;
  lineTotal: number;
  savings: number;
  priceListId: string | null;
  tierId: string | null;
  tierMinQuantity: number | null;
  label: string;
  /** Cheapest-entry tier the quantity does NOT yet reach, for "add N more" hints. */
  nextTier: { minQuantity: number; unitPrice: number; unitsAway: number } | null;
  /** True when the account is wholesale-approved but this line hasn't reached any tier. */
  wholesaleEligible: boolean;
};

export function isTierEffective(
  tier: Pick<PriceTierRow, "is_active" | "effective_from" | "effective_to">,
  now: Date
) {
  if (!tier.is_active) return false;

  if (tier.effective_from && new Date(tier.effective_from) > now) return false;
  if (tier.effective_to && new Date(tier.effective_to) <= now) return false;

  return true;
}

export function selectTier(tiers: PriceTierRow[], quantity: number, now = new Date()) {
  let applied: PriceTierRow | null = null;
  let next: PriceTierRow | null = null;

  for (const tier of tiers) {
    if (!isTierEffective(tier, now)) continue;

    if (tier.min_quantity <= quantity) {
      if (!applied || tier.min_quantity > applied.min_quantity) {
        applied = tier;
      }
    } else if (!next || tier.min_quantity < next.min_quantity) {
      next = tier;
    }
  }

  return { applied, next };
}

export function priceLine({
  retailPrice,
  quantity,
  tiers,
  now = new Date(),
}: {
  retailPrice: number;
  quantity: number;
  /** Tiers for THIS product from the customer's assigned active price list;
   *  pass an empty array for customers without wholesale entitlement. */
  tiers: PriceTierRow[];
  now?: Date;
}): PricingResult {
  const safeQuantity = Math.max(1, Math.floor(quantity));
  const wholesaleEligible = tiers.length > 0;
  const { applied, next } = selectTier(tiers, safeQuantity, now);

  const unitPrice = applied ? applied.unit_price : retailPrice;
  const lineTotal = unitPrice * safeQuantity;
  const savings = Math.max(0, (retailPrice - unitPrice) * safeQuantity);

  const label = applied
    ? `Wholesale tier: ${applied.min_quantity}+ units`
    : wholesaleEligible
    ? "Retail price — quantity below wholesale tier"
    : "Retail price";

  return {
    quantity: safeQuantity,
    retailUnitPrice: retailPrice,
    unitPrice,
    lineTotal,
    savings,
    priceListId: applied ? applied.price_list_id : null,
    tierId: applied ? applied.id : null,
    tierMinQuantity: applied ? applied.min_quantity : null,
    label,
    nextTier: next
      ? {
          minQuantity: next.min_quantity,
          unitPrice: next.unit_price,
          unitsAway: next.min_quantity - safeQuantity,
        }
      : null,
    wholesaleEligible,
  };
}

export type WholesaleProfileFields = {
  role: string;
  wholesale_status: string;
  price_list_id: string | null;
  business_verified_at?: string | null;
};

/** Single source of truth for "does this account get wholesale prices?".
 *  Callers must pass a profile freshly loaded from the database -- never one
 *  cached in the browser. */
export function isWholesaleApproved(profile: WholesaleProfileFields) {
  return profile.role === "wholesale" && profile.wholesale_status === "approved" && Boolean(profile.price_list_id) && Boolean(profile.business_verified_at);
}
