"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Product, UserRole } from "../data/products";
import {
  CATALOG_SECTION_DETAILS,
  type CatalogSection,
} from "../lib/catalog";
import { authHeaders, clearStoredAuth } from "../lib/client-auth";
import {
  EMPTY_PRODUCT_FILTERS,
  filterAndSortProducts,
  type ProductFilterState,
} from "../lib/product-filters";
import { useCurrentUser } from "../lib/useCurrentUser";
import ChatbotButton from "./ChatbotButton";
import BackToTopButton from "./BackToTopButton";
import Navbar from "./Navbar";
import ProductFilters from "./ProductFilters";
import ProductSection from "./ProductSection";
import { groupProductVariants } from "../lib/product-variants";
import { useLanguage } from "../lib/language";
import { activePromotion } from "../lib/promotions";
import { useDeliveryEstimate } from "../lib/useDeliveryEstimate";

type Props = {
  section: CatalogSection;
};

function matchesSearch(product: Product, search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return true;

  return [product.name, product.brand, product.category]
    .some((value) => value.toLowerCase().includes(query));
}

export default function CategoryCatalogPage({ section }: Props) {
  const details = CATALOG_SECTION_DETAILS[section];
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  // Shared with every other page, and remembered between visits.
  const { language, setLanguage, t } = useLanguage();
  const [promotionTime, setPromotionTime] = useState(() => new Date());

  useEffect(() => {
    // Re-evaluate scheduled offers while the catalogue stays open.
    const refresh = () => setPromotionTime(new Date());
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  const [filters, setFilters] = useState<ProductFilterState>({
    ...EMPTY_PRODUCT_FILTERS,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [wishlist, setWishlist] = useState<number[]>([]);
  const [cart, setCart] = useState<number[]>([]);
  const { user: currentUser, refresh: refreshUser } = useCurrentUser();
  const deliveryEstimate = useDeliveryEstimate(Boolean(currentUser && currentUser.role !== "admin" && currentUser.role !== "staff"));

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      setIsLoading(true);
      setError("");

      try {
        const loaded: Product[] = [];

        for (let offset = 0; offset < 1_000; offset += 100) {
          const params = new URLSearchParams({
            sourceSheet: section,
            limit: "100",
            offset: String(offset),
          });
          const response = await fetch(`/api/products?${params.toString()}`, {
            headers: authHeaders(),
            cache: "no-store",
          });
          const data = (await response.json().catch(() => null)) as
            | { products?: Product[]; error?: string }
            | null;

          if (!response.ok) {
            throw new Error(
              data?.error ?? `Unable to load the ${details.title} catalogue.`
            );
          }

          const page = data?.products ?? [];
          loaded.push(...page);
          if (page.length < 100) break;
        }

        if (!cancelled) {
          setProducts([
            ...new Map(loaded.map((product) => [product.id, product])).values(),
          ]);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : `Unable to load the ${details.title} catalogue.`
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadProducts();
    return () => {
      cancelled = true;
    };
  }, [details.title, section]);

  useEffect(() => {
    async function loadCustomerLists() {
      if (!currentUser) {
        setWishlist([]);
        setCart([]);
        return;
      }

      const [wishlistResponse, cartResponse] = await Promise.all([
        fetch("/api/wishlist", { headers: authHeaders() }),
        fetch("/api/cart", { headers: authHeaders() }),
      ]);

      if (wishlistResponse.ok) {
        const data = (await wishlistResponse.json()) as {
          items: { product?: Product; id?: number }[];
        };
        setWishlist(
          data.items
            .map((item) => item.product?.id ?? item.id)
            .filter((id): id is number => typeof id === "number")
        );
      }

      if (cartResponse.ok) {
        const data = (await cartResponse.json()) as {
          items: { product: Product; quantity: number }[];
        };
        setCart(
          data.items.flatMap((item) =>
            Array.from({ length: item.quantity }, () => item.product.id)
          )
        );
      }
    }

    void loadCustomerLists();
  }, [currentUser]);

  const searchedProducts = useMemo(
    () => products.filter((product) => matchesSearch(product, search)),
    [products, search]
  );
  const visibleProducts = useMemo(
    () => {
      // Price filters and sorting must also refresh when an offer changes.
      void promotionTime;
      return filterAndSortProducts(searchedProducts, filters);
    },
    [searchedProducts, filters, promotionTime]
  );
  const { promotionProducts, regularProducts } = useMemo(() => {
    const promotionProducts: Product[] = [];
    const regularProducts: Product[] = [];
    for (const product of visibleProducts) {
      const target = activePromotion(product.price, product.fullSpecs?.promotion, promotionTime)
        ? promotionProducts
        : regularProducts;
      target.push(product);
    }
    return { promotionProducts, regularProducts };
  }, [visibleProducts, promotionTime]);
  const resultCount = groupProductVariants(promotionProducts).length
    + groupProductVariants(regularProducts).length;
  const sectionKey = `${section}-${search}-${JSON.stringify(filters)}`;

  const brands = useMemo(
    () =>
      Array.from(new Set(products.map((product) => product.brand))).sort(
        (left, right) => left.localeCompare(right)
      ),
    [products]
  );
  const categories = useMemo(
    () =>
      Array.from(new Set(products.map((product) => product.category))).sort(
        (left, right) => left.localeCompare(right)
      ),
    [products]
  );
  const searchSuggestions = useMemo(
    () =>
      products
        .filter((product) => matchesSearch(product, search))
        .slice(0, 6),
    [products, search]
  );
  const userRole: UserRole = currentUser?.role ?? "normal";

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    clearStoredAuth();
    await refreshUser();
    setWishlist([]);
    setCart([]);
  }

  return (
    <main className="min-h-screen bg-white text-zinc-950">
      <Navbar
        search={search}
        setSearch={setSearch}
        searchSuggestions={searchSuggestions}
        language={language}
        setLanguage={setLanguage}
        cartCount={cart.length}
        wishlistCount={wishlist.length}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      <section className="border-b bg-zinc-950 px-5 py-14 text-white">
        <div className="mx-auto max-w-7xl">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-bold text-zinc-300 hover:text-white"
          >
            ← Back to store
          </Link>
          <p className="mt-8 text-sm font-bold uppercase tracking-[0.24em] text-red-400">
            Aphrodite Myanmar catalogue
          </p>
          <h1 className="mt-3 text-4xl font-black sm:text-6xl">
            {details.title}
          </h1>
          <p className="mt-4 max-w-3xl text-zinc-300">
            {details.description}
          </p>
        </div>
      </section>

      <div className="pt-12">
        <ProductFilters
          brands={brands}
          categories={categories}
          filters={filters}
          resultCount={resultCount}
          onChange={setFilters}
        />

        {error && (
          <p
            role="alert"
            className="mx-auto mb-8 max-w-3xl rounded-2xl bg-red-50 p-4 text-center text-sm font-bold text-red-700"
          >
            {error}
          </p>
        )}

        {isLoading ? (
          <p className="px-5 pb-20 text-center text-zinc-500">
            Loading {details.title.toLowerCase()}...
          </p>
        ) : (
          <>
            {promotionProducts.length > 0 && (
              <div className="mb-12 border-y border-red-100 bg-red-50/50 pt-10">
                <ProductSection
                  key={`promotions-${sectionKey}`}
                  title={t("section.promotions")}
                  products={promotionProducts}
                  userRole={userRole}
                  deliveryEstimate={deliveryEstimate}
                />
              </div>
            )}
            {(regularProducts.length > 0 || promotionProducts.length === 0) && (
              <ProductSection
                key={`regular-${sectionKey}`}
                title={t("section.regularItems")}
                products={regularProducts}
                userRole={userRole}
                deliveryEstimate={deliveryEstimate}
              />
            )}
          </>
        )}
      </div>

      <BackToTopButton />
      <ChatbotButton
        language={language}
        currentUser={currentUser}
        products={products}
      />
    </main>
  );
}
