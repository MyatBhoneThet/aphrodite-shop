"use client";

import { formatCurrency, formatProductPrice } from "../lib/format";
import { discountPercent } from "../lib/promotions";
import { useLanguage } from "../lib/language";

/** A price and its matching regular price must always refer to one variant. */
export default function ProductPrice({ price, regularPrice, priceMax, regularPriceMax, from = false, large = false, compactMobile = false }: {
  price: number;
  regularPrice: number;
  priceMax?: number;
  regularPriceMax?: number;
  from?: boolean;
  large?: boolean;
  compactMobile?: boolean;
}) {
  const { t } = useLanguage();
  const highestPrice = priceMax ?? price;
  const highestRegularPrice = regularPriceMax ?? regularPrice;
  const discounted = price > 0 && (
    price < regularPrice || highestPrice < highestRegularPrice
  );
  const percent = discountPercent(regularPrice, price);
  const formattedPrice = highestPrice > price
    ? `${formatCurrency(price)} – ${formatCurrency(highestPrice)}`
    : formatCurrency(price);
  const formattedRegularPrice = highestRegularPrice > regularPrice
    ? `${formatCurrency(regularPrice)} – ${formatCurrency(highestRegularPrice)}`
    : formatCurrency(regularPrice);

  return (
    <div className="@container">
      {from && <p className="mb-1 text-sm font-semibold text-zinc-500">{t("product.from")}</p>}
      {discounted ? (
        <div className="inline-flex max-w-full flex-col items-start gap-1">
          {percent > 0 && (
            <span className={`self-end rounded-full bg-red-100 font-bold text-red-600 ${compactMobile ? "px-1 py-0.5 text-[9px] sm:px-3 sm:py-1 sm:text-sm" : "px-3 py-1 text-sm"}`}>
              -{percent}%
            </span>
          )}
          <span className={`font-bold tracking-tight text-red-600 ${compactMobile ? "break-words text-[10px] leading-tight sm:text-xl" : large ? "text-xl sm:text-3xl" : "text-lg sm:text-xl"}`}>
            {formattedPrice}
          </span>
          <span className={`${compactMobile ? "break-words text-[9px] sm:text-sm" : large ? "text-sm sm:text-base" : "text-xs sm:text-sm"} font-medium text-zinc-950`}>
            {t("product.originalPrice")}: <s>{formattedRegularPrice}</s>
          </span>
        </div>
      ) : (
        <p className={`font-bold tracking-tight text-red-600 ${compactMobile ? "break-words text-[10px] leading-tight sm:text-xl" : large ? "text-xl sm:text-3xl" : "text-lg sm:text-xl"}`}>
          {highestPrice > price ? formattedPrice : formatProductPrice(price)}
        </p>
      )}
    </div>
  );
}
