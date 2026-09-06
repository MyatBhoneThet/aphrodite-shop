"use client";

import Image from "next/image";
import Link from "next/link";
import BrandLogo from "./BrandLogo";
import LanguageSwitcher from "./LanguageSwitcher";
import type { Product, UserRole } from "../data/products";

type CurrentUser = { email: string; role: UserRole; wholesale_status?: string };
type Props = {
  search: string;
  setSearch: (value: string) => void;
  searchSuggestions: Product[];
  language: "en" | "my";
  setLanguage: (value: "en" | "my") => void;
  cartCount: number;
  wishlistCount: number;
  currentUser: CurrentUser | null;
  onLogout: () => void;
};

function SearchBox({ search, setSearch, suggestions, language }: {
  search: string;
  setSearch: (value: string) => void;
  suggestions: Product[];
  language: "en" | "my";
}) {
  const showSuggestions = search.trim().length > 0 && suggestions.length > 0;
  return (
    <div className="relative">
      <label className="sr-only" htmlFor="store-search">Search products</label>
      <input id="store-search" value={search} onChange={(event) => setSearch(event.target.value)} autoComplete="off" placeholder={language === "en" ? "Search products..." : "ပစ္စည်း ရှာရန်..."} className="w-full rounded-full border border-zinc-300 bg-white px-5 py-3 pr-11 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-50" />
      {search && <button type="button" aria-label="Clear search" onClick={() => setSearch("")} className="absolute right-4 top-3 text-zinc-400 hover:text-zinc-950">×</button>}
      {showSuggestions && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[70] overflow-hidden rounded-2xl border bg-white shadow-2xl">
          <p className="border-b px-4 py-2 text-xs font-bold uppercase tracking-wider text-zinc-400">Suggestions</p>
          {suggestions.map((product) => (
            <Link key={product.id} href={`/products/${product.id}`} className="flex items-center gap-3 border-b px-4 py-3 last:border-0 hover:bg-red-50">
              <div className="relative h-11 w-11 overflow-hidden rounded-xl bg-zinc-100"><Image src={product.image} unoptimized alt="" fill sizes="44px" className="object-contain p-1" /></div>
              <div className="min-w-0"><p className="truncate text-sm font-bold">{product.name}</p><p className="truncate text-xs text-zinc-500">{product.brand} · {product.category}</p></div>
              <span className="ml-auto text-red-600">→</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Navbar({ search, setSearch, searchSuggestions, language, setLanguage, cartCount, wishlistCount, currentUser, onLogout }: Props) {
  function navigateAccount(value: string) {
    if (value) window.location.assign(value);
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-white/95 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex max-w-[92rem] items-center gap-4 px-4 py-3 lg:px-6">
        <Link href="/" aria-label="Aphrodite Myanmar home" className="w-36 shrink-0 sm:w-44"><BrandLogo /></Link>
        <nav className="hidden items-center gap-5 text-sm font-semibold xl:flex"><Link href="/catalog/laptops" className="hover:text-red-600">Laptops</Link><Link href="/catalog/accessories" className="hover:text-red-600">Accessories</Link><Link href="/catalog/pc-parts" className="hover:text-red-600">PC Parts</Link><Link href="/pc-builder" className="rounded-full bg-red-50 px-3 py-2 text-red-700 hover:bg-red-100">PC Builder</Link><Link href="/returns" className="hover:text-red-600">Returns</Link><Link href="/#support" className="hover:text-red-600">Support</Link></nav>
        <div className="hidden min-w-[16rem] max-w-lg flex-1 md:block"><SearchBox search={search} setSearch={setSearch} suggestions={searchSuggestions} language={language} /></div>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <LanguageSwitcher language={language} setLanguage={setLanguage} />
          {currentUser ? <>
            <Link href="/wishlist" aria-label="Wishlist" className="rounded-full px-2 py-2 hover:bg-red-50 hover:text-red-600">♡ <span className="hidden sm:inline">{wishlistCount}</span></Link>
            <Link href="/cart" aria-label="Cart" className="rounded-full px-2 py-2 hover:bg-red-50 hover:text-red-600">🛒 <span className="hidden sm:inline">{cartCount}</span></Link>
            <select aria-label="Account and settings menu" value="" onChange={(event) => navigateAccount(event.target.value)} className="max-w-28 rounded-full border bg-white px-3 py-2 font-semibold outline-none hover:border-red-400 sm:max-w-none">
              <option value="" disabled>Account</option>
              <option value="/orders">My orders</option>
              <option value="/location">Location sharing</option>
              <option value="/wishlist">Wishlist</option>
              <option value="/cart">Cart</option>
              <option value="/pc-builder">PC Build Planner</option>
              {currentUser.role !== "admin" && <option value="/settings">Settings</option>}
              <option value="/returns">Return policy</option>
              {currentUser.role === "admin" && <option value="/admin?panel=dashboard">Admin dashboard</option>}
            </select>
            {currentUser.role === "admin" && <Link href="/admin?panel=dashboard" className="hidden rounded-full bg-zinc-950 px-4 py-2 font-bold text-white lg:inline">Admin</Link>}
            <button type="button" onClick={onLogout} className="rounded-full border px-3 py-2 font-semibold hover:border-red-500 hover:text-red-600">Logout</button>
          </> : <><Link href="/register" className="hidden rounded-full border px-4 py-2 font-semibold sm:inline">Register</Link><Link href="/login" className="rounded-full bg-red-600 px-4 py-2 font-bold text-white">Login</Link></>}
        </div>
      </div>
      <div className="px-4 pb-3 md:hidden"><SearchBox search={search} setSearch={setSearch} suggestions={searchSuggestions} language={language} /></div>
      <nav aria-label="Product categories" className="flex gap-5 overflow-x-auto border-t border-zinc-100 px-5 py-3 text-sm font-semibold xl:hidden"><Link href="/catalog/laptops" className="whitespace-nowrap">Laptops</Link><Link href="/catalog/accessories" className="whitespace-nowrap">Accessories</Link><Link href="/catalog/pc-parts" className="whitespace-nowrap">PC Parts</Link><Link href="/pc-builder" className="whitespace-nowrap text-red-600">Build a PC →</Link></nav>
    </header>
  );
}
