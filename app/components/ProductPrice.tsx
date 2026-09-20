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
        // Sizes are em-based off this block so the badge, sale price and
        // original price keep the same proportions in a card and on a detail page.
        <div className={`inline-flex max-w-full flex-col items-stretch leading-none ${large ? "text-[clamp(1.25rem,8cqw,3rem)]" : "text-[clamp(1rem,8cqw,1.5rem)]"}`}>
          {percent > 0 && (
            <span className="mb-[0.1em] self-end rounded-full bg-[#fbdad6] px-[0.7em] py-[0.2em] text-[0.58em] font-extrabold tracking-tight text-[#ea3323]">
              -{percent}%
            </span>
          )}
          <span className="whitespace-nowrap font-extrabold tracking-tight text-[#ea3323]">
            {formatCurrency(price)}
          </span>
          <span className="mt-[0.05em] whitespace-nowrap text-[0.82em] font-bold text-[#adadad] [&>s]:decoration-[0.08em]">
            {t("product.originalPrice")}: <s>{formatCurrency(regularPrice)}</s>
          </span>
        </div>
      ) : (
        <p className={`font-bold tracking-tight text-zinc-950 ${large ? "text-3xl sm:text-4xl" : "text-2xl"}`}>
          {formatProductPrice(price)}
        </p>
      )}
    </div>
  );
}
