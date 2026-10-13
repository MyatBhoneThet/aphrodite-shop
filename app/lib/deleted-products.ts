/**
 * "Recently deleted" products.
 *
 * Deleting a product no longer removes its row (or its Google Sheet row). It is
 * hidden for 30 days, using the same `full_specs.archived` mark that already
 * keeps products out of every list, plus a `full_specs.deleted` note that says
 * who deleted it, when, and what stock it had so it can be restored exactly.
 * The scheduled sync later erases products whose 30 days are up.
 *
 * Everything here is pure so the rules can be tested without a database.
 */
export const DELETED_PRODUCT_DAYS = 30;

const DAY_MS = 86_400_000;

export type DeletedMarker = {
  /** ISO time the product was deleted. */
  at: string;
  /** The admin who deleted it. */
  by: string | null;
  /** What the stock label and quantity were, so a restore puts them back. */
  stock: string;
  stock_quantity: number;
  /** It was already off the website (removed from the sheet) before it was deleted. */
  was_archived: boolean;
};

type Specs = Record<string, unknown>;

function asSpecs(value: unknown): Specs {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Specs) : {};
}

export function readDeletedMarker(fullSpecs: unknown): DeletedMarker | null {
  const raw = asSpecs(fullSpecs).deleted;
  if (!raw || typeof raw !== "object") return null;
  const marker = raw as Record<string, unknown>;
  if (typeof marker.at !== "string" || Number.isNaN(Date.parse(marker.at))) return null;

  const quantity = marker.stock_quantity;
  return {
    at: marker.at,
    by: typeof marker.by === "string" ? marker.by : null,
    stock: typeof marker.stock === "string" ? marker.stock : "Out of Stock",
    stock_quantity: typeof quantity === "number" && Number.isInteger(quantity) && quantity >= 0 ? quantity : 0,
    was_archived: marker.was_archived === true,
  };
}

/** The specs a product carries while it sits in Recently deleted. */
export function deletedSpecs(fullSpecs: unknown, marker: DeletedMarker): Specs {
  return { ...asSpecs(fullSpecs), archived: true, deleted: marker };
}

/** The specs after a restore: the deleted note goes, and so does the hidden mark unless it was there before. */
export function restoredSpecs(fullSpecs: unknown, marker: DeletedMarker): Specs {
  const { deleted: _deleted, archived: _archived, ...rest } = asSpecs(fullSpecs);
  void _deleted;
  void _archived;
  return marker.was_archived ? { ...rest, archived: true } : rest;
}

/** Erased from the shop but kept for old orders: still hidden, no longer restorable. */
export function keptHiddenSpecs(fullSpecs: unknown): Specs {
  const { deleted: _deleted, ...rest } = asSpecs(fullSpecs);
  void _deleted;
  return { ...rest, archived: true };
}

export function purgeDate(marker: Pick<DeletedMarker, "at">) {
  return new Date(Date.parse(marker.at) + DELETED_PRODUCT_DAYS * DAY_MS);
}

export function isPurgeDue(marker: Pick<DeletedMarker, "at">, now = new Date()) {
  return now.getTime() >= purgeDate(marker).getTime();
}

/** Whole days left to restore; 0 on the last day. */
export function daysLeft(marker: Pick<DeletedMarker, "at">, now = new Date()) {
  return Math.max(0, Math.ceil((purgeDate(marker).getTime() - now.getTime()) / DAY_MS));
}

export function stockLabel(quantity: number) {
  return quantity > 0 ? "In Stock" : "Out of Stock";
}
