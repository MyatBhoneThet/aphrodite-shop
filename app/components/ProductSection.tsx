"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { Product, UserRole } from "../data/products";
import { groupProductVariants } from "../lib/product-variants";
import { useLanguage } from "../lib/language";
import ProductCard from "./ProductCard";
import type { DeliveryEstimate } from "../lib/delivery-estimate";

const DEFAULT_PAGE_SIZE = 8;

type Props = {
  title: string;
  products: Product[];
  userRole: UserRole;
  viewAllHref?: string;
  viewAllLabel?: string;
  deliveryEstimate?: DeliveryEstimate | null;
  itemsPerPage?: number;
  showPagination?: boolean;
};

export default function ProductSection({
  title,
  products,
  userRole,
  viewAllHref,
  viewAllLabel,
  deliveryEstimate = null,
  itemsPerPage = DEFAULT_PAGE_SIZE,
  showPagination = true,
}: Props) {
  const { t, language } = useLanguage();
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const sectionRef = useRef<HTMLElement>(null);
  // Versions of one model (e.g. 256 GB / 512 GB) share a single card.
  const groups = useMemo(() => groupProductVariants(products), [products]);
  const totalPages = Math.max(1, Math.ceil(groups.length / itemsPerPage));
  const currentPage = Math.min(page, totalPages);
  const visibleGroups = showPagination
    ? groups.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    : groups.slice(0, itemsPerPage);

  function changePage(nextPage: number) {
    const validPage = Math.min(totalPages, Math.max(1, nextPage));
    setPage(validPage);
    setPageInput(String(validPage));
    sectionRef.current?.scrollIntoView({ block: "start" });
  }

  function submitPage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requestedPage = Number.parseInt(pageInput, 10);
    changePage(Number.isFinite(requestedPage) ? requestedPage : currentPage);
  }

  return (
    <section ref={sectionRef} className="mx-auto max-w-7xl scroll-mt-24 px-5 pb-16">
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
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {visibleGroups.map(({ product, model, options }) => (
            <ProductCard
              key={product.id}
              product={product}
              userRole={userRole}
              model={model}
              options={options}
              deliveryEstimate={deliveryEstimate}
            />
          ))}
        </div>
      )}

      {showPagination && groups.length > 0 && (
        <nav aria-label={`${title} pagination`} className="mt-8 flex flex-wrap items-center justify-end gap-3">
          <form onSubmit={submitPage} className="mr-2 flex items-center gap-2 text-sm font-medium text-zinc-600">
            <label htmlFor={`${title}-page`}>{language === "en" ? "Page" : "စာမျက်နှာ"}</label>
            <input
              id={`${title}-page`}
              type="number"
              min={1}
              max={totalPages}
              inputMode="numeric"
              value={pageInput}
              onChange={(event) => setPageInput(event.target.value)}
              onBlur={() => {
                const requestedPage = Number.parseInt(pageInput, 10);
                changePage(Number.isFinite(requestedPage) ? requestedPage : currentPage);
              }}
              aria-label={language === "en" ? "Page number" : "စာမျက်နှာ နံပါတ်"}
              className="w-16 rounded-lg border border-zinc-300 bg-white px-2 py-2 text-center font-bold text-zinc-950 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
            />
            <span aria-live="polite" aria-atomic="true">
              {language === "en" ? `of ${totalPages}` : `/ ${totalPages}`}
            </span>
          </form>
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => changePage(currentPage - 1)}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold transition enabled:hover:border-red-500 enabled:hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {language === "en" ? "← Previous" : "← နောက်သို့"}
          </button>
          <button
            type="button"
            disabled={currentPage === totalPages}
            onClick={() => changePage(currentPage + 1)}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold transition enabled:hover:border-red-500 enabled:hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {language === "en" ? "Next →" : "ရှေ့သို့ →"}
          </button>
        </nav>
      )}
    </section>
  );
}
