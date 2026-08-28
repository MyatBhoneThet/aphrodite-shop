"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Product, UserRole } from "../../data/products";
import Product3DViewer from "../../components/Product3DViewer";
import { authHeaders } from "../../lib/client-auth";
import { formatCurrency } from "../../lib/format";
import { useCurrentUser } from "../../lib/useCurrentUser";

type PublicTier = { minQuantity: number; unitPrice: number };

type Pricing = {
  quantity: number;
  retailUnitPrice: number;
  unitPrice: number;
  lineTotal: number;
  savings: number;
  tierMinQuantity: number | null;
  label: string;
  nextTier: { minQuantity: number; unitPrice: number; unitsAway: number } | null;
  wholesaleEligible: boolean;
};

type ProductResponse = {
  product: Product & { tiers?: PublicTier[] };
  pricing: Pricing;
  wholesale: boolean;
  relatedProducts: Product[];
};

export default function ProductDetailsPage() {
  const params = useParams();
  const productId = Number(params.id);

  const { user: currentUser } = useCurrentUser();
  const [product, setProduct] = useState<ProductResponse["product"] | null>(null);
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [isWholesale, setIsWholesale] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [wishlistItemId, setWishlistItemId] = useState<string | null>(null);
  const [cartMessage, setCartMessage] = useState("");

  // Pricing is always computed server-side; changing the quantity refetches
  // the quote so tier selection stays out of the UI.
  useEffect(() => {
    let cancelled = false;

    async function loadProduct() {
      const response = await fetch(
        `/api/products/${productId}?quantity=${quantity}`,
        { headers: authHeaders(), cache: "no-store" }
      );

      if (cancelled) return;

      if (!response.ok) {
        setProduct(null);
        setRelatedProducts([]);
        setIsLoading(false);
        return;
      }

      const data = (await response.json()) as ProductResponse;

      if (cancelled) return;

      setProduct(data.product);
      setPricing(data.pricing);
      setIsWholesale(data.wholesale);
      setRelatedProducts(data.relatedProducts);
      setIsLoading(false);
    }

    loadProduct();

    return () => {
      cancelled = true;
    };
  }, [productId, quantity]);

  useEffect(() => {
    async function loadWishlist() {
      if (!currentUser || !product) {
        setIsWishlisted(false);
        setWishlistItemId(null);
        return;
      }

      const response = await fetch("/api/wishlist", {
        headers: authHeaders(),
      });

      if (!response.ok) return;

      const data = (await response.json()) as {
        items: { id: string; product_id: number; product: Product }[];
      };
      const item = data.items.find((entry) => entry.product_id === product.id);

      setIsWishlisted(Boolean(item));
      setWishlistItemId(item?.id ?? null);
    }

    loadWishlist();
  }, [currentUser, product]);

  const recentlyViewedCustomer =
    currentUser?.id ?? currentUser?.email ?? null;
  const recentlyViewedRole = currentUser?.role;
  const recentlyViewedProductId = product?.id;

  useEffect(() => {
    if (
      !recentlyViewedCustomer ||
      recentlyViewedRole === "admin" ||
      !recentlyViewedProductId
    ) {
      return;
    }

    void fetch("/api/recently-viewed", {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ product_id: recentlyViewedProductId }),
    });
  }, [
    recentlyViewedCustomer,
    recentlyViewedProductId,
    recentlyViewedRole,
  ]);

  const userRole: UserRole = currentUser?.role ?? "normal";

  const specRows = useMemo(() => {
    if (!product) return [];

    return [
      { label: "Brand", value: product.brand },
      { label: "Category", value: product.category },
      { label: "Stock", value: product.stock },
      { label: "Processor", value: product.fullSpecs.processor ?? "-" },
      { label: "RAM", value: product.fullSpecs.ram ?? "-" },
      { label: "Storage", value: product.fullSpecs.storage ?? "-" },
      { label: "Graphics", value: product.fullSpecs.graphics ?? "-" },
      { label: "Display", value: product.fullSpecs.display ?? "-" },
      { label: "Battery", value: product.fullSpecs.battery ?? "-" },
      { label: "Weight", value: product.fullSpecs.weight ?? "-" },
      { label: "Ports", value: product.fullSpecs.ports ?? "-" },
      {
        label: "Operating System",
        value: product.fullSpecs.operatingSystem ?? "-",
      },
      { label: "Color", value: product.fullSpecs.color ?? "-" },
      { label: "Condition", value: product.fullSpecs.condition ?? "-" },
      { label: "Warranty", value: product.fullSpecs.warranty ?? "-" },
      { label: "Detail", value: product.fullSpecs.detail ?? "-" },
    ];
  }, [product]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-zinc-950">
        Loading product...
      </main>
    );
  }

  if (!product) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-5 text-center text-zinc-950">
        <div>
          <h1 className="text-3xl font-bold">Product not found</h1>

          <p className="mt-3 text-zinc-500">
            The product you are looking for does not exist.
          </p>

          <Link
            href="/"
            className="mt-6 inline-block rounded-full bg-red-600 px-6 py-3 font-semibold text-white"
          >
            Back to Store
          </Link>
        </div>
      </main>
    );
  }

  const displayPrice = pricing?.unitPrice ?? product.price;

  async function addToCart(productItem: Product) {
    if (!currentUser) {
      setCartMessage("Please login before adding products to cart.");
      return;
    }

    if (productItem.stock === "Out of Stock") {
      setCartMessage("This product is currently out of stock.");
      return;
    }

    const response = await fetch("/api/cart", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({ product_id: productItem.id, quantity }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setCartMessage(data.error ?? "Unable to add product to cart.");
      return;
    }

    setCartMessage("Added to cart successfully.");
  }

  async function toggleWishlist(productItem: Product) {
    if (!currentUser) {
      setCartMessage("Please login before saving products.");
      return;
    }

    const response =
      isWishlisted && wishlistItemId
        ? await fetch(`/api/wishlist/${wishlistItemId}`, {
            method: "DELETE",
            headers: authHeaders(),
          })
        : await fetch("/api/wishlist", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...authHeaders(),
            },
            body: JSON.stringify({ product_id: productItem.id }),
          });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setCartMessage(data.error ?? "Unable to update wishlist.");
      return;
    }

    const data = (await response.json()) as {
      items: { id: string; product_id: number; product: Product }[];
    };
    const item = data.items.find((entry) => entry.product_id === productItem.id);

    setIsWishlisted(Boolean(item));
    setWishlistItemId(item?.id ?? null);
  }

  return (
    <main className="min-h-screen bg-white text-zinc-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
          <Link href="/" className="text-2xl font-bold text-red-600">
            Aphrodite
          </Link>

          <div className="flex items-center gap-3">
            {currentUser && (
              <span
                className={`hidden rounded-full px-4 py-2 text-sm md:inline ${
                  isWholesale
                    ? "bg-green-100 font-semibold text-green-700"
                    : "bg-zinc-100"
                }`}
              >
                {isWholesale ? "Wholesale ✓" : "User"}
              </span>
            )}

            <Link href="/" className="rounded-full border px-5 py-2 text-sm">
              Back to Store
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-10">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <div className="sticky top-8">
              <div className="h-[420px] overflow-hidden rounded-[2rem] bg-zinc-100 md:h-[560px]">
                <Product3DViewer
                  modelUrl={product.model3D}
                  imageUrl={product.image}
                  productName={product.name}
                  interactive={true}
                />
              </div>

              {product.model3D && (
                <p className="mt-4 text-center text-sm text-zinc-500">
                  Drag to rotate • Scroll to zoom • 3D view
                </p>
              )}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-red-600">
              {product.brand}
            </p>

            <h1 className="mt-3 text-4xl font-bold md:text-6xl">
              {product.name}
            </h1>

            <p className="mt-4 text-lg text-zinc-500">{product.category}</p>

            <p
              className={`mt-5 inline-block rounded-full px-4 py-2 text-sm font-bold ${
                product.stock === "In Stock"
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {product.stock}
            </p>

            <div className="mt-8">
              <p className="text-4xl font-bold">
                {formatCurrency(displayPrice)}
                <span className="ml-2 text-base font-semibold text-zinc-400">
                  / unit
                </span>
              </p>

              {pricing && pricing.unitPrice < pricing.retailUnitPrice && (
                <p className="mt-2 text-sm font-semibold text-red-600">
                  {pricing.label} — retail{" "}
                  <span className="line-through">
                    {formatCurrency(pricing.retailUnitPrice)}
                  </span>
                </p>
              )}

              {pricing?.wholesaleEligible && !pricing.tierMinQuantity && (
                <p className="mt-2 text-sm font-semibold text-zinc-500">
                  Retail price — quantity below wholesale tier
                </p>
              )}

              {isWholesale && pricing?.nextTier && (
                <p className="mt-1 text-sm text-zinc-500">
                  Add {pricing.nextTier.unitsAway} more unit(s) to pay{" "}
                  {formatCurrency(pricing.nextTier.unitPrice)}/unit
                </p>
              )}

              {!isWholesale && userRole !== "admin" && (
                <p className="mt-2 text-sm text-zinc-500">
                  Wholesale pricing is available for approved business
                  accounts. Contact the store to open one.
                </p>
              )}

              <div className="mt-5 flex items-center gap-3">
                <span className="text-sm font-semibold">Quantity</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="h-9 w-9 rounded-full border font-bold"
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={9999}
                    value={quantity}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      setQuantity(
                        Number.isFinite(next)
                          ? Math.min(9999, Math.max(1, Math.floor(next)))
                          : 1
                      );
                    }}
                    className="w-20 rounded-xl border px-3 py-2 text-center outline-none focus:border-red-500"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.min(9999, quantity + 1))}
                    className="h-9 w-9 rounded-full border font-bold"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>

                {pricing && (
                  <span className="text-sm text-zinc-500">
                    Total:{" "}
                    <span className="font-bold text-zinc-900">
                      {formatCurrency(pricing.lineTotal)}
                    </span>
                    {pricing.savings > 0 && (
                      <span className="ml-2 font-semibold text-green-600">
                        Save {formatCurrency(pricing.savings)}
                      </span>
                    )}
                  </span>
                )}
              </div>

              {isWholesale && product.tiers && product.tiers.length > 0 && (
                <div className="mt-6 overflow-hidden rounded-2xl border">
                  <p className="border-b bg-zinc-100 px-4 py-3 text-sm font-bold">
                    Your wholesale quantity pricing
                  </p>
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-zinc-500">
                      <tr>
                        <th className="px-4 py-2">Quantity</th>
                        <th className="px-4 py-2">Unit price</th>
                        <th className="px-4 py-2">vs retail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(product.tiers[0]?.minQuantity ?? 1) > 1 && (
                        <tr
                          className={
                            pricing && !pricing.tierMinQuantity
                              ? "bg-red-50 font-semibold"
                              : ""
                          }
                        >
                          <td className="px-4 py-2">
                            1–{(product.tiers[0]?.minQuantity ?? 2) - 1}
                          </td>
                          <td className="px-4 py-2">{formatCurrency(product.price)}</td>
                          <td className="px-4 py-2 text-zinc-500">Retail</td>
                        </tr>
                      )}
                      {product.tiers.map((tier, index) => {
                        const nextTier = product.tiers?.[index + 1];
                        const range = nextTier
                          ? `${tier.minQuantity}–${nextTier.minQuantity - 1}`
                          : `${tier.minQuantity}+`;
                        const isApplied =
                          pricing?.tierMinQuantity === tier.minQuantity;

                        return (
                          <tr
                            key={tier.minQuantity}
                            className={isApplied ? "bg-red-50 font-semibold" : ""}
                          >
                            <td className="px-4 py-2">{range}</td>
                            <td className="px-4 py-2">
                              {formatCurrency(tier.unitPrice)}
                            </td>
                            <td className="px-4 py-2 text-green-600">
                              −{formatCurrency(product.price - tier.unitPrice)}
                              /unit
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {product.type === "laptop" ? (
              <div className="mt-8 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-zinc-100 p-4">
                  <p className="text-xs text-zinc-500">CPU</p>
                  <p className="font-bold">{product.specs.cpu}</p>
                </div>

                <div className="rounded-2xl bg-zinc-100 p-4">
                  <p className="text-xs text-zinc-500">RAM</p>
                  <p className="font-bold">{product.specs.ram}</p>
                </div>

                <div className="rounded-2xl bg-zinc-100 p-4">
                  <p className="text-xs text-zinc-500">Storage</p>
                  <p className="font-bold">{product.specs.storage}</p>
                </div>

                <div className="rounded-2xl bg-zinc-100 p-4">
                  <p className="text-xs text-zinc-500">Display</p>
                  <p className="font-bold">{product.specs.display}</p>
                </div>
              </div>
            ) : (
              <p className="mt-8 rounded-2xl bg-zinc-100 p-5">
                {product.specs.detail}
              </p>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              {currentUser ? (
                <>
                  <button onClick={() => addToCart(product)}
                    disabled={product.stock === "Out of Stock"}
                    className="rounded-full bg-red-600 px-7 py-3 font-semibold text-white disabled:bg-zinc-400">
                    Add to Cart
                  </button>
                  <button onClick={() => toggleWishlist(product)}
                    className="rounded-full border px-7 py-3 font-semibold">
                    {isWishlisted ? "♥ Saved" : "♡ Add to Wishlist"}
                  </button>
                </>
              ) : (
                <Link href="/login"
                  className="rounded-full bg-red-600 px-7 py-3 font-semibold text-white">
                  Login to purchase
                </Link>
              )}

              <Link
                href={`/compare?primary=${product.id}`}
                className="rounded-full border px-7 py-3 font-semibold"
              >
                Compare
              </Link>
            </div>

            {cartMessage && (
              <p className="mt-4 rounded-2xl bg-zinc-100 p-4 text-sm">
                {cartMessage}
              </p>
            )}

            <div className="mt-12">
              <h2 className="text-3xl font-bold">Full Specifications</h2>

              <div className="mt-5 overflow-hidden rounded-[2rem] border">
                {specRows.map((row) => (
                  <div
                    key={row.label}
                    className="grid grid-cols-[150px_1fr] border-b last:border-b-0 md:grid-cols-[220px_1fr]"
                  >
                    <div className="bg-zinc-100 p-4 font-semibold">
                      {row.label}
                    </div>

                    <div className="p-4 text-zinc-700">{row.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {relatedProducts.length > 0 && (
          <section className="mt-20">
            <h2 className="mb-6 text-3xl font-bold">Related Products</h2>

            <div className="grid gap-5 md:grid-cols-3">
              {relatedProducts.map((item) => (
                <Link
                  key={item.id}
                  href={`/products/${item.id}`}
                  className="rounded-[2rem] bg-zinc-100 p-5 transition hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="h-40 rounded-[1.5rem] bg-white p-5">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-full w-full object-contain"
                    />
                  </div>

                  <h3 className="mt-4 font-bold">{item.name}</h3>

                  <p className="mt-1 text-sm text-zinc-500">
                    {formatCurrency(item.price)}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
