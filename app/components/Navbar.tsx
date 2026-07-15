import Link from "next/link";
import LanguageSwitcher from "./LanguageSwitcher";
import type { UserRole } from "../data/products";

type CurrentUser = {
  email: string;
  role: UserRole;
};

type Props = {
  search: string;
  setSearch: (value: string) => void;
  language: "en" | "my";
  setLanguage: (value: "en" | "my") => void;
  cartCount: number;
  wishlistCount: number;
  currentUser: CurrentUser | null;
  onLogout: () => void;
};

export default function Navbar({
  search,
  setSearch,
  language,
  setLanguage,
  cartCount,
  wishlistCount,
  currentUser,
  onLogout,
}: Props) {
  return (
    <header className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
        <Link href="/" className="text-2xl font-bold text-red-600">
          Aphrodite
        </Link>

        <nav className="hidden gap-8 text-sm font-medium md:flex">
          <a href="#laptops">Laptops</a>
          <a href="#accessories">Accessories</a>
          <a href="#support">Support</a>
        </nav>

        <div className="hidden max-w-md flex-1 md:block">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              language === "en" ? "Search products..." : "ပစ္စည်း ရှာရန်..."
            }
            className="w-full rounded-full border px-5 py-2 outline-none focus:border-red-500"
          />
        </div>

        <div className="flex items-center gap-3 text-sm">
          <LanguageSwitcher language={language} setLanguage={setLanguage} />

          <Link href="/wishlist" className="hover:text-red-600">
            ♡ {wishlistCount}
          </Link>
          <Link href="/cart" className="hover:text-red-600">
            🛒 {cartCount}
          </Link>

          {currentUser ? (
            <div className="flex items-center gap-2">
              <span className="hidden rounded-full bg-zinc-100 px-3 py-2 md:inline">
                {currentUser.role === "admin"
                  ? "Admin"
                  : currentUser.role === "wholesale"
                  ? "Wholesale"
                  : "User"}
              </span>

              {currentUser.role === "admin" && (
                <Link
                  href="/admin/dashboard"
                  className="rounded-full bg-zinc-900 px-4 py-2 text-white"
                >
                  Admin
                </Link>
              )}

              <button
                onClick={onLogout}
                className="rounded-full border px-4 py-2"
              >
                Logout
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-red-600 px-4 py-2 text-white"
            >
              Login
            </Link>
          )}
        </div>
      </div>

      <div className="px-5 pb-4 md:hidden">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            language === "en" ? "Search products..." : "ပစ္စည်း ရှာရန်..."
          }
          className="w-full rounded-full border px-5 py-3 outline-none focus:border-red-500"
        />
      </div>
    </header>
  );
}
