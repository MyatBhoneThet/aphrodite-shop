import { effectiveProductPrice } from "./promotions";
import type { Product } from "../data/products";

/**
 * Written into full_specs by the sheet sync when rows of one model differ
 * only in specs, e.g. a laptop sold with 256 GB or 512 GB (see
 * splitSpecVariants in google-sheets.ts). Each version stays its own product
 * with its own stock; this only tells the website to show them together.
 */
export type ProductVariantInfo = { group: string; model: string; label: string };

export type ProductVariantOption = {
  id: number;
  label: string;
  price: number;
  regularPrice?: number;
  stock: Product["stock"];
};

const GROUP_PATTERN = /^[a-f0-9]{16}$/;
const byLabel = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export function productVariant(
  product: Pick<Product, "fullSpecs">
): ProductVariantInfo | null {
  const value = product.fullSpecs?.variant as Partial<ProductVariantInfo> | undefined;
  if (
    !value ||
    typeof value.group !== "string" ||
    !GROUP_PATTERN.test(value.group) ||
    typeof value.model !== "string" ||
    typeof value.label !== "string"
  ) {
    return null;
  }
  return { group: value.group, model: value.model, label: value.label };
}

export function isSameVariantGroup(
  left: Pick<Product, "fullSpecs">,
  right: Pick<Product, "fullSpecs">
) {
  const a = productVariant(left);
  const b = productVariant(right);
  return Boolean(a && b && a.group === b.group);
}

/** The versions a customer can switch between, smallest first (256 GB before 512 GB). */
export function variantOptions(products: Product[]): ProductVariantOption[] {
  return products
    .flatMap((product) => {
      const variant = productVariant(product);
      if (!variant) return [];
      const price = effectiveProductPrice(product);
      return [{
        id: product.id,
        label: variant.label,
        price,
        ...(price < product.price ? { regularPrice: product.price } : {}),
        stock: product.stock,
      }];
    })
    .sort((left, right) => byLabel.compare(left.label, right.label));
}

export type ProductGroup<T extends Product> = {
  /** The version the card links to: the first one in stock. */
  product: T;
  /** Model name without the version label, when there is more than one version. */
  model: string | null;
  /** Two or more versions, or empty for an ordinary product. */
  options: ProductVariantOption[];
};

const LISTING_METADATA = new Set([
  "gallery", "galleryManagedBy", "photoSource", "promotion", "variant",
  "archived", "deleted", "code", "serialNumber", "sn",
]);

function normalizeListingValue(value: unknown): unknown {
  if (typeof value === "string") return value.trim().toLowerCase().replace(/\s+/g, " ").replace(/\s*[•/]\s*/g, " / ");
  if (Array.isArray(value)) return value.map(normalizeListingValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .filter(([key, entry]) => !LISTING_METADATA.has(key) && entry !== undefined && entry !== null && entry !== "")
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => [key, normalizeListingValue(entry)]));
  }
  return value;
}

/** A display identity only. Serial units and checkout product IDs stay separate. */
export function productListingKey(product: Product): string {
  const scope = [product.sourceSheet ?? "", product.type, product.category, product.brand];
  const variant = productVariant(product);
  return JSON.stringify(normalizeListingValue([
    ...scope,
    variant ? ["variant", variant.group] : [
      "product", product.name || product.id, product.specs, product.fullSpecs,
    ],
  ]));
}

/** One entry per variant model or matching product, within its own category. */
export function groupProductVariants<T extends Product>(products: T[]): ProductGroup<T>[] {
  const entries: T[][] = [];
  const byGroup = new Map<string, T[]>();

  for (const product of products) {
    const key = productListingKey(product);
    const members = byGroup.get(key);
    if (members) {
      members.push(product);
      continue;
    }
    const entry = [product];
    byGroup.set(key, entry);
    entries.push(entry);
  }

  return entries.map((members) => {
    if (members.length < 2) return { product: members[0], model: null, options: [] };

    if (!productVariant(members[0])) {
      const available = members.filter(member => member.stock === "In Stock");
      const candidates = available.length ? available : members;
      const product = [...candidates].sort((a, b) => {
        const aPrice = effectiveProductPrice(a);
        const bPrice = effectiveProductPrice(b);
        return (aPrice > 0 ? aPrice : Infinity) - (bPrice > 0 ? bPrice : Infinity) || a.id - b.id;
      })[0];
      return { product, model: null, options: [] };
    }

    const options = variantOptions(members);
    const chosen = options.find((option) => option.stock === "In Stock") ?? options[0];
    return {
      product: members.find((member) => member.id === chosen.id) ?? members[0],
      model: productVariant(members[0])?.model ?? null,
      options,
    };
  });
}
