"use client";

import Link from "next/link";
import { useState } from "react";
import type { Product, UserRole } from "../data/products";
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
  viewAllLabel = "View all",
}: Props) {
  const [visibleCount, setVisibleCount] = useState(initialVisibleCount);
  const visibleProducts = products.slice(0, visibleCount);

  return (
    <section className="mx-auto max-w-7xl px-5 pb-16">
      <div className="mb-8 flex items-end justify-between gap-5 border-b border-zinc-200 pb-5">
        <div>
          <h2 className="text-3xl font-black sm:text-4xl">{title}</h2>
          <p className="mt-2 text-sm text-zinc-500">
            {products.length.toLocaleString()} product
            {products.length === 1 ? "" : "s"}
          </p>
        </div>

        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="group inline-flex shrink-0 items-center gap-2 rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm font-bold transition hover:border-red-500 hover:bg-red-50 hover:text-red-700"
          >
            {viewAllLabel}
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
        <p className="text-center text-zinc-500">No products found.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {visibleProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              userRole={userRole}
            />
          ))}
        </div>
      )}

      {showLoadMore && visibleCount < products.length && (
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => setVisibleCount((count) => count + pageSize)}
            className="rounded-full border border-zinc-300 bg-white px-6 py-3 font-bold transition hover:border-red-500 hover:text-red-600"
          >
            Show {Math.min(pageSize, products.length - visibleCount)} more
          </button>
        </div>
      )}
    </section>
  );
}
