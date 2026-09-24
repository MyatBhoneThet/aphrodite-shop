"use client";

import type { Product, UserRole } from "../data/products";
import { useLanguage } from "../lib/language";
import ProductCard from "./ProductCard";
import type { DeliveryEstimate } from "../lib/delivery-estimate";

type Props = {
  products: Product[];
  userRole: UserRole;
  onClear: () => void;
  deliveryEstimate?: DeliveryEstimate | null;
};

export default function RecentlyViewedSection({
  products,
  userRole,
  onClear,
  deliveryEstimate = null,
}: Props) {
  const { t } = useLanguage();
  if (products.length === 0) return null;

  function scrollToHistory() {
    document
      .getElementById("recently-viewed")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <section
        id="recently-viewed"
        className="mx-auto max-w-7xl scroll-mt-28 px-5 pb-16"
      >
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-3xl font-bold">{t("recent.title")}</h2>
            <p className="mt-1 text-sm text-zinc-500">{t("recent.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="rounded-full border px-5 py-2 text-sm font-semibold hover:border-red-500 hover:text-red-600"
          >
            {t("recent.clear")}
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              userRole={userRole}
              deliveryEstimate={deliveryEstimate}
            />
          ))}
        </div>
      </section>

      <button
        type="button"
        onClick={scrollToHistory}
        className="fixed bottom-5 right-5 z-40 rounded-full border border-zinc-200 bg-white px-4 py-3 text-sm font-bold shadow-xl transition hover:-translate-y-1 hover:border-red-500"
        aria-label={t("recent.title")}
      >
        🕘 {t("recent.title")} ({products.length})
      </button>
    </>
  );
}
