"use client";

import { useEffect, useMemo, useState } from "react";
import type { Product, UserRole } from "./data/products";
import Navbar from "./components/Navbar";
import HeroSlider from "./components/HeroSlider";
import CategoryGrid from "./components/CategoryGrid";
import ProductSection from "./components/ProductSection";
import ChatbotButton from "./components/ChatbotButton";
import { authHeaders, clearStoredAuth, getAccessToken } from "./lib/client-auth";

type CurrentUser = {
  id?: string;
  email: string;
  role: UserRole;
};

export default function HomePage() {
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState<"en" | "my">("en");
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  const [wishlist, setWishlist] = useState<number[]>([]);
  const [cart, setCart] = useState<number[]>([]);

  useEffect(() => {
    async function loadSession() {
      const token = getAccessToken();

      if (!token) {
        setCurrentUser(null);
        return;
      }

      const response = await fetch("/api/auth/me", {
        headers: authHeaders(),
      });
      const data = (await response.json()) as { user: CurrentUser | null };

      setCurrentUser(response.ok ? data.user : null);

      if (response.ok && data.user) {
        localStorage.setItem("aphrodite_user", JSON.stringify(data.user));
      } else {
        clearStoredAuth();
      }
    }

    loadSession();
  }, []);

  useEffect(() => {
    async function loadProducts() {
      setIsLoadingProducts(true);

      const params = new URLSearchParams();

      if (search.trim()) {
        params.set("q", search.trim());
      }

      const response = await fetch(`/api/products?${params.toString()}`);
      const data = (await response.json()) as { products: Product[] };

      setProducts(data.products);
      setIsLoadingProducts(false);
    }

    loadProducts();
  }, [search]);

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

  const filteredProducts = useMemo(() => {
    return products;
  }, [products]);

  const laptopProducts = filteredProducts.filter(
    (product) => product.type === "laptop"
  );

  const accessoryProducts = filteredProducts.filter(
    (product) => product.type === "accessory"
  );

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    clearStoredAuth();
    setCurrentUser(null);
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
