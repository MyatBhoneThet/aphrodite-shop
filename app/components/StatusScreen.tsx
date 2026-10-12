"use client";

import Link from "next/link";
import BrandLogo from "./BrandLogo";
import { useLanguage } from "../lib/language";

type Props =
  | { kind: "not-found" }
  | { kind: "error"; digest?: string; onRetry?: () => void };

const SHORTCUTS = [
  { href: "/catalog/laptops", label: "Laptops" },
  { href: "/catalog/accessories", label: "Accessories" },
  { href: "/catalog/pc-parts", label: "PC Parts" },
  { href: "/track", label: "Track my order" },
];

/**
 * The "page not found" and "something went wrong" screens. One component so
 * both look like the shop and both lead the customer somewhere useful.
 */
export default function StatusScreen(props: Props) {
  const { text } = useLanguage();
  const notFound = props.kind === "not-found";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-5 py-10 text-center text-zinc-950">
      <Link href="/" aria-label="Aphrodite Myanmar home" className="mb-8 inline-flex w-44">
        <BrandLogo className="h-12" />
      </Link>

      <p className="text-6xl font-black tracking-tight text-red-600 sm:text-7xl" aria-hidden="true">
        {notFound ? "404" : "Oops"}
      </p>
      <h1 className="mt-4 text-2xl font-bold sm:text-3xl">
        {notFound ? text("Page not found") : text("Something went wrong")}
      </h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-zinc-500 sm:text-base">
        {notFound
          ? text("We couldn't find the page you were looking for. It may have moved, or the link may be old.")
          : text("This page could not load. Please try again. If it keeps happening, call us and we will help.")}
      </p>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        {props.kind === "error" && props.onRetry && (
          <button
            type="button"
            onClick={props.onRetry}
            className="min-h-11 rounded-full bg-red-600 px-6 py-3 text-sm font-bold text-white hover:bg-red-700"
          >
            {text("Try again")}
          </button>
        )}
        <Link
          href="/"
          className={`inline-flex min-h-11 items-center rounded-full px-6 py-3 text-sm font-bold ${
            props.kind === "error" && props.onRetry
              ? "border border-zinc-300 hover:border-red-500 hover:text-red-600"
              : "bg-red-600 text-white hover:bg-red-700"
          }`}
        >
          {text("Back to Store")}
        </Link>
      </div>

      <div className="mt-10 w-full max-w-md border-t border-zinc-100 pt-6">
        <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">{text("Or look around")}</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {SHORTCUTS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex min-h-11 items-center rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-red-300 hover:text-red-600"
            >
              {text(link.label)}
            </Link>
          ))}
        </div>
      </div>

      {props.kind === "error" && props.digest && (
        <p className="mt-8 text-xs text-zinc-400">
          {text("Reference")}: {props.digest}
        </p>
      )}
    </main>
  );
}
