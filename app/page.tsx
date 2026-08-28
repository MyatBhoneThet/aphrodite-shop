"use client";

import { useEffect, useMemo, useState } from "react";
import type { Product, UserRole } from "./data/products";
import Navbar from "./components/Navbar";
import HeroSlider from "./components/HeroSlider";
import CategoryGrid from "./components/CategoryGrid";
import ProductSection from "./components/ProductSection";
import ChatbotButton from "./components/ChatbotButton";
import ProductFilters from "./components/ProductFilters";
import RecentlyViewedSection from "./components/RecentlyViewedSection";
import { authHeaders, clearStoredAuth } from "./lib/client-auth";
import { useCurrentUser } from "./lib/useCurrentUser";
import { useDebouncedValue } from "./lib/useDebouncedValue";
import {
  EMPTY_PRODUCT_FILTERS,
  filterAndSortProducts,
  type ProductFilterState,
} from "./lib/product-filters";

export default function HomePage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [language, setLanguage] = useState<"en" | "my">("en");
  const { user: currentUser, refresh: refreshUser } = useCurrentUser();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [filters, setFilters] = useState<ProductFilterState>({
    ...EMPTY_PRODUCT_FILTERS,
  });
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);

  const [wishlist, setWishlist] = useState<number[]>([]);
  const [cart, setCart] = useState<number[]>([]);

  useEffect(() => {
    async function loadProducts() {
      setIsLoadingProducts(true);

      const params = new URLSearchParams();
      params.set("limit", "100");

      if (debouncedSearch.trim()) {
        params.set("q", debouncedSearch.trim());
      }

      // authHeaders() covers legacy bearer sessions; cookie sessions ride
      // along automatically and make the API attach wholesale tiers.
      const response = await fetch(`/api/products?${params.toString()}`, {
        headers: authHeaders(),
      });
      const data = (await response.json()) as { products?: Product[] };

      setProducts(response.ok ? data.products ?? [] : []);
      setIsLoadingProducts(false);
    }

    loadProducts();
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
      if (!currentUser || currentUser.role === "admin") {
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
  const brands = useMemo(
    () =>
      Array.from(new Set(products.map((product) => product.brand))).sort(
        (left, right) => left.localeCompare(right)
      ),
    [products]
  );
  const visibleProducts = useMemo(
    () => filterAndSortProducts(products, filters),
    [products, filters]
  );

  // Sections mirror the production workbook tabs. Manual products carry no
  // sourceSheet and fall back to their product type.
  const laptopProducts = visibleProducts.filter((product) =>
    product.sourceSheet
      ? product.sourceSheet === "Laptops"
      : product.type === "laptop"
  );

  const accessoryProducts = visibleProducts.filter((product) =>
    product.sourceSheet
      ? product.sourceSheet === "Accessories"
      : product.type === "accessory"
  );

  const pcPartProducts = visibleProducts.filter(
    (product) => product.sourceSheet === "PC Parts"
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
        filters={filters}
        resultCount={visibleProducts.length}
        onChange={setFilters}
      />

      <div id="laptops">
        {isLoadingProducts ? (
          <p className="px-5 pb-16 text-center text-zinc-500">
            Loading products...
          </p>
        ) : (
          <ProductSection
            title={language === "en" ? "Laptops" : "လက်ပ်တော့များ"}
            products={laptopProducts}
            userRole={userRole}
          />
        )}
      </div>

      <div id="accessories">
        <ProductSection
          title={language === "en" ? "Accessories" : "Accessories များ"}
          products={accessoryProducts}
          userRole={userRole}
        />
      </div>

      <div id="pc-parts">
        <ProductSection
          title={language === "en" ? "PC Parts" : "PC Parts များ"}
          products={pcPartProducts}
          userRole={userRole}
        />
      </div>

      <RecentlyViewedSection
        products={recentlyViewed}
        userRole={userRole}
        onClear={clearRecentlyViewed}
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
              ? "Chat with us and we will help you find the right laptop."
              : "Chat မှတဆင့် သင့်အတွက်သင့်တော်သော Laptop ကို ရွေးချယ်ပေးပါမည်။"}
          </p>
        </div>
      </section>

      <ChatbotButton language={language} currentUser={currentUser} />
    </main>
  );
}
