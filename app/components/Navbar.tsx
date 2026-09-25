"use client";

import Image from "next/image";
import Link from "next/link";
import BrandLogo from "./BrandLogo";
import LanguageSwitcher from "./LanguageSwitcher";
import AccountControls from "./AccountControls";
import type { Product, UserRole } from "../data/products";
import { useLanguage } from "../lib/language";
import LastOrderStatusBar from "./LastOrderStatusBar";

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

function SearchBox({ search, setSearch, suggestions }: {
  search: string;
  setSearch: (value: string) => void;
  suggestions: Product[];
}) {
  const { t, text } = useLanguage();
  const showSuggestions = search.trim().length > 0 && suggestions.length > 0;
  return (
    <div className="relative min-w-0">
      <label className="sr-only" htmlFor="store-search">{t("nav.search")}</label>
      <input id="store-search" value={search} onChange={(event) => setSearch(event.target.value)} autoComplete="off" placeholder={t("nav.search")} className="w-full rounded-full border border-zinc-300 bg-white px-5 py-3 pr-11 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-50" />
      {search && <button type="button" aria-label={t("nav.clearSearch")} onClick={() => setSearch("")} className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-zinc-400 hover:text-zinc-950">×</button>}
      {showSuggestions && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[70] overflow-hidden rounded-2xl border bg-white shadow-2xl">
          <p className="border-b px-4 py-2 text-xs font-bold uppercase tracking-wider text-zinc-400">{t("nav.suggestions")}</p>
          {suggestions.map((product) => (
            <Link key={product.id} href={`/products/${product.id}`} className="flex items-center gap-3 border-b px-4 py-3 last:border-0 hover:bg-red-50">
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-zinc-100"><Image src={product.image} unoptimized alt="" fill sizes="44px" className="object-contain p-1" /></div>
              <div className="min-w-0"><p className="truncate text-sm font-bold">{product.name}</p><p className="truncate text-xs text-zinc-500">{product.brand} · {text(product.category)}</p></div>
              <span className="ml-auto text-red-600">→</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Navbar({ search, setSearch, searchSuggestions, language, setLanguage, cartCount, wishlistCount, currentUser, onLogout }: Props) {
  const { t, text } = useLanguage();

  return (
    <header className="sticky top-0 z-50 border-b bg-white/95 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex max-w-[92rem] flex-wrap items-center gap-4 px-4 py-3 lg:px-6">
        <Link href="/" aria-label="Aphrodite Myanmar home" className="w-36 shrink-0 sm:w-44"><BrandLogo /></Link>
        {/* whitespace-nowrap on every link: without it the labels break
            mid-word ("PC / Parts") once the signed-in account controls take
            their share of the row. Returns and Support appear only on very
            wide screens -- both stay reachable from the Account menu and the
            category bar below. */}
        <nav className="hidden shrink-0 items-center gap-4 text-sm font-semibold 2xl:flex">
          <Link href="/catalog/laptops" className="whitespace-nowrap hover:text-red-600">{text("Laptops")}</Link>
          <Link href="/catalog/accessories" className="whitespace-nowrap hover:text-red-600">{text("Accessories")}</Link>
          <Link href="/catalog/pc-parts" className="whitespace-nowrap hover:text-red-600">{text("PC Parts")}</Link>
          <Link href="/find-my-laptop" className="whitespace-nowrap rounded-full bg-red-50 px-3 py-1.5 text-red-700 transition hover:bg-red-100">{text("Find Laptop")}</Link>
          <Link href="/pc-builder" className="whitespace-nowrap rounded-full bg-red-50 px-3 py-1.5 text-red-700 transition hover:bg-red-100">{text("PC Builder")}</Link>
          <Link href="/returns" className="hidden whitespace-nowrap hover:text-red-600 2xl:inline">{t("nav.returns")}</Link>
          <Link href="/#support" className="hidden whitespace-nowrap hover:text-red-600 2xl:inline">{t("nav.support")}</Link>
        </nav>
        {/* min-w-0 lets the search shrink instead of forcing the nav to squash;
            it only claims a wide minimum where there is room for it. */}
        <div className="hidden min-w-0 max-w-lg flex-1 md:block xl:min-w-[11rem] 2xl:min-w-[16rem]"><SearchBox search={search} setSearch={setSearch} suggestions={searchSuggestions} /></div>
        <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 text-sm sm:w-auto">
          <LanguageSwitcher language={language} setLanguage={setLanguage} />
          {currentUser ? (
            <AccountControls user={currentUser} wishlistCount={wishlistCount} cartCount={cartCount} onLogout={onLogout} />
          ) : (
            <div className="inline-flex shrink-0 items-center gap-1 rounded-full border border-zinc-200 bg-zinc-100 p-1 shadow-inner">
              <Link href="/register" className="inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold leading-relaxed text-zinc-600 transition-all duration-200 hover:bg-white hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 motion-reduce:transition-none">
                {t("nav.register")}
              </Link>
              <Link href="/login" className="inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-full bg-red-600 px-3 py-1 text-xs font-bold leading-relaxed text-white shadow-md shadow-red-600/20 transition-all duration-200 hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 motion-reduce:transition-none">
                {t("nav.login")}
              </Link>
            </div>
          )}
        </div>
      </div>
      <div className="px-4 pb-3 md:hidden"><SearchBox search={search} setSearch={setSearch} suggestions={searchSuggestions} /></div>
      <nav aria-label={text("Product categories")} className="grid grid-cols-3 gap-x-3 gap-y-2 border-t border-zinc-100 px-4 py-3 text-center text-xs font-semibold sm:flex sm:gap-5 sm:overflow-x-auto sm:px-5 sm:text-left sm:text-sm [&>a]:min-w-0 sm:[&>a]:shrink-0"><Link href="/catalog/laptops" className="sm:whitespace-nowrap">{text("Laptops")}</Link><Link href="/catalog/accessories" className="sm:whitespace-nowrap">{text("Accessories")}</Link><Link href="/catalog/pc-parts" className="sm:whitespace-nowrap">{text("PC Parts")}</Link><Link href="/find-my-laptop" className="col-span-2 text-red-600 sm:col-auto sm:whitespace-nowrap">{text("Find my laptop")} →</Link><Link href="/pc-builder" className="text-red-600 sm:whitespace-nowrap">{text("Build a PC")} →</Link></nav>
      <LastOrderStatusBar enabled={Boolean(currentUser && currentUser.role !== "admin")} />
    </header>
  );
}
