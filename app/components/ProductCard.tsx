"use client";

import Link from "next/link";
import ProductPrice from "./ProductPrice";
import { effectiveProductPrice } from "../lib/promotions";
import type { Product, UserRole } from "../data/products";
import type { ProductVariantOption } from "../lib/product-variants";
import type { DeliveryEstimate } from "../lib/delivery-estimate";
import DeliveryEstimateBadge from "./DeliveryEstimateBadge";

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
};

export default function ProductCard({ product, model, options = [], deliveryEstimate = null }: Props) {
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

  return (
    <article className="h-full overflow-hidden rounded-2xl border border-zinc-100 bg-white text-left shadow-sm transition hover:-translate-y-1 hover:border-red-200 hover:shadow-lg">
      <Link
        href={`/products/${product.id}`}
        className="group flex h-full flex-col rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-600"
      >
        <div className="aspect-square w-full overflow-hidden bg-white">
          <img
            src={product.image}
            alt={name}
            loading="lazy"
            className="h-full w-full object-contain p-6 transition-transform duration-300 group-hover:scale-105"
          />
        </div>
        <div className="flex flex-1 flex-col p-5 pt-4">
          <h3 className="line-clamp-2 min-h-14 text-lg font-medium leading-7 text-zinc-800 group-hover:text-red-600">
            {name}
          </h3>
          <div className="mt-4">
            <ProductPrice
              price={minPrice}
              priceMax={maxPrice}
              regularPrice={minRegularPrice}
              regularPriceMax={maxRegularPrice}
            />
          </div>
          <DeliveryEstimateBadge estimate={deliveryEstimate} compact />
        </div>
      </Link>
    </article>
  );
}
