"use client";

import { useEffect, useState } from "react";
import type { Product, UserRole } from "./data/products";
import Navbar from "./components/Navbar";
import HeroSlider from "./components/HeroSlider";
import CategoryGrid from "./components/CategoryGrid";
import ProductSection from "./components/ProductSection";
import ChatbotButton from "./components/ChatbotButton";
import { authHeaders, clearStoredAuth } from "./lib/client-auth";
import { useCurrentUser } from "./lib/useCurrentUser";
import { useDebouncedValue } from "./lib/useDebouncedValue";

export default function HomePage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [language, setLanguage] = useState<"en" | "my">("en");
  const { user: currentUser, refresh: refreshUser } = useCurrentUser();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  const [wishlist, setWishlist] = useState<number[]>([]);
  const [cart, setCart] = useState<number[]>([]);

  useEffect(() => {
    async function loadProducts() {
      setIsLoadingProducts(true);

      const params = new URLSearchParams();

      if (debouncedSearch.trim()) {
        params.set("q", debouncedSearch.trim());
      }

      const response = await fetch(`/api/products?${params.toString()}`);
      const data = (await response.json()) as { products: Product[] };

      setProducts(data.products);
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

  const userRole: UserRole = currentUser?.role ?? "normal";

  const laptopProducts = products.filter((product) => product.type === "laptop");

  const accessoryProducts = products.filter(
    (product) => product.type === "accessory"
  );

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
        language={language}
        setLanguage={setLanguage}
        cartCount={cart.length}
        wishlistCount={wishlist.length}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      <HeroSlider language={language} />

      <CategoryGrid language={language} />

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

      <ChatbotButton language={language} />
    </main>
  );
}
