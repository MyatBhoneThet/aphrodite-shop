"use client";

import ProductPrice from "../components/ProductPrice";
import { effectiveProductPrice } from "../lib/promotions";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Product } from "../data/products";
import { USE_CASES } from "../lib/compare";
import { formatCurrency } from "../lib/format";
import {
  SCREEN_CHOICES,
  recommendLaptops,
  type QuizAnswers,
  type ScreenPreference,
} from "../lib/laptop-quiz";
import { productPhotos } from "../lib/product-gallery";
import { getProductFamily } from "../lib/product-specifications";

const USE_ICONS: Record<string, string> = {
  office: "💼",
  school: "🎓",
  gaming: "🎮",
  programming: "💻",
  creative: "🎨",
  travel: "✈️",
};

const BUDGET_PRESETS = [
  { label: "Under 2,500,000", min: 0, max: 2_500_000 },
  { label: "2.5M – 4M", min: 2_500_000, max: 4_000_000 },
  { label: "4M – 6M", min: 4_000_000, max: 6_000_000 },
  { label: "Over 6M", min: 6_000_000, max: 50_000_000 },
];

const STEPS = ["Budget", "Main use", "Screen size"];

export default function FindMyLaptopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [step, setStep] = useState(0);
  const [budgetMin, setBudgetMin] = useState("0");
  const [budgetMax, setBudgetMax] = useState("6000000");
  const [use, setUse] = useState<QuizAnswers["use"]>("office");
  const [screen, setScreen] = useState<ScreenPreference>("any");
  const [answers, setAnswers] = useState<QuizAnswers | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      try {
        const loaded: Product[] = [];
        for (let offset = 0; offset < 2_000; offset += 100) {
          const response = await fetch(
            `/api/products?limit=100&offset=${offset}`,
            { cache: "no-store" }
          );
          const data = (await response.json().catch(() => null)) as
            | { products?: Product[]; error?: string }
            | null;
          if (!response.ok) {
            throw new Error(data?.error ?? "Unable to load the catalogue.");
          }
          const page = data?.products ?? [];
          loaded.push(...page);
          if (page.length < 100) break;
        }
        if (!cancelled) setProducts(loaded);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load the catalogue."
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadProducts();
    return () => {
      cancelled = true;
    };
  }, []);

  const laptopCount = useMemo(
    () =>
      products.filter(
        (product) => getProductFamily(product) === "laptop" && product.price > 0
      ).length,
    [products]
  );

  const result = useMemo(
    () => (answers ? recommendLaptops(products, answers) : null),
    [products, answers]
  );

  function showResults() {
    const minimum = Math.max(0, Number(budgetMin) || 0);
    const maximum = Math.max(minimum, Number(budgetMax) || 0);
    setAnswers({ budgetMin: minimum, budgetMax: maximum, use, screen });
  }

  function startAgain() {
    setAnswers(null);
    setStep(0);
  }

  const selectedUse = USE_CASES.find((entry) => entry.id === use) ?? USE_CASES[0];

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="sticky top-0 z-30 border-b border-zinc-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <Link href="/">
            <Image
              src="/brand/aphrodite-myanmar.png"
              alt="Aphrodite Myanmar"
              width={218}
              height={77}
              className="h-11 w-auto"
              priority
            />
          </Link>
          <div className="flex gap-2">
            <Link
              href="/catalog/laptops"
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-bold transition hover:border-zinc-950"
            >
              All laptops
            </Link>
            <Link
              href="/"
              className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-600"
            >
              Store
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-8 sm:py-10">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-[2rem] bg-zinc-950 p-8 text-white shadow-2xl shadow-zinc-950/20 sm:p-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-32 h-[28rem] w-[28rem] rounded-full bg-red-600/40 blur-[110px]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-40 left-10 h-80 w-80 rounded-full bg-rose-500/20 blur-[100px]"
          />
          <div className="relative hero-rise">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.25em] text-red-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              Find My Laptop
            </p>
            <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl">
              Answer 3 questions.{" "}
              <span className="bg-gradient-to-r from-red-400 via-rose-400 to-orange-300 bg-clip-text text-transparent">
                Get 3 laptops.
              </span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-300">
              Tell us your budget, what you will use it for, and the screen size
              you like. We check{" "}
              {isLoading ? "the catalogue" : `all ${laptopCount} priced laptops`}{" "}
              and explain why each one suits you.
            </p>
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700"
          >
            {error}
          </p>
        )}

        {/* Quiz */}
        {!result && (
          <div className="mt-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            {/* Progress */}
            <ol className="flex items-center gap-2">
              {STEPS.map((label, index) => (
                <li key={label} className="flex flex-1 items-center gap-2">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black transition ${
                      index <= step
                        ? "bg-red-600 text-white"
                        : "bg-zinc-100 text-zinc-400"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span
                    className={`hidden text-sm font-bold sm:block ${
                      index <= step ? "text-zinc-950" : "text-zinc-400"
                    }`}
                  >
                    {label}
                  </span>
                  {index < STEPS.length - 1 && (
                    <span
                      className={`h-1 flex-1 rounded-full ${
                        index < step ? "bg-red-600" : "bg-zinc-100"
                      }`}
                    />
                  )}
                </li>
              ))}
            </ol>

            <div className="mt-8">
              {step === 0 && (
                <div className="hero-rise">
                  <h2 className="text-2xl font-black">
                    What can you spend?
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Pick a range, or type your own numbers.
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {BUDGET_PRESETS.map((preset) => {
                      const selected =
                        Number(budgetMin) === preset.min &&
                        Number(budgetMax) === preset.max;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => {
                            setBudgetMin(String(preset.min));
                            setBudgetMax(String(preset.max));
                          }}
                          className={`rounded-2xl border px-3 py-3 text-sm font-bold transition ${
                            selected
                              ? "border-red-500 bg-red-50 text-red-700 ring-4 ring-red-100"
                              : "border-zinc-200 hover:border-zinc-400"
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-bold">
                      Lowest
                      <span className="mt-2 flex items-center rounded-2xl border border-zinc-300 bg-zinc-50 transition focus-within:border-red-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-red-100">
                        <span className="pl-4 text-xs font-black text-zinc-400">
                          MMK
                        </span>
                        <input
                          type="number"
                          min={0}
                          step={100000}
                          value={budgetMin}
                          onChange={(event) => setBudgetMin(event.target.value)}
                          className="w-full bg-transparent px-3 py-3 text-lg font-black outline-none"
                        />
                      </span>
                    </label>
                    <label className="block text-sm font-bold">
                      Highest
                      <span className="mt-2 flex items-center rounded-2xl border border-zinc-300 bg-zinc-50 transition focus-within:border-red-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-red-100">
                        <span className="pl-4 text-xs font-black text-zinc-400">
                          MMK
                        </span>
                        <input
                          type="number"
                          min={0}
                          step={100000}
                          value={budgetMax}
                          onChange={(event) => setBudgetMax(event.target.value)}
                          className="w-full bg-transparent px-3 py-3 text-lg font-black outline-none"
                        />
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="hero-rise">
                  <h2 className="text-2xl font-black">
                    What will you use it for?
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Choose the one that fits best.
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {USE_CASES.map((entry) => {
                      const selected = use === entry.id;
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setUse(entry.id)}
                          className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${
                            selected
                              ? "border-red-500 bg-red-50 ring-4 ring-red-100"
                              : "border-zinc-200 hover:border-zinc-400"
                          }`}
                        >
                          <span className="text-2xl" aria-hidden="true">
                            {USE_ICONS[entry.id]}
                          </span>
                          <span>
                            <span className="block font-black">
                              {entry.title}
                            </span>
                            <span className="mt-0.5 block text-xs text-zinc-500">
                              {entry.blurb}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="hero-rise">
                  <h2 className="text-2xl font-black">
                    What screen size do you like?
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Smaller is easier to carry, bigger is easier to work on.
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {SCREEN_CHOICES.map((choice) => {
                      const selected = screen === choice.id;
                      return (
                        <button
                          key={choice.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setScreen(choice.id)}
                          className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${
                            selected
                              ? "border-red-500 bg-red-50 ring-4 ring-red-100"
                              : "border-zinc-200 hover:border-zinc-400"
                          }`}
                        >
                          <span className="text-2xl" aria-hidden="true">
                            {choice.icon}
                          </span>
                          <span>
                            <span className="block font-black">
                              {choice.label}
                            </span>
                            <span className="mt-0.5 block text-xs text-zinc-500">
                              {choice.hint}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep((current) => Math.max(0, current - 1))}
                disabled={step === 0}
                className="rounded-full border border-zinc-300 px-5 py-3 text-sm font-bold transition hover:border-zinc-950 disabled:cursor-not-allowed disabled:text-zinc-300 disabled:hover:border-zinc-300"
              >
                ← Back
              </button>

              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setStep((current) => current + 1)}
                  className="rounded-full bg-zinc-950 px-7 py-3 font-black text-white transition hover:bg-red-600"
                >
                  Next →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={showResults}
                  disabled={isLoading}
                  className="rounded-full bg-red-600 px-7 py-3 font-black text-white shadow-lg shadow-red-600/25 transition hover:bg-red-500 disabled:bg-zinc-400 disabled:shadow-none"
                >
                  {isLoading ? "Loading laptops..." : "Show my 3 laptops →"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Results */}
        {result && answers && (
          <div className="mt-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase tracking-wider text-red-600">
                  {USE_ICONS[answers.use]} Your matches
                </p>
                <h2 className="mt-1 text-3xl font-black">
                  Best for {selectedUse.title.toLowerCase()}
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {formatCurrency(answers.budgetMin)} –{" "}
                  {formatCurrency(answers.budgetMax)} ·{" "}
                  {result.inBudgetCount} of {result.consideredCount} laptops fit
                  your budget
                </p>
              </div>
              <button
                type="button"
                onClick={startAgain}
                className="rounded-full border border-zinc-300 px-5 py-3 text-sm font-bold transition hover:border-zinc-950"
              >
                ↺ Start again
              </button>
            </div>

            {result.notes.map((note) => (
              <p
                key={note}
                className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900"
              >
                {note}
              </p>
            ))}

            {result.picks.length === 0 ? (
              <div className="mt-6 rounded-3xl border border-zinc-200 bg-white p-10 text-center shadow-sm">
                <h3 className="text-xl font-black">No laptop to suggest yet</h3>
                <p className="mt-2 text-sm text-zinc-500">
                  Please contact the shop and we will help you directly.
                </p>
              </div>
            ) : (
              <div className="mt-6 grid gap-5 lg:grid-cols-3">
                {result.picks.map((pick) => {
                  const photo = productPhotos(pick.product)[0]?.url;
                  const isTop = pick.rank === 1;

                  return (
                    <article
                      key={pick.product.id}
                      className={`hero-rise flex flex-col overflow-hidden rounded-3xl border bg-white shadow-sm ${
                        isTop
                          ? "border-red-200 ring-4 ring-red-100"
                          : "border-zinc-200"
                      }`}
                    >
                      <div
                        className={`flex items-center justify-between px-5 py-3 text-xs font-black uppercase tracking-wider ${
                          isTop
                            ? "bg-red-600 text-white"
                            : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        <span>
                          #{pick.rank} {pick.badge}
                        </span>
                        {isTop && <span aria-hidden="true">★</span>}
                      </div>

                      <div className="relative h-44 bg-zinc-50">
                        {photo && (
                          <Image
                            src={photo}
                            unoptimized
                            alt={pick.product.name}
                            fill
                            sizes="320px"
                            className="object-contain p-4"
                          />
                        )}
                      </div>

                      <div className="flex flex-1 flex-col p-5">
                        <Link
                          href={`/products/${pick.product.id}`}
                          className="text-lg font-black leading-snug hover:text-red-600"
                        >
                          {pick.product.name}
                        </Link>
                        <p className="mt-1 text-xs text-zinc-500">
                          {pick.product.brand}
                        </p>
                        <div className="mt-3"><ProductPrice price={effectiveProductPrice(pick.product)} regularPrice={pick.product.price} /></div>

                        {pick.caveat && (
                          <p className="mt-2 inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
                            {pick.caveat}
                          </p>
                        )}

                        <p className="mt-4 text-xs font-black uppercase tracking-wider text-zinc-400">
                          Why this one
                        </p>
                        <ul className="mt-2 space-y-1.5 text-sm text-zinc-700">
                          {pick.reasons.map((reason) => (
                            <li key={reason} className="flex gap-2">
                              <span aria-hidden="true" className="text-red-600">
                                ✓
                              </span>
                              <span>{reason}</span>
                            </li>
                          ))}
                        </ul>

                        <div className="mt-5 flex gap-2 pt-1">
                          <Link
                            href={`/products/${pick.product.id}`}
                            className="flex-1 rounded-full bg-red-600 px-4 py-2.5 text-center text-sm font-black text-white transition hover:bg-red-500"
                          >
                            View
                          </Link>
                          <Link
                            href={`/compare?ids=${result.picks
                              .map((entry) => entry.product.id)
                              .join(",")}`}
                            className="rounded-full border border-zinc-300 px-4 py-2.5 text-sm font-bold transition hover:border-zinc-950"
                          >
                            Compare
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            <p className="mt-6 rounded-2xl bg-zinc-100 p-4 text-xs leading-5 text-zinc-500">
              These suggestions come from the specifications in our catalogue.
              If two laptops are close, ask us on live chat and we will help you
              choose.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
