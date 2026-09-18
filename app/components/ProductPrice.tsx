"use client";

import { formatCurrency, formatProductPrice } from "../lib/format";
import { discountPercent } from "../lib/promotions";
import { useLanguage } from "../lib/language";

/** A price and its matching regular price must always refer to one variant. */
export default function ProductPrice({ price, regularPrice, from = false, large = false }: {
  price: number;
  regularPrice: number;
  from?: boolean;
  large?: boolean;
}) {
  const { t } = useLanguage();
  const discounted = price > 0 && price < regularPrice;
  const percent = discountPercent(regularPrice, price);
  return (
    <div className="@container">
      {from && <p className="mb-1 text-sm font-semibold text-zinc-500">{t("product.from")}</p>}
      {discounted ? (
        <div className="inline-flex max-w-full flex-col gap-3 py-1 font-bold text-[#ff0000]">
          <div className={`flex items-center justify-between gap-4 whitespace-nowrap ${large ? "text-[clamp(0.875rem,5.2cqw,2rem)]" : "text-[clamp(0.75rem,5.2cqw,1.125rem)]"}`}>
            {percent > 0 && <span className="text-[1.65em] font-extrabold leading-none">{percent}%</span>}
            <span className="tracking-tight">{formatCurrency(price)}</span>
          </div>
          <p className={`relative w-fit whitespace-nowrap font-extrabold leading-tight tracking-tight text-black ${large ? "text-[clamp(1.25rem,10cqw,3.5rem)]" : "text-[clamp(1.125rem,10cqw,2rem)]"}`}>
            <span className="sr-only">{t("product.regularPrice")}: </span>
            <s className="no-underline">{formatCurrency(regularPrice)}</s>
            <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible text-[#ff0000]">
              <line x1="1" y1="100" x2="99" y2="0" stroke="currentColor" strokeWidth={large ? 8 : 4} vectorEffect="non-scaling-stroke" />
            </svg>
          </p>
        </div>
      ) : (
        <p className={`font-bold tracking-tight text-zinc-950 ${large ? "text-3xl sm:text-4xl" : "text-2xl"}`}>
          {formatProductPrice(price)}
        </p>
      )}
    </div>
  );
}
