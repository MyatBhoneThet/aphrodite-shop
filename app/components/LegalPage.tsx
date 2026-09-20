"use client";

import Link from "next/link";
import BrandLogo from "./BrandLogo";
import { LiquidBackdrop } from "./AuthShell";
import { useLanguage } from "../lib/language";
import {
  LEGAL_LAST_UPDATED,
  type LegalSection,
} from "../lib/legal-content";

/**
 * Shell for the two legal pages, so the privacy policy and the deletion
 * instructions cannot drift apart in layout.
 *
 * Client-side because the text is bilingual and the language lives in a
 * context; the content itself is static data from lib/legal-content.ts.
 *
 * Deliberately plain: a measured column, generous line height, no cards or
 * colour blocks. These pages are read, not browsed -- and a reviewer at Meta
 * or LINE has to be able to find a clause quickly.
 */
export default function LegalPage({
  title,
  intro,
  sections,
}: {
  title: { en: string; my: string };
  intro: { en: string; my: string };
  sections: LegalSection[];
}) {
  const { language } = useLanguage();
  const pick = (value: { en: string; my: string }) => value[language];

  return (
    <main className="relative min-h-screen overflow-hidden bg-white text-zinc-950">
      <LiquidBackdrop />

      <div className="relative mx-auto max-w-3xl px-5 py-12 sm:py-16">
        <Link
          href="/"
          aria-label="Aphrodite Myanmar home"
          className="mb-10 inline-flex items-center gap-3 rounded-2xl px-1 py-1 transition hover:opacity-90"
        >
          <BrandLogo />
        </Link>

        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {pick(title)}
        </h1>

        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          {language === "en" ? "Last updated" : "နောက်ဆုံးပြင်ဆင်သည့်ရက်"}{" "}
          {LEGAL_LAST_UPDATED}
        </p>

        <p className="mt-6 text-base leading-7 text-zinc-700">{pick(intro)}</p>

        {sections.map((section) => (
          <section key={section.heading.en} className="mt-10">
            <h2 className="text-xl font-bold tracking-tight">
              {pick(section.heading)}
            </h2>

            {section.body?.map((paragraph) => (
              <p
                key={paragraph.en}
                className="mt-3 text-base leading-7 text-zinc-700"
              >
                {pick(paragraph)}
              </p>
            ))}

            {section.bullets && (
              <ul className="mt-3 space-y-2.5">
                {section.bullets.map((bullet) => (
                  <li
                    key={bullet.en}
                    className="flex gap-3 text-base leading-7 text-zinc-700"
                  >
                    <span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                    <span>{pick(bullet)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <nav className="mt-14 flex flex-wrap gap-x-6 gap-y-2 border-t border-zinc-200 pt-6 text-sm font-semibold">
          <Link href="/" className="text-red-600 underline underline-offset-4 hover:text-red-700">
            {language === "en" ? "Back to shop" : "ဆိုင်သို့ ပြန်သွားရန်"}
          </Link>
          <Link href="/privacy" className="text-red-600 underline underline-offset-4 hover:text-red-700">
            {language === "en" ? "Privacy policy" : "ကိုယ်ရေးအချက်အလက် မူဝါဒ"}
          </Link>
          <Link href="/data-deletion" className="text-red-600 underline underline-offset-4 hover:text-red-700">
            {language === "en" ? "Delete your data" : "အချက်အလက် ဖျက်သိမ်းရန်"}
          </Link>
        </nav>
      </div>
    </main>
  );
}
