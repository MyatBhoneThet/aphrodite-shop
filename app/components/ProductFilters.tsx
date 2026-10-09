"use client";

import { useState } from "react";
import {
  countActiveProductFilters,
  EMPTY_PRODUCT_FILTERS,
  type ProductFilterState,
} from "../lib/product-filters";
import { useLanguage } from "../lib/language";

type Props = {
  brands: string[];
  categories: string[];
  filters: ProductFilterState;
  resultCount: number;
  onChange: (filters: ProductFilterState) => void;
};

const fieldClassName =
  "mt-1.5 min-h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-[11px] outline-none transition duration-200 hover:border-zinc-400 focus:border-red-500 focus:ring-4 focus:ring-red-100 sm:mt-2 sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-sm motion-reduce:transition-none";

export default function ProductFilters({
  brands,
  categories,
  filters,
  resultCount,
  onChange,
}: Props) {
  const { t, text } = useLanguage();
  const [open, setOpen] = useState(false);
  const activeCount = countActiveProductFilters(filters);
  const activeFilters: { key: keyof ProductFilterState; label: string }[] = [
    ...(filters.minPrice ? [{ key: "minPrice" as const, label: `${text("Minimum price (MMK)")}: ${filters.minPrice}` }] : []),
    ...(filters.maxPrice ? [{ key: "maxPrice" as const, label: `${text("Maximum price (MMK)")}: ${filters.maxPrice}` }] : []),
    ...(filters.type !== "all" ? [{ key: "type" as const, label: `${text("Product type")}: ${text(filters.type === "pc_part" ? "PC Parts" : filters.type === "laptop" ? "Laptops" : "Accessories")}` }] : []),
    ...(filters.category !== "all" ? [{ key: "category" as const, label: `${text("Category")}: ${text(filters.category)}` }] : []),
    ...(filters.stock !== "all" ? [{ key: "stock" as const, label: `${text("Stock")}: ${text(filters.stock)}` }] : []),
    ...(filters.brand !== "all" ? [{ key: "brand" as const, label: `${text("Brand")}: ${filters.brand}` }] : []),
    ...(filters.sort !== "recommended" ? [{ key: "sort" as const, label: `${text("Sort")}: ${t(filters.sort === "price-asc" ? "filter.priceLowHigh" : filters.sort === "price-desc" ? "filter.priceHighLow" : "filter.nameAZ")}` }] : []),
  ];

  function update<K extends keyof ProductFilterState>(
    key: K,
    value: ProductFilterState[K]
  ) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <section
      className="mx-auto max-w-7xl px-3 pb-8 sm:px-5 sm:pb-12"
      aria-label={text("Product filters")}
    >
      <div className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-300 motion-reduce:transition-none ${open ? "border-red-200 shadow-lg shadow-red-100/60" : "border-zinc-200 hover:border-red-200 hover:shadow-md"}`}>
        <button type="button" aria-expanded={open} aria-controls="product-filter-fields" onClick={() => setOpen((value) => !value)} className="group flex w-full cursor-pointer items-center justify-between gap-4 px-4 py-4 text-left outline-none transition-colors hover:bg-red-50/50 focus-visible:bg-red-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500 sm:px-5">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 transition-transform duration-300 group-hover:rotate-[-8deg] group-hover:scale-110 motion-reduce:transform-none motion-reduce:transition-none"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5"><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" fill="white" /><circle cx="15" cy="17" r="3" fill="white" /></svg></span>
            <span className="text-sm font-bold">{t("filter.title")}</span>
            <span key={resultCount} aria-live="polite" className="filter-result-pop text-xs text-zinc-500">
              {t(resultCount === 1 ? "filter.result" : "filter.results", { count: resultCount })}
            </span>
          </span>

          <span className="flex items-center gap-2">
            {activeCount > 0 && (
              <span key={activeCount} className="filter-result-pop rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">
                {t("filter.activeCount", { count: activeCount })}
              </span>
            )}
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className={`h-5 w-5 shrink-0 text-zinc-400 transition-transform duration-300 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}><path d="m5 7 5 5 5-5" /></svg>
          </span>
        </button>

        {activeFilters.length > 0 && <div className="flex flex-wrap gap-2 border-t border-zinc-100 px-4 py-3 sm:px-5" aria-label={text("Product filters")}>
          {activeFilters.map(({ key, label }) => <button key={key} type="button" onClick={() => onChange({ ...filters, [key]: EMPTY_PRODUCT_FILTERS[key] })} aria-label={`${text("Clear all filters")}: ${label}`} className="filter-chip-pop inline-flex max-w-full items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition duration-200 hover:-translate-y-0.5 hover:border-red-400 hover:bg-red-100 motion-reduce:transform-none motion-reduce:transition-none"><span className="truncate">{label}</span><span aria-hidden="true" className="text-base leading-none">×</span></button>)}
        </div>}

        <div className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div id="product-filter-fields" inert={!open} className="min-h-0 overflow-hidden">
        <div className="border-t border-zinc-100 px-4 py-4 sm:px-5 sm:py-5">
          <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2 sm:gap-y-5 lg:grid-cols-4">
            <label className="block text-[10px] font-medium text-zinc-600 sm:text-xs sm:font-semibold">
              {text("Minimum price (MMK)")}
              <input
                className={fieldClassName}
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="0"
                value={filters.minPrice}
                onChange={(event) => update("minPrice", event.target.value)}
              />
            </label>

            <label className="block text-[10px] font-medium text-zinc-600 sm:text-xs sm:font-semibold">
              {text("Maximum price (MMK)")}
              <input
                className={fieldClassName}
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="100000"
                value={filters.maxPrice}
                onChange={(event) => update("maxPrice", event.target.value)}
              />
            </label>

            <label className="block text-[10px] font-medium text-zinc-600 sm:text-xs sm:font-semibold">
              {text("Product type")}
              <select
                className={fieldClassName}
                value={filters.type}
                onChange={(event) =>
                  update(
                    "type",
                    event.target.value as ProductFilterState["type"]
                  )
                }
              >
                <option value="all">{t("filter.allTypes")}</option>
                <option value="laptop">{text("Laptops")}</option>
                <option value="accessory">{text("Accessories")}</option>
                <option value="pc_part">{text("PC Parts")}</option>
              </select>
            </label>

            <label className="block text-[10px] font-medium text-zinc-600 sm:text-xs sm:font-semibold">
              {text("Category")}
              <select
                className={fieldClassName}
                value={filters.category}
                onChange={(event) => update("category", event.target.value)}
              >
                <option value="all">{t("filter.allCategories")}</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {text(category)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-[10px] font-medium text-zinc-600 sm:text-xs sm:font-semibold">
              {text("Stock")}
              <select
                className={fieldClassName}
                value={filters.stock}
                onChange={(event) =>
                  update(
                    "stock",
                    event.target.value as ProductFilterState["stock"]
                  )
                }
              >
                <option value="all">{t("filter.allStock")}</option>
                <option value="In Stock">{t("product.inStock")}</option>
                <option value="Out of Stock">{t("product.outOfStock")}</option>
              </select>
            </label>

            <label className="block text-[10px] font-medium text-zinc-600 sm:text-xs sm:font-semibold">
              {text("Brand")}
              <select
                className={fieldClassName}
                value={filters.brand}
                onChange={(event) => update("brand", event.target.value)}
              >
                <option value="all">{t("filter.allBrands")}</option>
                {brands.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-[10px] font-medium text-zinc-600 sm:text-xs sm:font-semibold">
              {text("Sort")}
              <select
                className={fieldClassName}
                value={filters.sort}
                onChange={(event) =>
                  update(
                    "sort",
                    event.target.value as ProductFilterState["sort"]
                  )
                }
              >
                <option value="recommended">{t("filter.recommended")}</option>
                <option value="price-asc">{t("filter.priceLowHigh")}</option>
                <option value="price-desc">{t("filter.priceHighLow")}</option>
                <option value="name">{t("filter.nameAZ")}</option>
              </select>
            </label>
          </div>

          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => onChange({ ...EMPTY_PRODUCT_FILTERS })}
              className="mt-5 min-h-11 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:border-red-500 hover:bg-red-50 hover:text-red-600 motion-reduce:transform-none motion-reduce:transition-none"
            >
              {text("Clear all filters")}
            </button>
          )}
        </div>
        </div>
        </div>
      </div>
    </section>
  );
}
