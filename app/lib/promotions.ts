import type { Product } from "../data/products";

/** Stored with the product's full_specs so sheet sync needs no schema change. */
export type Promotion = {
  price: number;
  startsAt: string | null;
  endsAt: string | null;
};

const MYANMAR_OFFSET_MS = 390 * 60_000;

/** Sheets serials and timezone-less inputs are wall-clock times in Myanmar. */
export function parsePromotionDate(value: unknown): string | null | undefined {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 1 || value > 2958465) return undefined;
    return new Date(Date.UTC(1899, 11, 30) + Math.round(value * 86_400_000) - MYANMAR_OFFSET_MS).toISOString();
  }
  const text = String(value).trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?(Z|[+-]\d{2}:\d{2})?$/.exec(text);
  if (!match) return undefined;
  const [, year, month, day, hour = "00", minute = "00", second = "00", zone = "+06:30"] = match;
  const local = new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute, +second));
  if (local.getUTCFullYear() !== +year || local.getUTCMonth() !== +month - 1 || local.getUTCDate() !== +day || +hour > 23 || +minute > 59 || +second > 59) return undefined;
  const timestamp = Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second}${zone}`);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

export function activePromotion(retailPrice: number, value: unknown, now = new Date()): Promotion | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Partial<Promotion>;
  if (!Number.isFinite(retailPrice) || retailPrice <= 0 || typeof p.price !== "number" || !Number.isInteger(p.price) || p.price <= 0 || p.price >= retailPrice || p.price > 2147483647) return null;
  const start = p.startsAt == null ? null : Date.parse(p.startsAt);
  const end = p.endsAt == null ? null : Date.parse(p.endsAt);
  if ((start !== null && !Number.isFinite(start)) || (end !== null && !Number.isFinite(end)) || (start !== null && end !== null && end <= start)) return null;
  if ((start !== null && now.getTime() < start) || (end !== null && now.getTime() >= end)) return null;
  return { price: p.price, startsAt: p.startsAt ?? null, endsAt: p.endsAt ?? null };
}

export function effectiveProductPrice(product: Pick<Product, "price"> & { fullSpecs?: Product["fullSpecs"] }, now = new Date()) {
  return activePromotion(product.price, product.fullSpecs?.promotion, now)?.price ?? product.price;
}

export function discountPercent(regular: number, sale: number) {
  // Round down so the badge never promises a larger saving than the price.
  return regular > 0 && sale > 0 && sale < regular ? Math.floor((regular - sale) / regular * 100 + 1e-9) : 0;
}
