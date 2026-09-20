"use client";

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
  "w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100";

export default function ProductFilters({
  brands,
  categories,
  filters,
  resultCount,
  onChange,
}: Props) {
  const { t, text } = useLanguage();
  const activeCount = countActiveProductFilters(filters);

  function update<K extends keyof ProductFilterState>(
    key: K,
    value: ProductFilterState[K]
  ) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <section
      className="mx-auto max-w-7xl px-5 pb-12"
      aria-label={text("Product filters")}
    >
      <details className="group rounded-[2rem] border border-zinc-200 bg-zinc-50 shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5">
          <span>
            <span className="font-bold">{t("filter.title")}</span>
            <span className="ml-2 text-sm text-zinc-500">
              {t(resultCount === 1 ? "filter.result" : "filter.results", { count: resultCount })}
            </span>
          </span>

          <span className="flex items-center gap-2">
            {activeCount > 0 && (
              <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">
                {t("filter.activeCount", { count: activeCount })}
              </span>
            )}
            <span className="text-xl transition group-open:rotate-180">⌄</span>
          </span>
        </summary>

        <div className="border-t border-zinc-200 px-6 py-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <label className="text-sm font-semibold">
              {text("Minimum price (MMK)")}
              <input
                className={`${fieldClassName} mt-2`}
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="0"
                value={filters.minPrice}
                onChange={(event) => update("minPrice", event.target.value)}
              />
            </label>

            <label className="text-sm font-semibold">
              {text("Maximum price (MMK)")}
              <input
                className={`${fieldClassName} mt-2`}
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="100000"
                value={filters.maxPrice}
                onChange={(event) => update("maxPrice", event.target.value)}
              />
            </label>

            <label className="text-sm font-semibold">
              {text("Product type")}
              <select
                className={`${fieldClassName} mt-2`}
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

            <label className="text-sm font-semibold">
              {text("Category")}
              <select
                className={`${fieldClassName} mt-2`}
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

            <label className="text-sm font-semibold">
              {text("Stock")}
              <select
                className={`${fieldClassName} mt-2`}
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

            <label className="text-sm font-semibold">
              {text("Brand")}
              <select
                className={`${fieldClassName} mt-2`}
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

            <label className="text-sm font-semibold">
              {text("Sort")}
              <select
                className={`${fieldClassName} mt-2`}
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
              className="mt-5 rounded-full border border-zinc-300 bg-white px-5 py-2 text-sm font-semibold hover:border-red-500 hover:text-red-600"
            >
              {text("Clear all filters")}
            </button>
          )}
        </div>
      </details>
    </section>
  );
}
