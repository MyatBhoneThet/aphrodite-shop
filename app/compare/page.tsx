"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Product, UserRole } from "../data/products";
import { formatProductPrice } from "../lib/format";
import { useCurrentUser } from "../lib/useCurrentUser";

function ComparePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const primaryId = Number(searchParams.get("primary"));
  const { user: currentUser } = useCurrentUser();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const primaryProduct =
    products.find((product) => product.id === primaryId) ??
    products.find((product) => product.id === selectedIds[0]) ??
    products.find((product) => product.type === "laptop") ??
    products[0];

  useEffect(() => {
    async function loadProducts() {
      setIsLoadingProducts(true);

      const response = await fetch("/api/products");

      if (!response.ok) {
        setProducts([]);
        setIsLoadingProducts(false);
        return;
      }

      const data = (await response.json()) as { products: Product[] };
      const firstProduct =
        data.products.find((product) => product.id === primaryId) ??
        data.products.find((product) => product.type === "laptop") ??
        data.products[0];

      setProducts(data.products);
      setSelectedIds(firstProduct ? [firstProduct.id] : []);
      setIsLoadingProducts(false);
    }

    loadProducts();
  }, [primaryId]);

  const userRole: UserRole = currentUser?.role ?? "normal";

  const sameCategoryProducts = useMemo(() => {
    if (!primaryProduct) return [];
    return products.filter((product) => product.type === primaryProduct.type);
  }, [primaryProduct, products]);

  const selectedProducts = useMemo(() => {
    return selectedIds
      .map((id) => products.find((product) => product.id === id))
      .filter(Boolean) as Product[];
  }, [products, selectedIds]);

  const availableProducts = sameCategoryProducts.filter(
    (product) => !selectedIds.includes(product.id)
  );

  function getDisplayPrice(product: Product) {
    if (userRole === "wholesale" && product.wholesalePrice) {
      return product.wholesalePrice;
    }

    return product.price;
  }

  function handleAddProduct(id: number) {
    if (!id) return;

    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev;
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  }

  function handleRemoveProduct(id: number) {
    if (primaryProduct && id === primaryProduct.id) return;

    setSelectedIds((prev) => prev.filter((item) => item !== id));
  }

  function handleChangePrimary(id: number) {
    setSelectedIds([id]);
    router.push(`/compare?primary=${id}`);
  }

  const specRows = [
    {
      label: "Brand",
      value: (product: Product) => product.brand,
    },
    {
      label: "Category",
      value: (product: Product) => product.category,
    },
    {
      label: "Stock",
      value: (product: Product) => product.stock,
    },
    {
      label: "Price",
      value: (product: Product) => formatProductPrice(getDisplayPrice(product)),
    },
    {
      label: "Processor",
      value: (product: Product) => product.fullSpecs.processor ?? "-",
    },
    {
      label: "RAM",
      value: (product: Product) => product.fullSpecs.ram ?? "-",
    },
    {
      label: "Storage",
      value: (product: Product) => product.fullSpecs.storage ?? "-",
    },
    {
      label: "Graphics",
      value: (product: Product) => product.fullSpecs.graphics ?? "-",
    },
    {
      label: "Display",
      value: (product: Product) => product.fullSpecs.display ?? "-",
    },
    {
      label: "Battery",
      value: (product: Product) => product.fullSpecs.battery ?? "-",
    },
    {
      label: "Weight",
      value: (product: Product) => product.fullSpecs.weight ?? "-",
    },
    {
      label: "Ports",
      value: (product: Product) => product.fullSpecs.ports ?? "-",
    },
    {
      label: "Operating System",
      value: (product: Product) => product.fullSpecs.operatingSystem ?? "-",
    },
    {
      label: "Color",
      value: (product: Product) => product.fullSpecs.color ?? "-",
    },
    {
      label: "Condition",
      value: (product: Product) => product.fullSpecs.condition ?? "-",
    },
    {
      label: "Warranty",
      value: (product: Product) => product.fullSpecs.warranty ?? "-",
    },
    {
      label: "Detail",
      value: (product: Product) => product.fullSpecs.detail ?? "-",
    },
  ];

  return (
    <main className="min-h-screen bg-white text-zinc-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
          <Link href="/" className="text-2xl font-bold text-red-600">
            Aphrodite
          </Link>

          <Link href="/" className="rounded-full border px-5 py-2 text-sm">
            Back to Store
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-10">
        {isLoadingProducts && (
          <p className="rounded-2xl bg-zinc-100 p-5 text-zinc-500">
            Loading products...
          </p>
        )}

        {!isLoadingProducts && !primaryProduct && (
          <div className="rounded-2xl bg-zinc-100 p-6">
            <h1 className="text-3xl font-bold">No products found</h1>
            <p className="mt-2 text-zinc-500">
              Sync products from Google Sheets into Supabase first.
            </p>
          </div>
        )}

        {!isLoadingProducts && primaryProduct && (
          <>
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-red-600">
            Product Compare
          </p>

          <h1 className="mt-3 text-4xl font-bold md:text-5xl">
            Compare {primaryProduct.type === "laptop" ? "Laptops" : "Products"}
          </h1>

          <p className="mt-3 max-w-2xl text-zinc-500">
            Select up to 3 products from the same category. You cannot compare
            laptop with accessories.
          </p>
        </div>

        <div className="mb-8 grid gap-4 rounded-[2rem] bg-zinc-100 p-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold">
              Main product
            </label>

            <select
              value={primaryProduct.id}
              onChange={(e) => handleChangePrimary(Number(e.target.value))}
              className="w-full rounded-2xl border bg-white px-5 py-4 outline-none focus:border-red-500"
            >
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} - {product.category}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">
              Add another same category product
            </label>

            <select
              value=""
              disabled={selectedIds.length >= 3}
              onChange={(e) => handleAddProduct(Number(e.target.value))}
              className="w-full rounded-2xl border bg-white px-5 py-4 outline-none focus:border-red-500 disabled:bg-zinc-200"
            >
              <option value="">
                {selectedIds.length >= 3
                  ? "Maximum 3 products selected"
                  : "Select product to compare"}
              </option>

              {availableProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} - {product.category}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-10 grid gap-6 md:grid-cols-3">
          {selectedProducts.map((product) => (
            <article
              key={product.id}
              className="rounded-[2rem] bg-zinc-100 p-5 text-center"
            >
              <div className="relative h-56 overflow-hidden rounded-[1.5rem] bg-white">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  className="object-contain p-6"
                />
              </div>

              <h2 className="mt-5 text-xl font-bold">{product.name}</h2>

              <p className="mt-1 text-sm text-zinc-500">
                {product.brand} • {product.category}
              </p>

              <p
                className={`mt-3 text-sm font-bold ${
                  product.stock === "In Stock"
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {product.stock}
              </p>

              <p className="mt-4 text-2xl font-bold">
                {formatProductPrice(getDisplayPrice(product))}
              </p>

              {userRole === "wholesale" && product.wholesalePrice && (
                <p className="mt-1 text-xs font-semibold text-red-600">
                  Wholesale price
                </p>
              )}

              {product.id !== primaryProduct.id && (
                <button
                  onClick={() => handleRemoveProduct(product.id)}
                  className="mt-5 rounded-full border bg-white px-5 py-2 text-sm text-red-600"
                >
                  Remove
                </button>
              )}
            </article>
          ))}
        </div>

        <div className="rounded-[2rem] border">
          <div className="grid grid-cols-[180px_repeat(3,1fr)] border-b bg-zinc-100">
            <div className="p-4 font-bold">Specification</div>

            {selectedProducts.map((product) => (
              <div key={product.id} className="p-4 font-bold">
                {product.name}
              </div>
            ))}

            {Array.from({ length: 3 - selectedProducts.length }).map(
              (_, index) => (
                <div key={index} className="p-4 text-zinc-400">
                  Not selected
                </div>
              )
            )}
          </div>

          {specRows.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-[180px_repeat(3,1fr)] border-b last:border-b-0"
            >
              <div className="bg-zinc-50 p-4 font-semibold">{row.label}</div>

              {selectedProducts.map((product) => (
                <div key={product.id} className="p-4 text-sm">
                  {row.value(product)}
                </div>
              ))}

              {Array.from({ length: 3 - selectedProducts.length }).map(
                (_, index) => (
                  <div key={index} className="p-4 text-sm text-zinc-300">
                    -
                  </div>
                )
              )}
            </div>
          ))}
        </div>
          </>
        )}
      </section>
    </main>
  );
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center">
          Loading compare page...
        </main>
      }
    >
      <ComparePageContent />
    </Suspense>
  );
}
