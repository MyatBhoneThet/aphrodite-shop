"use client";

import {
  countActiveProductFilters,
  EMPTY_PRODUCT_FILTERS,
  type ProductFilterState,
} from "../lib/product-filters";

type Props = {
  brands: string[];
  filters: ProductFilterState;
  resultCount: number;
  onChange: (filters: ProductFilterState) => void;
};

const fieldClassName =
  "w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100";

export default function ProductFilters({
  brands,
  filters,
  resultCount,
  onChange,
}: Props) {
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
      aria-label="Product filters"
    >
      <details className="group rounded-[2rem] border border-zinc-200 bg-zinc-50 shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5">
          <span>
            <span className="font-bold">Filter products</span>
            <span className="ml-2 text-sm text-zinc-500">
              {resultCount} result{resultCount === 1 ? "" : "s"}
            </span>
          </span>

          <span className="flex items-center gap-2">
            {activeCount > 0 && (
              <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">
                {activeCount} active
              </span>
            )}
            <span className="text-xl transition group-open:rotate-180">⌄</span>
          </span>
        </summary>

        <div className="border-t border-zinc-200 px-6 py-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
            <label className="text-sm font-semibold">
              Minimum price (฿)
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
              Maximum price (฿)
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
              Product type
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
                <option value="all">All types</option>
                <option value="laptop">Laptops</option>
                <option value="accessory">Accessories</option>
              </select>
            </label>

            <label className="text-sm font-semibold">
              Stock
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
                <option value="all">All stock</option>
                <option value="In Stock">In stock</option>
                <option value="Out of Stock">Out of stock</option>
              </select>
            </label>

            <label className="text-sm font-semibold">
              Brand
              <select
                className={`${fieldClassName} mt-2`}
                value={filters.brand}
                onChange={(event) => update("brand", event.target.value)}
              >
                <option value="all">All brands</option>
                {brands.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-semibold">
              Sort
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
                <option value="recommended">Recommended</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
                <option value="name">Name A–Z</option>
              </select>
            </label>
          </div>

          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => onChange({ ...EMPTY_PRODUCT_FILTERS })}
              className="mt-5 rounded-full border border-zinc-300 bg-white px-5 py-2 text-sm font-semibold hover:border-red-500 hover:text-red-600"
            >
              Clear all filters
            </button>
          )}
        </div>
      </details>
    </section>
  );
}
