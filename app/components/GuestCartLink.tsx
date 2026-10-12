"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { guestCartSnapshot, parseGuestCart, subscribeGuestCart } from "../lib/guest-cart";
import { useLanguage } from "../lib/language";

/** Cart shortcut for visitors who have not logged in; the count comes from the browser cart. */
export default function GuestCartLink() {
  const { t } = useLanguage();
  const raw = useSyncExternalStore(subscribeGuestCart, guestCartSnapshot, () => "");
  const count = useMemo(
    () => parseGuestCart(raw).reduce((sum, line) => sum + line.quantity, 0),
    [raw]
  );
  const label = t("nav.cart");

  return (
    <Link
      href="/cart"
      aria-label={`${label}: ${count}`}
      title={label}
      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-700 transition hover:bg-white hover:text-red-600 motion-reduce:transition-none"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M3 3h2l2.4 12h11.2L21 7H6" />
        <circle cx="9" cy="20" r="1" />
        <circle cx="18" cy="20" r="1" />
      </svg>
      {count > 0 && (
        <span aria-hidden="true" className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
