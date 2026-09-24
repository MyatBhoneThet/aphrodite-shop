"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Product, UserRole } from "../../data/products";
import ProductPrice from "../../components/ProductPrice";
import { effectiveProductPrice } from "../../lib/promotions";
import ProductGallery from "../../components/ProductGallery";
import BrandLogo from "../../components/BrandLogo";
import ProductAlertButtons, {
  type FollowedAlert,
} from "../../components/ProductAlertButtons";
import { authHeaders } from "../../lib/client-auth";
import { formatCurrency, formatProductPrice } from "../../lib/format";
import {
  productVariant,
  type ProductVariantOption,
} from "../../lib/product-variants";
import { getProductSpecifications } from "../../lib/product-specifications";
import { useCurrentUser } from "../../lib/useCurrentUser";
import { useLanguage } from "../../lib/language";
import { useDeliveryEstimate } from "../../lib/useDeliveryEstimate";
import DeliveryEstimateBadge from "../../components/DeliveryEstimateBadge";

type PublicTier = { minQuantity: number; unitPrice: number };

type Pricing = {
  promotional?: boolean;
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
  variants?: ProductVariantOption[];
};

export default function ProductDetailsPage() {
  const { t, text } = useLanguage();
  const params = useParams();
  const router = useRouter();
  const productId = Number(params.id);

  const { user: currentUser } = useCurrentUser();
  const deliveryEstimate = useDeliveryEstimate(Boolean(currentUser && currentUser.role !== "admin"));
  const [product, setProduct] = useState<ProductResponse["product"] | null>(null);
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [isWholesale, setIsWholesale] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariantOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [wishlistItemId, setWishlistItemId] = useState<string | null>(null);
  const [cartMessage, setCartMessage] = useState("");
  const [alerts, setAlerts] = useState<FollowedAlert[]>([]);

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
        setVariants([]);
        setIsLoading(false);
        return;
      }

      const data = (await response.json()) as ProductResponse;

      if (cancelled) return;

      setProduct(data.product);
      setPricing(data.pricing);
      setIsWholesale(data.wholesale);
      setRelatedProducts(data.relatedProducts);
      setVariants(data.variants ?? []);
      setIsLoading(false);
    }

    void loadProduct();
    // Refresh scheduled promotions and wholesale eligibility while this quote is open.
    const timer = window.setInterval(() => void loadProduct(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
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

  useEffect(() => {
    async function loadAlerts() {
      if (!currentUser || !product) {
        setAlerts([]);
        return;
      }

      const response = await fetch("/api/alerts", {
        headers: authHeaders(),
        cache: "no-store",
      });

      // A missing alerts table (migration not run yet) must not break the
      // product page -- the follow buttons simply stay unset.
      if (!response.ok) return;

      const data = (await response.json()) as { alerts: FollowedAlert[] };
      setAlerts(data.alerts);
    }

    void loadAlerts();
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

  const specification = useMemo(
    () => (product ? getProductSpecifications(product) : null),
    [product]
  );

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-zinc-950">
        {text("Loading product...")}
      </main>
    );
  }

  if (!product) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-5 text-center text-zinc-950">
        <div>
          <h1 className="text-3xl font-bold">{t("detail.notFound")}</h1>

          <p className="mt-3 text-zinc-500">
            {text("The product you are looking for does not exist.")}
          </p>

          <Link
            href="/"
            className="mt-6 inline-block rounded-full bg-red-600 px-6 py-3 font-semibold text-white"
          >
            {text("Back to Store")}
          </Link>
        </div>
      </main>
    );
  }

  const displayPrice = pricing?.unitPrice ?? product.price;
  // With version buttons, the title is the model and the selected button says which version.
  const modelName =
    variants.length > 1 ? productVariant(product)?.model ?? product.name : product.name;

  function goToPreviousPage() {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }

  async function addToCart(productItem: Product) {
    if (!currentUser) {
      setCartMessage(t("detail.loginToCart"));
      return;
    }

    if (productItem.stock === "Out of Stock") {
      setCartMessage(t("detail.outOfStockMessage"));
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

    setCartMessage(t("detail.addedToCart"));
  }

  async function toggleWishlist(productItem: Product) {
    if (!currentUser) {
      setCartMessage(t("detail.loginToSave"));
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
            <BrandLogo />
          </Link>

          <button
            type="button"
            onClick={goToPreviousPage}
            className="rounded-full border px-5 py-2 text-sm"
          >
            ← {text("Back")}
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-10">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <div className="sticky top-8">
              <ProductGallery key={product.id} product={product} />
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-red-600">
              {product.brand}
            </p>

            <h1 className="mt-3 text-3xl font-bold leading-tight md:text-4xl">
              {modelName}
            </h1>

            <p className="mt-4 text-lg text-zinc-500">{text(product.category)}</p>

            <p
              className={`mt-5 inline-block rounded-full px-4 py-2 text-sm font-bold ${
                product.stock === "In Stock"
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {text(product.stock)}
            </p>

            {variants.length > 1 && (
              <div className="mt-6">
                <p className="text-sm font-bold uppercase tracking-wide text-zinc-500">
                  {text("Choose version")}
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {variants.map((option) => {
                    const selected = option.id === product.id;
                    const soldOut = option.stock !== "In Stock";

                    return (
                      <Link
                        key={option.id}
                        href={`/products/${option.id}`}
                        replace
                        scroll={false}
                        aria-current={selected ? "true" : undefined}
                        onClick={() => setCartMessage("")}
                        className={`min-w-36 rounded-2xl border-2 px-5 py-3 text-left transition ${
                          selected
                            ? "border-red-600 bg-red-50"
                            : "border-zinc-200 bg-white hover:border-red-300"
                        }`}
                      >
                        <span className="block font-bold">{option.label}</span>
                        <span
                          className={`mt-1 block text-xs font-semibold ${
                            soldOut ? "text-red-600" : "text-zinc-500"
                          }`}
                        >
                          {soldOut ? text("Out of stock") : formatProductPrice(option.price)}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-8">
              <ProductPrice price={product.price > 0 ? displayPrice : 0} regularPrice={product.price} large />
              {pricing?.tierMinQuantity && <p className="mt-2 text-sm font-semibold text-zinc-500">{pricing.label}</p>}

              {product.price > 0 && pricing?.wholesaleEligible && !pricing.tierMinQuantity && !pricing.promotional && (
                <p className="mt-2 text-sm font-semibold text-zinc-500">
                  {text("Retail price \u2014 quantity below wholesale tier")}
                </p>
              )}

              {product.price > 0 && isWholesale && pricing?.nextTier && (
                <p className="mt-1 text-sm text-zinc-500">
                  Add {pricing.nextTier.unitsAway} more unit(s) to pay{" "}
                  {formatCurrency(pricing.nextTier.unitPrice)}/unit
                </p>
              )}

              {!isWholesale && userRole !== "admin" && (
                <p className="mt-2 text-sm text-zinc-500">
                  {text("Wholesale pricing is available for approved business accounts. Contact the store to open one.")}
                </p>
              )}

              <DeliveryEstimateBadge estimate={deliveryEstimate} />

              <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-3">
                <span className="shrink-0 text-sm font-semibold">{t("detail.quantity")}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="h-9 w-9 rounded-full border font-bold"
                    aria-label={t("detail.decrease")}
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
                    aria-label={t("detail.increase")}
                  >
                    +
                  </button>
                </div>

                {product.price > 0 && pricing && (
                  // On a phone the total drops to its own line instead of squeezing the stepper.
                  <span className="w-full text-sm text-zinc-500 sm:w-auto">
                    {text("Total:")}{" "}
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

              {product.price > 0 && isWholesale && product.tiers && product.tiers.length > 0 && (
                <div className="mt-6 overflow-hidden rounded-2xl border">
                  <p className="border-b bg-zinc-100 px-4 py-3 text-sm font-bold">
                    {text("Your wholesale quantity pricing")}
                  </p>
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-zinc-500">
                      <tr>
                        <th className="px-4 py-2">{t("detail.quantity")}</th>
                        <th className="px-4 py-2">{t("detail.unitPrice")}</th>
                        <th className="px-4 py-2">{text("vs retail")}</th>
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
                          <td className="px-4 py-2">{formatProductPrice(effectiveProductPrice(product))}</td>
                          <td className="px-4 py-2 text-zinc-500">{effectiveProductPrice(product) < product.price ? t("product.promotionalPrice") : t("detail.retail")}</td>
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

            <div className="mt-8 flex flex-wrap gap-3">
              {currentUser ? (
                <>
                  <button onClick={() => addToCart(product)}
                    disabled={product.stock === "Out of Stock" || product.price <= 0}
                    className="rounded-lg bg-red-600 px-7 py-3 font-semibold text-white disabled:bg-zinc-400">
                    {product.price <= 0 ? t("detail.pricePending") : t("detail.addToCart")}
                  </button>
                  <button onClick={() => toggleWishlist(product)}
                    className="rounded-lg border px-7 py-3 font-semibold">
                    {isWishlisted ? text("♥ Saved") : text("♡ Add to Wishlist")}
                  </button>
                </>
              ) : (
                <Link href="/login"
                  className="rounded-lg bg-red-600 px-7 py-3 font-semibold text-white">
                  {text("Login to purchase")}
                </Link>
              )}

              <Link
                href={`/compare?primary=${product.id}`}
                className="rounded-lg border px-7 py-3 font-semibold"
              >
                {text("Compare")}
              </Link>
            </div>

            {currentUser && (
              <ProductAlertButtons
                product={product}
                alerts={alerts}
                onChange={setAlerts}
              />
            )}

            {cartMessage && (
              <p className="mt-4 rounded-2xl bg-zinc-100 p-4 text-sm">
                {cartMessage}
              </p>
            )}

            {specification && (
            <div className="mt-12">
              <h2 className="text-3xl font-bold">{text(specification.title)}</h2>
              <p className="mt-2 text-sm text-zinc-500">
                {text("Only specifications relevant to this product category are shown.")}
              </p>

              <div className="mt-5 overflow-hidden rounded-lg border">
                {specification.rows.map((row) => (
                  <div
                    key={row.label}
                    className="grid grid-cols-1 border-b last:border-b-0 sm:grid-cols-[150px_minmax(0,1fr)] md:grid-cols-[220px_minmax(0,1fr)]"
                  >
                    <div className="bg-zinc-100 p-4 font-semibold">
                      {text(row.label)}
                    </div>

                    <div className="p-4 text-zinc-700">{row.label === "Category" || row.label === "Availability" ? text(row.value) : row.value}</div>
                  </div>
                ))}
              </div>
            </div>
            )}
          </div>
        </div>

        {relatedProducts.length > 0 && (
          <section className="mt-20">
            <h2 className="mb-6 text-3xl font-bold">{t("detail.related")}</h2>

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

                  <div className="mt-2"><ProductPrice price={effectiveProductPrice(item)} regularPrice={item.price} /></div>
                  <DeliveryEstimateBadge estimate={deliveryEstimate} compact />
                </Link>
              ))}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
