"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BrandLogo from "../components/BrandLogo";
import type { Product } from "../data/products";
import {
  buildCompareRows,
  COMPARE_LIMIT,
  recommendUseCases,
} from "../lib/compare";
import { authHeaders } from "../lib/client-auth";
import { formatCurrency, formatProductPrice } from "../lib/format";
import {
  getProductFamily,
  type ProductFamily,
} from "../lib/product-specifications";

// The API only attaches `tiers` for approved wholesale viewers. The legacy
// `wholesalePrice` field is stripped for every non-admin viewer, so it must
// never be read here.
type CompareProduct = Product & {
  tiers?: { minQuantity: number; unitPrice: number }[];
};

// `lower` is spelled out rather than derived with toLowerCase(), which would
// render the headline as "Compare pc parts" and mangle the proper noun.
const FAMILY_TABS: { id: ProductFamily; label: string; lower: string }[] = [
  { id: "laptop", label: "Laptops", lower: "laptops" },
  { id: "pc_part", label: "PC Parts", lower: "PC parts" },
  { id: "accessory", label: "Accessories", lower: "accessories" },
];

function parseIds(value: string | null) {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isInteger(id) && id > 0);
}

function ComparePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Captured once: the URL is rewritten as the selection changes, so reading
  // it during render would restart the catalogue load on every change.
  const [openedWith] = useState(() => ({
    ids: parseIds(searchParams.get("ids")),
    primary: Number(searchParams.get("primary")) || null,
  }));

  const [products, setProducts] = useState<CompareProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [family, setFamily] = useState<ProductFamily>("laptop");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [pickerQuery, setPickerQuery] = useState("");
  const [differencesOnly, setDifferencesOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      setIsLoading(true);
      setError("");

      try {
        // The API caps a page at 100 rows and defaults to 24, so the whole
        // catalogue has to be paged through -- the previous single unpaginated
        // request only ever returned the first 24 products, which is why most
        // laptops could never be selected.
        const loaded: CompareProduct[] = [];
        for (let offset = 0; offset < 2_000; offset += 100) {
          const params = new URLSearchParams({
            limit: "100",
            offset: String(offset),
          });
          const response = await fetch(`/api/products?${params.toString()}`, {
            headers: authHeaders(),
            cache: "no-store",
          });
          const data = (await response.json().catch(() => null)) as
            | { products?: CompareProduct[]; error?: string }
            | null;

          if (!response.ok) {
            throw new Error(
              data?.error ?? "Unable to load the product catalogue."
            );
          }

          const page = data?.products ?? [];
          loaded.push(...page);
          if (page.length < 100) break;
        }

        if (cancelled) return;

        const unique = [
          ...new Map(loaded.map((product) => [product.id, product])).values(),
        ];
        setProducts(unique);

        const requested = [
          ...new Set(
            [
              ...(openedWith.primary ? [openedWith.primary] : []),
              ...openedWith.ids,
            ].filter((id) => unique.some((product) => product.id === id))
          ),
        ].slice(0, COMPARE_LIMIT);

        const first =
          unique.find((product) => product.id === requested[0]) ??
          unique.find((product) => getProductFamily(product) === "laptop") ??
          unique[0];

        if (first) {
          const firstFamily = getProductFamily(first);
          // A compare tray only makes sense within one family.
          const sameFamily = requested.filter((id) => {
            const product = unique.find((entry) => entry.id === id);
            return product && getProductFamily(product) === firstFamily;
          });

          setFamily(firstFamily);
          setSelectedIds(sameFamily.length > 0 ? sameFamily : [first.id]);
        }
      } catch (loadError) {
        if (cancelled) return;
        setProducts([]);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load the product catalogue."
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadProducts();

    return () => {
      cancelled = true;
    };
  }, [openedWith]);

  // Keeps the URL shareable: sending the link reopens the same comparison.
  useEffect(() => {
    if (isLoading) return;
    const query = selectedIds.length > 0 ? `?ids=${selectedIds.join(",")}` : "";
    router.replace(`/compare${query}`, { scroll: false });
  }, [isLoading, router, selectedIds]);

  const activeTab = FAMILY_TABS.find((tab) => tab.id === family) ?? FAMILY_TABS[0];

  const familyProducts = useMemo(
    () =>
      products
        .filter((product) => getProductFamily(product) === family)
        .sort((left, right) => left.name.localeCompare(right.name)),
    [products, family]
  );

  const selectedProducts = useMemo(
    () =>
      selectedIds
        .map((id) => products.find((product) => product.id === id))
        .filter((product): product is CompareProduct => Boolean(product)),
    [products, selectedIds]
  );

  const pickerResults = useMemo(() => {
    const query = pickerQuery.trim().toLowerCase();
    return familyProducts.filter((product) => {
      if (selectedIds.includes(product.id)) return false;
      if (!query) return true;
      return [product.name, product.brand, product.category].some((value) =>
        value.toLowerCase().includes(query)
      );
    });
  }, [familyProducts, pickerQuery, selectedIds]);

  const rows = useMemo(() => buildCompareRows(selectedProducts), [selectedProducts]);
  const differingCount = rows.filter((row) => row.differs).length;
  const visibleRows = differencesOnly ? rows.filter((row) => row.differs) : rows;

  const verdicts = useMemo(
    () => (family === "laptop" ? recommendUseCases(selectedProducts) : []),
    [family, selectedProducts]
  );

  const isFull = selectedProducts.length >= COMPARE_LIMIT;

  function changeFamily(next: ProductFamily) {
    if (next === family) return;
    setFamily(next);
    setSelectedIds([]);
    setPickerQuery("");
  }

  function addProduct(id: number) {
    setSelectedIds((previous) =>
      previous.includes(id) || previous.length >= COMPARE_LIMIT
        ? previous
        : [...previous, id]
    );
    setPickerQuery("");
  }

  function removeProduct(id: number) {
    setSelectedIds((previous) => previous.filter((entry) => entry !== id));
  }

  return (
    <main className="min-h-screen bg-white text-zinc-950">
      <header className="sticky top-0 z-50 border-b bg-white/95 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3">
          <Link href="/" aria-label="Aphrodite Myanmar home" className="w-36 shrink-0 sm:w-44">
            <BrandLogo />
          </Link>
          <Link
            href="/"
            className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-semibold hover:border-zinc-950"
          >
            ← Back to store
          </Link>
        </div>
      </header>

      <section className="border-b bg-zinc-950 px-5 py-12 text-white">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-red-400">
            Side by side
          </p>
          <h1 className="mt-3 text-4xl font-black sm:text-5xl">
            Compare {activeTab.lower}
          </h1>
          <p className="mt-4 max-w-3xl text-zinc-300">
            Put up to {COMPARE_LIMIT} products next to each other, hide the rows
            that match, and see which one suits office work, school, gaming or
            programming.
          </p>

          <div className="mt-7 inline-flex flex-wrap gap-2 rounded-full bg-white/10 p-1.5">
            {FAMILY_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => changeFamily(tab.id)}
                aria-pressed={tab.id === family}
                className={`rounded-full px-5 py-2 text-sm font-bold transition ${
                  tab.id === family
                    ? "bg-white text-zinc-950"
                    : "text-zinc-300 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 py-10">
        {error && (
          <p
            role="alert"
            className="mb-8 rounded-2xl bg-red-50 p-4 text-center text-sm font-bold text-red-700"
          >
            {error}
          </p>
        )}

        {isLoading ? (
          <p className="rounded-2xl bg-zinc-100 p-6 text-center text-zinc-500">
            Loading the catalogue...
          </p>
        ) : (
          <>
            <div className="rounded-[2rem] border border-zinc-200 bg-white p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">Choose what to compare</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    {selectedProducts.length} of {COMPARE_LIMIT} slots used ·{" "}
                    {familyProducts.length} {activeTab.lower} available
                  </p>
                </div>

                {selectedProducts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedIds([])}
                    className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-600 hover:border-red-600 hover:text-red-600"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {selectedProducts.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-2">
                  {selectedProducts.map((product) => (
                    <li key={product.id}>
                      <span className="inline-flex max-w-full items-center gap-2 rounded-full bg-zinc-100 py-1.5 pl-4 pr-1.5 text-sm font-semibold">
                        <span className="truncate">{product.name}</span>
                        <button
                          type="button"
                          onClick={() => removeProduct(product.id)}
                          aria-label={`Remove ${product.name}`}
                          className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-zinc-500 hover:bg-red-600 hover:text-white"
                        >
                          ×
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <label className="sr-only" htmlFor="compare-search">
                Search {activeTab.lower}
              </label>
              <input
                id="compare-search"
                value={pickerQuery}
                onChange={(event) => setPickerQuery(event.target.value)}
                autoComplete="off"
                placeholder={`Search all ${familyProducts.length} ${activeTab.lower} by name or brand...`}
                className="mt-4 w-full rounded-full border border-zinc-300 px-5 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-50"
              />

              {isFull ? (
                <p className="mt-3 rounded-2xl bg-zinc-50 p-4 text-sm font-semibold text-zinc-600">
                  All {COMPARE_LIMIT} slots are full. Remove one to add another.
                </p>
              ) : (
                <>
                  <ul className="mt-3 max-h-80 divide-y divide-zinc-100 overflow-y-auto rounded-2xl border border-zinc-200">
                    {pickerResults.length === 0 && (
                      <li className="p-4 text-sm text-zinc-500">
                        Nothing matches that search.
                      </li>
                    )}
                    {pickerResults.slice(0, 60).map((product) => (
                      <li key={product.id}>
                        <button
                          type="button"
                          onClick={() => addProduct(product.id)}
                          className="flex w-full items-center gap-3 p-3 text-left hover:bg-red-50"
                        >
                          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                            <Image
                              src={product.image}
                              unoptimized
                              alt=""
                              fill
                              sizes="48px"
                              className="object-contain p-1"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold">{product.name}</p>
                            <p className="truncate text-xs text-zinc-500">
                              {product.brand} · {product.category}
                            </p>
                          </div>
                          <span className="hidden shrink-0 text-sm font-semibold text-zinc-500 sm:block">
                            {formatProductPrice(product.price)}
                          </span>
                          <span className="shrink-0 rounded-full bg-zinc-950 px-4 py-1.5 text-xs font-bold text-white">
                            Add
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>

                  {pickerResults.length > 60 && (
                    <p className="mt-2 text-xs text-zinc-500">
                      Showing 60 of {pickerResults.length}. Keep typing to narrow it down.
                    </p>
                  )}
                </>
              )}
            </div>

            {selectedProducts.length === 0 ? (
              <div className="mt-8 rounded-[2rem] border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center">
                <p className="text-lg font-bold">Nothing selected yet</p>
                <p className="mt-2 text-sm text-zinc-500">
                  Search above and add up to {COMPARE_LIMIT}{" "}
                  {activeTab.lower} to see them side by side.
                </p>
              </div>
            ) : (
              <>
                <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
                  <p className="text-sm text-zinc-600">
                    <span className="text-base font-black text-zinc-950">
                      {differingCount}
                    </span>{" "}
                    of {rows.length} rows differ
                    {selectedProducts.length === 1 && " · add a second product to see differences"}
                  </p>

                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={differencesOnly}
                      onChange={(event) => setDifferencesOnly(event.target.checked)}
                      className="h-4 w-4 accent-red-600"
                    />
                    Show only differences
                  </label>
                </div>

                {visibleRows.length === 0 ? (
                  <div className="mt-4 rounded-[2rem] border border-zinc-200 bg-zinc-50 p-10 text-center">
                    <p className="font-bold">These match on every detail we hold</p>
                    <p className="mt-2 text-sm text-zinc-500">
                      Turn off “Show only differences” to see the full table.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 overflow-x-auto rounded-[2rem] border border-zinc-200 bg-white">
                    <table className="w-full border-separate border-spacing-0 text-sm">
                      <thead>
                        <tr>
                          <th
                            scope="col"
                            className="sticky left-0 top-0 z-30 w-44 min-w-44 border-b border-r border-zinc-200 bg-zinc-50 p-4 text-left align-bottom text-xs font-bold uppercase tracking-wider text-zinc-500"
                          >
                            Specification
                          </th>
                          {selectedProducts.map((product) => (
                            <th
                              key={product.id}
                              scope="col"
                              className="sticky top-0 z-20 min-w-[15rem] border-b border-zinc-200 bg-white p-4 text-left align-top font-normal"
                            >
                              <div className="relative h-32 w-full overflow-hidden rounded-2xl bg-zinc-50">
                                <Image
                                  src={product.image}
                                  unoptimized
                                  alt={product.name}
                                  fill
                                  sizes="240px"
                                  className="object-contain p-3"
                                />
                              </div>

                              <Link
                                href={`/products/${product.id}`}
                                className="mt-3 block text-base font-bold leading-snug hover:text-red-600"
                              >
                                {product.name}
                              </Link>
                              <p className="mt-1 text-xs text-zinc-500">{product.brand}</p>
                              <p className="mt-2 text-lg font-black">
                                {formatProductPrice(product.price)}
                              </p>

                              {product.tiers?.[0] && (
                                <p className="mt-1 text-xs font-semibold text-red-600">
                                  Wholesale from{" "}
                                  {formatCurrency(product.tiers[0].unitPrice)} (
                                  {product.tiers[0].minQuantity}+ units)
                                </p>
                              )}

                              <button
                                type="button"
                                onClick={() => removeProduct(product.id)}
                                className="mt-3 rounded-full border border-zinc-300 px-4 py-1.5 text-xs font-semibold text-zinc-600 hover:border-red-600 hover:text-red-600"
                              >
                                Remove
                              </button>
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        {visibleRows.map((row) => (
                          <tr key={row.label}>
                            <th
                              scope="row"
                              className="sticky left-0 z-10 border-b border-r border-zinc-200 bg-zinc-50 p-4 text-left align-top font-semibold"
                            >
                              {row.label}
                            </th>

                            {row.cells.map((cell) => {
                              const isWinner = row.winnerIds.includes(cell.productId);
                              return (
                                <td
                                  key={cell.productId}
                                  className={`border-b border-zinc-200 p-4 align-top ${
                                    isWinner ? "bg-red-50/70" : ""
                                  }`}
                                >
                                  {cell.value ? (
                                    <span className={isWinner ? "font-bold" : ""}>
                                      {cell.value}
                                    </span>
                                  ) : (
                                    <span className="text-zinc-300">—</span>
                                  )}

                                  {isWinner && (
                                    <span className="ml-2 whitespace-nowrap rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                                      Best
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {family === "laptop" && (
                  <section className="mt-12">
                    <h2 className="text-2xl font-black sm:text-3xl">
                      Which one suits you?
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm text-zinc-500">
                      Worked out from the specifications above. Where the
                      catalogue does not publish a detail, we say so instead of
                      guessing.
                    </p>

                    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {verdicts.map((verdict) => {
                        const winner = selectedProducts.find(
                          (product) => product.id === verdict.winnerId
                        );

                        return (
                          <article
                            key={verdict.id}
                            className="flex flex-col rounded-3xl border border-zinc-200 bg-white p-5"
                          >
                            <h3 className="text-base font-bold">{verdict.title}</h3>
                            <p className="mt-1 text-sm text-zinc-500">{verdict.blurb}</p>

                            {winner && (
                              <>
                                <Link
                                  href={`/products/${winner.id}`}
                                  className="mt-4 flex items-center gap-3 rounded-2xl bg-zinc-50 p-3 transition hover:bg-red-50"
                                >
                                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white">
                                    <Image
                                      src={winner.image}
                                      unoptimized
                                      alt=""
                                      fill
                                      sizes="56px"
                                      className="object-contain p-1"
                                    />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold uppercase tracking-wider text-red-600">
                                      Best pick
                                    </p>
                                    <p className="truncate text-sm font-bold">
                                      {winner.name}
                                    </p>
                                  </div>
                                </Link>

                                {verdict.reasons.length > 0 && (
                                  <ul className="mt-3 space-y-1.5 text-sm text-zinc-700">
                                    {verdict.reasons.map((reason) => (
                                      <li key={reason} className="flex gap-2">
                                        <span aria-hidden="true" className="text-red-600">
                                          ✓
                                        </span>
                                        <span>{reason}</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </>
                            )}

                            {verdict.note && (
                              <p className="mt-3 text-xs leading-5 text-zinc-500">
                                {verdict.note}
                              </p>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  </section>
                )}
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-zinc-500">
          Loading compare page...
        </main>
      }
    >
      <ComparePageContent />
    </Suspense>
  );
}
