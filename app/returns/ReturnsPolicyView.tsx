"use client";

import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "../lib/language";
import {
  PROCESS_TITLE,
  RETURNS_CARDS,
  RETURNS_FOOTER,
  RETURNS_HERO,
  RETURNS_NAV,
  RETURN_TYPES,
  RMA_STEPS,
  TRANSIT_DAMAGE,
} from "../lib/returns-content";

/**
 * The returns and refunds policy, in the language the visitor chose. The text
 * lives in lib/returns-content.ts; this component only lays it out.
 */
export default function ReturnsPolicyView({ phones, email }: { phones: string; email?: string }) {
  const { language, setLanguage } = useLanguage();
  const pick = (value: { en: string; my: string }) => value[language];
  const isMy = language === "my";

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-5">
          <Link href="/" className="w-28 shrink-0 sm:w-auto">
            <Image src="/brand/aphrodite-myanmar.png" alt="Aphrodite Myanmar" width={218} height={77} className="h-9 w-auto sm:h-12" priority />
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex rounded-full border p-0.5 text-xs font-bold" role="group" aria-label="Language">
              <button type="button" onClick={() => setLanguage("en")} aria-pressed={!isMy} className={`rounded-full px-3 py-1.5 ${!isMy ? "bg-zinc-900 text-white" : "text-zinc-600"}`}>EN</button>
              <button type="button" onClick={() => setLanguage("my")} aria-pressed={isMy} className={`rounded-full px-3 py-1.5 ${isMy ? "bg-zinc-900 text-white" : "text-zinc-600"}`}>မြန်မာ</button>
            </div>
            <Link href="/orders" className="rounded-full border px-3 py-2 text-xs font-semibold sm:px-4 sm:text-sm">{pick(RETURNS_NAV.orders)}</Link>
            <Link href="/" className="rounded-full bg-zinc-900 px-3 py-2 text-xs font-semibold text-white sm:px-4 sm:text-sm">{pick(RETURNS_NAV.store)}</Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-12">
        <div className="rounded-[2rem] bg-red-600 p-6 text-white sm:p-12">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-100 sm:text-sm sm:tracking-[0.25em]">{pick(RETURNS_HERO.kicker)}</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-black leading-tight sm:text-5xl">{pick(RETURNS_HERO.title)}</h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-red-50 sm:text-base">
            {pick(RETURNS_HERO.start)}
            <strong>{pick(RETURNS_HERO.myOrders)}</strong>
            {pick(RETURNS_HERO.and)}
            <strong>{pick(RETURNS_HERO.help)}</strong>
            {pick(RETURNS_HERO.chatOrCall)}
            {phones}
            {isMy ? pick(RETURNS_HERO.callTail) : ""}
            {email ? (isMy ? ` သို့မဟုတ် ${email} သို့ အီးမေးလ်ပို့ပါ` : `${pick(RETURNS_HERO.orEmail)}${email}`) : ""}
            {" "}({pick(RETURNS_HERO.hours)}). {pick(RETURNS_HERO.never)}
          </p>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {RETURN_TYPES.map((item) => (
            <article key={item.title.en} className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black leading-snug">{pick(item.title)}</h2>
              <p className="mt-4 text-sm font-semibold leading-6 text-red-700">{pick(item.timing)}</p>
              <p className="mt-3 text-sm leading-6 text-zinc-600">{pick(item.evidence)}</p>
            </article>
          ))}
        </div>

        <section className="mt-10 rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-xl font-black">{pick(TRANSIT_DAMAGE.title)}</h2>
          <p className="mt-3 text-sm leading-6 text-amber-950">{pick(TRANSIT_DAMAGE.body)}</p>
        </section>

        <section className="mt-10">
          <h2 className="text-3xl font-black">{pick(PROCESS_TITLE)}</h2>
          <div className="mt-5 space-y-4">
            {RMA_STEPS.map((step, index) => (
              <article key={step.title.en} className="grid gap-4 rounded-3xl bg-white p-6 shadow-sm sm:grid-cols-[3rem_1fr]">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-lg font-black text-white">{index + 1}</span>
                <div>
                  <h3 className="text-lg font-black">{pick(step.title)}</h3>
                  <p className="mt-1 text-sm leading-6 text-zinc-600">{pick(step.body)}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-5 md:grid-cols-2">
          <article className="rounded-3xl bg-white p-7 shadow-sm">
            <h2 className="text-xl font-black">{pick(RETURNS_CARDS.cod.title)}</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">{pick(RETURNS_CARDS.cod.body)}</p>
          </article>
          <article className="rounded-3xl bg-white p-7 shadow-sm">
            <h2 className="text-xl font-black">{pick(RETURNS_CARDS.excluded.title)}</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">{pick(RETURNS_CARDS.excluded.body)}</p>
          </article>
        </section>

        <section className="mt-6 rounded-3xl bg-zinc-950 p-7 text-white">
          <h2 className="text-xl font-black">{pick(RETURNS_CARDS.data.title)}</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-300">{pick(RETURNS_CARDS.data.body)}</p>
          <Link href="/orders" className="mt-5 inline-block rounded-full bg-red-600 px-6 py-3 text-sm font-bold">{pick(RETURNS_CARDS.data.button)}</Link>
        </section>

        <p className="mt-8 text-xs leading-5 text-zinc-500">
          {pick(RETURNS_FOOTER.before)}{phones}{pick(RETURNS_FOOTER.after)}
        </p>
      </section>
    </main>
  );
}
