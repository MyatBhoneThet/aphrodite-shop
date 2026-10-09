"use client";

import Link from "next/link";
import ProductPrice from "./ProductPrice";
import { effectiveProductPrice } from "../lib/promotions";
import type { Product, UserRole } from "../data/products";
import type { ProductVariantOption } from "../lib/product-variants";
import type { DeliveryEstimate } from "../lib/delivery-estimate";
import DeliveryEstimateBadge from "./DeliveryEstimateBadge";
import { useLanguage } from "../lib/language";

type Props = {
  // The API only attaches `tiers` for approved wholesale viewers; prices
  // themselves are always calculated server-side.
  product: Product & { tiers?: { minQuantity: number; unitPrice: number }[] };
  userRole: UserRole;
  /** Model name shown instead of the version's own name. */
  model?: string | null;
  /** Other versions of the same model (e.g. 256 GB / 512 GB), one card for all. */
  options?: ProductVariantOption[];
  deliveryEstimate?: DeliveryEstimate | null;
  compactMobile?: boolean;
};

export default function ProductCard({ product, model, options = [], deliveryEstimate = null, compactMobile = false }: Props) {
  const { text } = useLanguage();
  const hasVersions = options.length > 1;
  const pricedOptions = options.filter((option) => option.price > 0);
  const prices = pricedOptions.map((option) => option.price);
  const regularPrices = pricedOptions.map((option) => option.regularPrice ?? option.price);
  const minPrice = hasVersions && prices.length ? Math.min(...prices) : effectiveProductPrice(product);
  const maxPrice = hasVersions && prices.length ? Math.max(...prices) : minPrice;
  const minRegularPrice = hasVersions && regularPrices.length
    ? Math.min(...regularPrices)
    : product.price;
  const maxRegularPrice = hasVersions && regularPrices.length
    ? Math.max(...regularPrices)
    : minRegularPrice;
  const name = hasVersions && model ? model : product.name;
  const specificationTags = [
    ["Processor", product.specs.cpu],
    ["RAM", product.specs.ram],
    ["Storage", product.specs.storage],
  ].filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0);

  return (
    <article className={`h-full overflow-hidden border border-zinc-100 bg-white text-left shadow-sm transition hover:-translate-y-1 hover:border-red-200 hover:shadow-lg ${compactMobile ? "rounded-xl sm:rounded-2xl" : "rounded-2xl"}`}>
      <Link
        href={`/products/${product.id}`}
        className="group flex h-full flex-col rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-600"
      >
        <div className="aspect-square w-full overflow-hidden bg-white">
          <img
            src={product.image}
            alt={name}
            loading="lazy"
            className={`h-full w-full object-contain transition-transform duration-300 group-hover:scale-105 ${compactMobile ? "p-1.5 sm:p-6" : "p-3 sm:p-6"}`}
          />
        </div>
        <div className={`flex flex-1 flex-col sm:p-5 sm:pt-4 ${compactMobile ? "p-2" : "p-3"}`}>
          <h3 className={`line-clamp-2 font-medium text-zinc-800 group-hover:text-red-600 sm:min-h-14 sm:text-lg sm:leading-7 ${compactMobile ? "min-h-8 text-[11px] leading-4" : "min-h-10 text-sm leading-5"}`}>
            {name}
          </h3>
          {specificationTags.length > 0 && (
            <dl className="mt-3 hidden space-y-1.5 text-xs sm:block">
              {specificationTags.map(([label, value]) => (
                <div key={label} className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2">
                  <dt className="font-bold text-zinc-500">{text(label)}</dt>
                  <dd className="truncate text-zinc-700" title={value}>{value}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className={compactMobile ? "mt-2 sm:mt-4" : "mt-4"}>
            <ProductPrice
              price={minPrice}
              priceMax={maxPrice}
              regularPrice={minRegularPrice}
              regularPriceMax={maxRegularPrice}
              compactMobile={compactMobile}
            />
          </div>
          <div className={compactMobile ? "hidden sm:block" : undefined}>
            <DeliveryEstimateBadge estimate={deliveryEstimate} compact />
          </div>
        </div>
      </Link>
    </article>
  );
}
