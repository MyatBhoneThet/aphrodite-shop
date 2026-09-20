"use client";

import Link from "next/link";
import ProductPrice from "./ProductPrice";
import { effectiveProductPrice } from "../lib/promotions";
import type { Product, UserRole } from "../data/products";
import { useLanguage } from "../lib/language";
import { getProductSpecifications } from "../lib/product-specifications";
import { formatCurrency } from "../lib/format";
import type { ProductVariantOption } from "../lib/product-variants";

type Props = {
  // The API only attaches `tiers` for approved wholesale viewers; prices
  // themselves are always calculated server-side.
  product: Product & { tiers?: { minQuantity: number; unitPrice: number }[] };
  userRole: UserRole;
  /** Model name shown instead of the version's own name. */
  model?: string | null;
  /** Other versions of the same model (e.g. 256 GB / 512 GB), one card for all. */
  options?: ProductVariantOption[];
};

export default function ProductCard({ product, model, options = [] }: Props) {
  const { t, text } = useLanguage();
  const hasVersions = options.length > 1;
  const pricedOptions = options.filter((option) => option.price > 0);
  const cheapest = [...pricedOptions].sort((a, b) => a.price - b.price)[0];
  const pricesDiffer = new Set(pricedOptions.map((option) => option.price)).size > 1;
  const displayPrice = hasVersions && cheapest ? cheapest.price : effectiveProductPrice(product);
  const regularPrice = hasVersions && cheapest ? cheapest.regularPrice ?? cheapest.price : product.price;
  const inStock = hasVersions
    ? options.some((option) => option.stock === "In Stock")
    : product.stock === "In Stock";
  const bestTier = product.tiers?.[0];
  const specification = getProductSpecifications(product);
  const summaryRows = specification.rows
    .filter(
      (row) =>
        !["Brand", "Category", "Availability", "Product details"].includes(
          row.label
        ) &&
        // The version buttons already show what differs.
        !options.some((option) => option.label.includes(row.value))
    )
    .slice(0, 3);

  return (
    <article className="flex h-full flex-col rounded-[2rem] border border-zinc-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:border-red-200 hover:shadow-xl">
      <Link href={`/products/${product.id}`} className="block">
        <div className="relative h-64 overflow-hidden rounded-[1.5rem] bg-zinc-50">
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-contain p-6"
          />

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white px-4 py-2 text-xs font-semibold shadow">
            {t("product.viewDetails")}
          </div>
        </div>
      </Link>

      <Link href={`/products/${product.id}`} className="mt-5">
        <h3 className="min-h-14 line-clamp-2 text-xl font-bold hover:text-red-600">
          {hasVersions && model ? model : product.name}
        </h3>
      </Link>

      <p className="mt-1 text-sm text-zinc-500">
        {product.brand} • {text(product.category)}
      </p>

      {hasVersions && (
        <div className="mt-3 flex flex-wrap gap-2">
          {options.map((option) => (
            <Link
              key={option.id}
              href={`/products/${option.id}`}
              className={`rounded-full border px-3 py-1 text-xs font-bold transition hover:border-red-500 hover:text-red-600 ${
                option.stock === "In Stock"
                  ? "border-zinc-300 text-zinc-800"
                  : "border-zinc-200 text-zinc-400 line-through"
              }`}
            >
              {option.label}
            </Link>
          ))}
        </div>
      )}

      <p
        className={`mt-3 text-sm font-bold ${
          inStock ? "text-green-600" : "text-red-600"
        }`}
      >
        {inStock ? t("product.inStock") : t("product.outOfStock")}
      </p>

      <div className="mt-4">
        <ProductPrice price={displayPrice} regularPrice={regularPrice} from={hasVersions && pricesDiffer} />
      </div>

      {displayPrice > 0 && bestTier && bestTier.unitPrice < displayPrice && (
        <p className="mt-1 text-xs font-semibold text-red-600">
          {t("product.wholesaleFrom", {
            price: formatCurrency(bestTier.unitPrice),
            min: bestTier.minQuantity,
          })}
        </p>
      )}

      {summaryRows.length > 0 ? (
        <dl className="mt-4 space-y-2 text-left text-sm">
          {summaryRows.map((row) => (
            <div key={row.label} className="rounded-xl bg-white p-3">
              <dt className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                {text(row.label)}
              </dt>
              <dd className="mt-1 line-clamp-2 font-semibold">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-4 max-h-24 overflow-hidden rounded-xl bg-white p-3 text-sm">
          {String(product.specs.detail ?? t("product.detailsPending"))}
        </p>
      )}
    </article>
  );
}
