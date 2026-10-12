"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../lib/language";

/**
 * Share a product: Viber, Messenger, Facebook or copy the link.
 *
 * The link is the product's own page, which carries the photo, name and price
 * preview, so a pasted link shows up as a proper card in a chat. On phones the
 * system share sheet is offered too, because it lists every app they have.
 */
export default function ProductShare({ productId, name, priceText }: { productId: number; name: string; priceText: string }) {
  const { text } = useLanguage();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Read after mount so the server and first client render agree.
    const timer = window.setTimeout(() => {
      setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
      setIsTouch(window.matchMedia("(pointer: coarse)").matches);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const pageUrl = () => `${window.location.origin}/products/${productId}`;
  const message = () => `${name}${priceText ? ` — ${priceText}` : ""}`;

  async function nativeShare() {
    try {
      await navigator.share({ title: name, text: message(), url: pageUrl() });
      setOpen(false);
    } catch {
      // Closing the system sheet counts as an error; nothing to report.
    }
  }

  async function copyLink() {
    const url = pageUrl();
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Older browsers: select-and-copy through a temporary field.
      const field = document.createElement("textarea");
      field.value = url;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      try { document.execCommand("copy"); } catch { /* the link is visible in the address bar */ }
      field.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  const itemClass =
    "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-zinc-800 transition hover:bg-red-50 hover:text-red-700";

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold sm:px-7 sm:py-3 sm:text-base"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
        </svg>
        {text("Share")}
      </button>

      {open && (
        <div role="menu" aria-label={text("Share this product")} className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-60 rounded-2xl border border-zinc-200 bg-white p-2 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.3)]">
          {canNativeShare && (
            <button type="button" role="menuitem" onClick={() => void nativeShare()} className={itemClass}>
              {text("Share…")}
            </button>
          )}
          <a
            role="menuitem"
            href={`viber://forward?text=${encodeURIComponent(`${message()} ${typeof window === "undefined" ? "" : pageUrl()}`)}`}
            onClick={() => setOpen(false)}
            className={itemClass}
          >
            <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-600 text-xs font-black text-white">V</span>
            Viber
          </a>
          {isTouch && (
            <a
              role="menuitem"
              href={`fb-messenger://share/?link=${encodeURIComponent(typeof window === "undefined" ? "" : pageUrl())}`}
              onClick={() => setOpen(false)}
              className={itemClass}
            >
              <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500 text-xs font-black text-white">M</span>
              Messenger
            </a>
          )}
          <a
            role="menuitem"
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(typeof window === "undefined" ? "" : pageUrl())}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className={itemClass}
          >
            <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-700 text-xs font-black text-white">f</span>
            Facebook
          </a>
          <button type="button" role="menuitem" onClick={() => void copyLink()} className={itemClass}>
            <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-200 text-xs font-black text-zinc-700">⧉</span>
            {copied ? text("Link copied") : text("Copy link")}
          </button>
        </div>
      )}
      <span role="status" className="sr-only">{copied ? text("Link copied") : ""}</span>
    </div>
  );
}
