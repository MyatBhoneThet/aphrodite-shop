"use client";

import ProductPrice from "../components/ProductPrice";
import { effectiveProductPrice } from "../lib/promotions";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Product } from "../data/products";
import ProductAlertButtons, {
  type FollowedAlert,
} from "../components/ProductAlertButtons";
import { authHeaders } from "../lib/client-auth";
import { useCurrentUser } from "../lib/useCurrentUser";
import { useLanguage } from "../lib/language";
import { useDeliveryEstimate } from "../lib/useDeliveryEstimate";
import DeliveryEstimateBadge from "../components/DeliveryEstimateBadge";

type WishlistItem = {
  id: string;
  product_id: number;
  product: Product;
};

export default function WishlistPage() {
  const { user, status: userStatus } = useCurrentUser();
  const { t } = useLanguage();
  const deliveryEstimate = useDeliveryEstimate(Boolean(user && user.role !== "admin" && user.role !== "staff"));
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [alerts, setAlerts] = useState<FollowedAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadWishlist = useCallback(async () => {
    setIsLoading(true);

    // Alerts ride along with the wishlist so each card can show whether the
    // customer is watching it, without one request per product.
    const [wishlistResponse, alertResponse] = await Promise.all([
      fetch("/api/wishlist", { headers: authHeaders() }),
      fetch("/api/alerts", { headers: authHeaders(), cache: "no-store" }),
    ]);

    if (wishlistResponse.ok) {
      const data = (await wishlistResponse.json()) as { items: WishlistItem[] };
      setItems(data.items);
    }

    if (alertResponse.ok) {
      const data = (await alertResponse.json()) as { alerts: FollowedAlert[] };
      setAlerts(data.alerts);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    async function loadOnMount() {
      if (userStatus === "ready" && user) {
        await loadWishlist();
      } else if (userStatus === "ready") {
        setIsLoading(false);
      }
    }

    loadOnMount();
  }, [userStatus, user, loadWishlist]);

  async function removeItem(id: string) {
    setError("");

    const response = await fetch(`/api/wishlist/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Unable to remove item.");
      return;
    }

    const data = (await response.json()) as { items: WishlistItem[] };
    setItems(data.items);
  }

  async function addToCart(productId: number) {
    setError("");

    const response = await fetch("/api/cart", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId, quantity: 1 }),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Unable to add to cart.");
    }
  }

  if (userStatus === "checking" || isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-zinc-950">
        Loading your wishlist...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-5 text-center text-zinc-950">
        <div>
          <h1 className="text-3xl font-bold">{t("wishlist.loginTitle")}</h1>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/login"
              className="rounded-full bg-red-600 px-6 py-3 font-semibold text-white"
            >
              {t("nav.login")}
            </Link>
            <Link href="/" className="rounded-full border px-6 py-3 font-semibold">
              Back to Store
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const news = alerts.filter((alert) => alert.status.triggered);
  const productName = (productId: number) =>
    items.find((item) => item.product_id === productId)?.product.name ??
    "A product you follow";

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

      <section className="mx-auto max-w-5xl px-5 py-10">
        <h1 className="text-4xl font-bold">{t("wishlist.title")}</h1>
        <p className="mt-2 text-zinc-500">
          Follow a product and we will tell you here when it comes back in stock
          or the price drops.
        </p>

        {error && (
          <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </p>
        )}

        {/* Good news first */}
        {news.length > 0 && (
          <section
            aria-label={t("wishlist.alerts")}
            className="mt-6 rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6"
          >
            <h2 className="text-lg font-black text-emerald-900">
              🎉 {news.length} update{news.length === 1 ? "" : "s"} for you
            </h2>
            <ul className="mt-4 space-y-3">
              {news.map((alert) => (
                <li
                  key={alert.id}
                  className="rounded-2xl border border-emerald-200 bg-white p-4"
                >
                  <p className="text-sm font-black text-emerald-800">
                    {alert.status.headline}
                  </p>
                  <p className="mt-1 font-bold">
                    <Link
                      href={`/products/${alert.product_id}`}
                      className="hover:text-red-600"
                    >
                      {productName(alert.product_id)}
                    </Link>
                  </p>
                  <p className="mt-1 text-sm text-zinc-600">
                    {alert.status.detail}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {items.length === 0 ? (
          <div className="mt-8 rounded-[2rem] bg-zinc-100 p-10 text-center">
            <p className="text-lg font-semibold">{t("wishlist.empty")}</p>
            <Link
              href="/"
              className="mt-5 inline-block rounded-full bg-red-600 px-6 py-3 font-semibold text-white"
            >
              Browse products
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {items.map((item) => (
              <article key={item.id} className="rounded-[2rem] bg-zinc-100 p-5 text-center">
                <Link href={`/products/${item.product.id}`} className="block">
                  <div className="h-40 rounded-[1.5rem] bg-white p-5">
                    <img
                      src={item.product.image}
                      alt={item.product.name}
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <h3 className="mt-4 font-bold">{item.product.name}</h3>
                </Link>

                <div className="mt-2"><ProductPrice price={effectiveProductPrice(item.product)} regularPrice={item.product.price} /></div>
                <DeliveryEstimateBadge estimate={deliveryEstimate} compact />

                <p
                  className={`mt-1 text-xs font-bold ${
                    item.product.stock === "In Stock"
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {item.product.stock}
                </p>

                <p
                  className={`mt-1 text-xs font-bold ${
                    item.product.stock === "In Stock"
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {item.product.stock}
                </p>

                <div className="mt-4 flex justify-center gap-2">
                  <button
                    onClick={() => addToCart(item.product.id)}
                    disabled={item.product.stock === "Out of Stock"}
                    className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-zinc-400"
                  >
                    Add to cart
                  </button>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="rounded-full border bg-white px-4 py-2 text-sm text-red-600"
                  >
                    Remove
                  </button>
                </div>

                <div className="mt-4 border-t border-zinc-200 pt-4">
                  <ProductAlertButtons
                    product={item.product}
                    alerts={alerts}
                    onChange={setAlerts}
                    compact
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
