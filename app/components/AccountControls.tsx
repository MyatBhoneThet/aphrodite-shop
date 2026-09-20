"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { UserRole } from "../data/products";
import { useLanguage } from "../lib/language";

function Icon({ kind }: { kind: "heart" | "cart" | "user" | "logout" }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
    {kind === "heart" && <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />}
    {kind === "cart" && <><path d="M3 3h2l2.4 12h11.2L21 7H6" /><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></>}
    {kind === "user" && <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>}
    {kind === "logout" && <><path d="M9 4H4v16h5M10 12h11m-4-4 4 4-4 4" /></>}
  </svg>;
}

export default function AccountControls({ user, wishlistCount, cartCount, onLogout }: {
  user: { email: string; role: UserRole };
  wishlistCount: number;
  cartCount: number;
  onLogout: () => void;
}) {
  const { t, language } = useLanguage();
  const menu = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);

  useEffect(() => {
    function outside(event: PointerEvent) {
      if (menu.current && !menu.current.contains(event.target as Node)) menu.current.open = false;
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape" && menu.current?.open) {
        menu.current.open = false;
        trigger.current?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  const links = [
    { href: "/orders", label: t("nav.orders") },
    { href: "/location", label: t("nav.locationSharing") },
    { href: "/wishlist", label: t("nav.wishlist") },
    { href: "/cart", label: t("nav.cart") },
    { href: "/pc-builder", label: language === "my" ? "PC တည်ဆောက်ရန်" : "PC Build Planner" },
    ...(user.role !== "admin" ? [{ href: "/settings", label: t("nav.settings") }] : []),
    { href: "/returns", label: t("nav.returnPolicy") },
    ...(user.role === "admin" ? [{ href: "/admin?panel=dashboard", label: "Admin dashboard" }] : []),
  ];

  return <div className="flex items-center gap-2">
    <div className="flex items-center gap-1 rounded-2xl border border-zinc-200/80 bg-zinc-50 p-1">
      {([{ href: "/wishlist", label: t("nav.wishlist"), count: wishlistCount, kind: "heart" }, { href: "/cart", label: t("nav.cart"), count: cartCount, kind: "cart" }] as const).map(item => (
        <Link key={item.kind} href={item.href} aria-label={`${item.label}: ${item.count}`} title={item.label}
          className="group relative flex h-10 w-12 items-center justify-center rounded-xl text-zinc-600 transition hover:bg-white hover:text-red-600 hover:shadow-sm motion-reduce:transition-none">
          <Icon kind={item.kind} />
          <span aria-hidden="true" className={`absolute right-0.5 top-0 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold ring-2 ring-zinc-50 ${item.count > 0 ? "bg-red-600 text-white" : "bg-zinc-200 text-zinc-600"}`}>{item.count > 99 ? "99+" : item.count}</span>
        </Link>
      ))}
    </div>
    <details ref={menu} className="group/account relative" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
    }}>
      <summary ref={trigger} className="flex h-12 cursor-pointer list-none items-center gap-2 rounded-2xl bg-zinc-950 px-2.5 text-white shadow-sm transition hover:bg-zinc-800 [&::-webkit-details-marker]:hidden sm:pr-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-red-300"><Icon kind="user" /></span>
        <span className="hidden font-semibold sm:block">{t("nav.account")}</span>
        <span className="sr-only sm:hidden">{t("nav.account")}</span>
        <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5 text-zinc-400 transition group-open/account:rotate-180 motion-reduce:transition-none"><path d="m4 6 4 4 4-4" /></svg>
      </summary>
      <div className="absolute right-0 top-[calc(100%+0.75rem)] z-[80] w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_16px_48px_-12px_rgba(0,0,0,0.25)]">
        <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-3"><p className="text-xs font-bold text-red-600">{t("nav.account")}</p><p className="mt-1 truncate text-xs text-zinc-500" title={user.email}>{user.email}</p></div>
        <nav aria-label={t("nav.account")} className="max-h-[55vh] overflow-y-auto p-2">
          {links.map(link => <Link key={link.href} href={link.href} onClick={() => { if (menu.current) menu.current.open = false; }} className="flex min-h-10 items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-red-50 hover:text-red-600">{link.label}<span aria-hidden="true" className="text-zinc-400">↗</span></Link>)}
        </nav>
        <div className="border-t border-zinc-100 p-2"><button type="button" onClick={() => { if (menu.current) menu.current.open = false; onLogout(); }} className="flex min-h-10 w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"><Icon kind="logout" />{t("nav.logout")}</button></div>
      </div>
    </details>
    {user.role === "admin" && <Link href="/admin?panel=dashboard" className="hidden rounded-xl bg-red-50 px-3 py-3 text-xs font-bold text-red-700 hover:bg-red-100 lg:inline">Admin</Link>}
  </div>;
}
