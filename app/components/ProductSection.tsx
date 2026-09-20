"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Product, UserRole } from "../data/products";
import { groupProductVariants } from "../lib/product-variants";
import { useLanguage } from "../lib/language";
import ProductCard from "./ProductCard";

const PAGE_SIZE = 12;

type Props = {
  title: string;
  products: Product[];
  userRole: UserRole;
  initialVisibleCount?: number;
  pageSize?: number;
  showLoadMore?: boolean;
  viewAllHref?: string;
  viewAllLabel?: string;
};

export default function ProductSection({
  title,
  products,
  userRole,
  initialVisibleCount = PAGE_SIZE,
  pageSize = PAGE_SIZE,
  showLoadMore = true,
  viewAllHref,
  viewAllLabel,
}: Props) {
  const { t } = useLanguage();
  const [visibleCount, setVisibleCount] = useState(initialVisibleCount);
  // Versions of one model (e.g. 256 GB / 512 GB) share a single card.
  const groups = useMemo(() => groupProductVariants(products), [products]);
  const visibleGroups = groups.slice(0, visibleCount);

  return (
    <section className="mx-auto max-w-7xl px-5 pb-16">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-5 border-b border-zinc-200 pb-5">
        <div>
          <h2 className="text-3xl font-black sm:text-4xl">{title}</h2>
          <p className="mt-2 text-sm text-zinc-500">
            {groups.length === 1
              ? t("section.countOne")
              : t("section.count", { count: groups.length.toLocaleString() })}
          </p>
        </div>

        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="group inline-flex shrink-0 items-center gap-2 rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm font-bold transition hover:border-red-500 hover:bg-red-50 hover:text-red-700"
          >
            {viewAllLabel ?? t("common.viewAll")}
            <span
              aria-hidden="true"
              className="text-lg transition-transform group-hover:translate-x-1"
            >
              →
            </span>
          </Link>
        )}
      </div>

      {products.length === 0 ? (
        <p className="text-center text-zinc-500">{t("section.noProducts")}</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {visibleGroups.map(({ product, model, options }) => (
            <ProductCard
              key={product.id}
              product={product}
              userRole={userRole}
              model={model}
              options={options}
            />
          ))}
        </div>
      )}

      {showLoadMore && visibleCount < groups.length && (
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => setVisibleCount((count) => count + pageSize)}
            className="rounded-full border border-zinc-300 bg-white px-6 py-3 font-bold transition hover:border-red-500 hover:text-red-600"
          >
            {t("section.showMore", { count: Math.min(pageSize, groups.length - visibleCount) })}
          </button>
        </div>
      )}
    </section>
  );
}
