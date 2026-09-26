"use client";

import { useEffect, useMemo, useState } from "react";
import type { Product, UserRole } from "./data/products";
import Navbar from "./components/Navbar";
import HeroSlider from "./components/HeroSlider";
import CategoryGrid from "./components/CategoryGrid";
import ProductSection from "./components/ProductSection";
import { groupProductVariants } from "./lib/product-variants";
import ChatbotButton from "./components/ChatbotButton";
import SiteContact from "./components/SiteContact";
import ProductFilters from "./components/ProductFilters";
import RecentlyViewedSection from "./components/RecentlyViewedSection";
import { authHeaders, clearStoredAuth } from "./lib/client-auth";
import { useCurrentUser } from "./lib/useCurrentUser";
import { useDebouncedValue } from "./lib/useDebouncedValue";
import { useLanguage } from "./lib/language";
import {
  belongsToCatalogSection,
  CATALOG_SECTION_DETAILS,
  shuffleProducts,
} from "./lib/catalog";
import {
  EMPTY_PRODUCT_FILTERS,
  filterAndSortProducts,
  type ProductFilterState,
} from "./lib/product-filters";
import { useDeliveryEstimate } from "./lib/useDeliveryEstimate";

export default function HomePage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  // Shared with every other page, and remembered between visits.
  const { language, setLanguage, text } = useLanguage();
  const { user: currentUser, refresh: refreshUser } = useCurrentUser();
  const deliveryEstimate = useDeliveryEstimate(Boolean(currentUser && currentUser.role !== "admin" && currentUser.role !== "staff"));
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [productLoadError, setProductLoadError] = useState("");
  const [filters, setFilters] = useState<ProductFilterState>({
    ...EMPTY_PRODUCT_FILTERS,
  });
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);

  const [wishlist, setWishlist] = useState<number[]>([]);
  const [cart, setCart] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      setIsLoadingProducts(true);
      setProductLoadError("");
      const searchTerm = debouncedSearch.trim();

      try {
        const loaded: Product[] = [];
        for (let offset = 0; offset < 1_000; offset += 100) {
          const params = new URLSearchParams({
            limit: "100",
            offset: String(offset),
          });
          if (searchTerm) params.set("q", searchTerm);

          // authHeaders() covers legacy bearer sessions; cookie sessions ride
          // along automatically and make the API attach wholesale tiers.
          const response = await fetch(`/api/products?${params.toString()}`, {
            headers: authHeaders(),
            cache: "no-store",
          });
          const data = (await response.json().catch(() => null)) as
            | { products?: Product[]; error?: string }
            | null;
          if (!response.ok) {
            throw new Error(
              data?.error ?? "Unable to load the product catalogue."
            );
          }

          const page = data?.products ?? [];
          loaded.push(...page);
          // Search is applied to the full filtered set by the API and is
          // returned in one response. Normal browsing uses 100-row pages.
          if (searchTerm || page.length < 100) break;
        }

        if (cancelled) return;
        const uniqueProducts = [
          ...new Map(loaded.map((product) => [product.id, product])).values(),
        ];
        setProducts(shuffleProducts(uniqueProducts));
      } catch (error) {
        if (cancelled) return;
        setProducts([]);
        setProductLoadError(
          error instanceof Error ? error.message : "Unable to load products."
        );
      } finally {
        if (!cancelled) setIsLoadingProducts(false);
      }
    }

    void loadProducts();

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

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

    loadCustomerLists();
  }, [currentUser]);

  useEffect(() => {
    async function loadRecentlyViewed() {
      if (!currentUser || currentUser.role === "admin" || currentUser.role === "staff") {
        setRecentlyViewed([]);
        return;
      }

      const response = await fetch("/api/recently-viewed", {
        headers: authHeaders(),
        cache: "no-store",
      });

      if (!response.ok) return;

      const data = (await response.json()) as {
        items: { product: Product }[];
      };
      setRecentlyViewed(data.items.map((item) => item.product));
    }

    void loadRecentlyViewed();
  }, [currentUser]);

  const userRole: UserRole = currentUser?.role ?? "normal";
  // Signed-in customers get a compact homepage preview. Full category pages
  // keep their normal pagination and the public homepage remains unchanged.
  const compactSignedInHomepage = Boolean(currentUser && currentUser.role !== "admin" && currentUser.role !== "staff");
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
  const visibleProducts = useMemo(
    () => filterAndSortProducts(products, filters),
    [products, filters]
  );
  const searchSuggestions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return products
      .filter((product) =>
        [product.name, product.brand, product.category, product.sourceSheet]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
      )
      .sort((left, right) => {
        const leftStarts = left.name.toLowerCase().startsWith(query) || left.brand.toLowerCase().startsWith(query);
        const rightStarts = right.name.toLowerCase().startsWith(query) || right.brand.toLowerCase().startsWith(query);
        return Number(rightStarts) - Number(leftStarts) || left.name.localeCompare(right.name);
      })
      .slice(0, 6);
  }, [products, search]);

  // Sections mirror the production workbook tabs. Manual products carry no
  // sourceSheet and fall back to their product type.
  const laptopProducts = visibleProducts.filter((product) =>
    belongsToCatalogSection(product, "Laptops")
  );

  const accessoryProducts = visibleProducts.filter((product) =>
    belongsToCatalogSection(product, "Accessories")
  );

  const pcPartProducts = visibleProducts.filter((product) =>
    belongsToCatalogSection(product, "PC Parts")
  );

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    clearStoredAuth();
    await refreshUser();
    setWishlist([]);
    setCart([]);
  }

  async function clearRecentlyViewed() {
    const response = await fetch("/api/recently-viewed", {
      method: "DELETE",
      headers: authHeaders(),
    });

    if (response.ok) {
      setRecentlyViewed([]);
    }
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

      <HeroSlider language={language} />

      <CategoryGrid language={language} />

      <ProductFilters
        brands={brands}
        categories={categories}
        filters={filters}
        resultCount={groupProductVariants(visibleProducts).length}
        onChange={setFilters}
      />

      <div id="laptops">
        {productLoadError && (
          <p
            role="alert"
            className="mx-auto mb-8 max-w-3xl rounded-2xl bg-red-50 p-4 text-center text-sm font-bold text-red-700"
          >
            {productLoadError}
          </p>
        )}
        {isLoadingProducts ? (
          <p className="px-5 pb-16 text-center text-zinc-500">
            Loading products...
          </p>
        ) : (
          <ProductSection
            title={text("Laptops")}
            products={laptopProducts}
            userRole={userRole}
            viewAllHref={CATALOG_SECTION_DETAILS.Laptops.href}
            viewAllLabel={language === "en" ? "View all laptops" : "အားလုံးကြည့်ရန်"}
            deliveryEstimate={deliveryEstimate}
            itemsPerPage={compactSignedInHomepage ? 4 : undefined}
            showPagination={!compactSignedInHomepage}
          />
        )}
      </div>

      <div id="accessories">
        <ProductSection
          title={text("Accessories")}
          products={accessoryProducts}
          userRole={userRole}
          viewAllHref={CATALOG_SECTION_DETAILS.Accessories.href}
          viewAllLabel={language === "en" ? "View all accessories" : "အားလုံးကြည့်ရန်"}
          deliveryEstimate={deliveryEstimate}
          itemsPerPage={compactSignedInHomepage ? 4 : undefined}
          showPagination={!compactSignedInHomepage}
        />
      </div>

      <div id="pc-parts">
        <section className="mx-auto max-w-7xl px-5 pb-10">
          <div className="flex flex-col items-start justify-between gap-5 rounded-[2rem] bg-zinc-950 p-8 text-white md:flex-row md:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-red-400">
                New: PC Build Planner
              </p>
              <h2 className="mt-2 text-3xl font-black">
                What PC can your budget build?
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-zinc-300">
                Enter a minimum and maximum budget, choose gaming, office,
                development, streaming, creative, or 3D work, and generate a
                complete demo parts list using current catalogue prices.
              </p>
            </div>
            <a href="/pc-builder" className="shrink-0 rounded-full bg-red-600 px-6 py-3 font-bold">
              Plan my PC →
            </a>
          </div>
        </section>
        <ProductSection
          title={text("PC Parts")}
          products={pcPartProducts}
          userRole={userRole}
          viewAllHref={CATALOG_SECTION_DETAILS["PC Parts"].href}
          viewAllLabel={language === "en" ? "View all PC parts" : "အားလုံးကြည့်ရန်"}
          deliveryEstimate={deliveryEstimate}
          itemsPerPage={compactSignedInHomepage ? 4 : undefined}
          showPagination={!compactSignedInHomepage}
        />
      </div>

      <RecentlyViewedSection
        products={recentlyViewed}
        userRole={userRole}
        onClear={clearRecentlyViewed}
        deliveryEstimate={deliveryEstimate}
      />

      <section id="support" className="mx-auto max-w-7xl px-5 pb-24">
        <div className="rounded-[2rem] bg-zinc-100 p-8 text-center">
          <h2 className="text-3xl font-bold">
            {language === "en"
              ? "Need help choosing?"
              : "ရွေးချယ်ရန် အကူအညီလိုပါသလား။"}
          </h2>
          <p className="mt-3 text-zinc-500">
            {language === "en"
              ? "Answer three quick questions, or chat with us and we will help you find the right laptop."
              : "မေးခွန်း ၃ ခုဖြေပါ။ သို့မဟုတ် Chat မှတဆင့် သင့်အတွက်သင့်တော်သော Laptop ကို ရွေးချယ်ပေးပါမည်။"}
          </p>

          <a
            href="/find-my-laptop"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-red-600 px-7 py-3.5 font-bold text-white shadow-lg shadow-red-600/25 transition hover:bg-red-500"
          >
            <span aria-hidden="true">🔎</span>
            {language === "en" ? "Find my laptop" : "ကျွန်ုပ်၏ Laptop ရှာရန်"}
          </a>
        </div>

        <SiteContact />
      </section>

      <ChatbotButton
        language={language}
        currentUser={currentUser}
        products={products}
      />
    </main>
  );
}
