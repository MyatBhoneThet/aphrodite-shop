"use client";

import Link from "next/link";
import BrandLogo from "../components/BrandLogo";
import LocationSharing from "../components/LocationSharing";
import { useLanguage } from "../lib/language";

export default function LocationPage() {
  const { text } = useLanguage();

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-5">
          <Link href="/" aria-label="Aphrodite Myanmar home" className="inline-flex w-32 shrink-0 sm:w-44">
            <BrandLogo className="h-9 sm:h-12" />
          </Link>
          <Link href="/" className="rounded-full border px-4 py-2 text-sm font-semibold sm:px-5">
            {text("Back to store")}
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-xl px-5 py-10">
        <h1 className="mb-6 text-3xl font-bold">{text("Your location, your choice")}</h1>
        <LocationSharing expanded />
      </section>
    </main>
  );
}
