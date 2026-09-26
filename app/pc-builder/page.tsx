"use client";

import { useLanguage } from "../lib/language";

import { effectiveProductPrice } from "../lib/promotions";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Product } from "../data/products";
import { formatCurrency } from "../lib/format";
import { productPhotos } from "../lib/product-gallery";
import { classifyPcPart, getProductFamily, type PcPartKind } from "../lib/product-specifications";
import {
  countAvailablePcPartCategories,
  generatePcBuilds,
  type PcBuildInput,
  type PcBuildPurpose,
} from "../lib/pc-builder";

const purposeLabels: Record<PcBuildPurpose, string> = {
  office: "Office and everyday work",
  gaming: "Gaming",
  streaming: "Gaming and live streaming",
  creative: "Photo and video editing",
  development: "Programming and development",
  "3d_rendering": "3D rendering and AI workloads",
};

const purposeIcons: Record<PcBuildPurpose, string> = {
  office: "💼",
  gaming: "🎮",
  streaming: "🎥",
  creative: "🎨",
  development: "💻",
  "3d_rendering": "🧊",
};

const PC_BUILDER_STORAGE_KEY = "aphrodite.pc-builder.preferences.v1";
const DEFAULT_PC_BUILD_INPUT: PcBuildInput = {
  minimumBudget: 6_700_000,
  maximumBudget: 8_040_000,
  purpose: "gaming",
};

type SavedPcBuilderPreferences = {
  minimumBudget: string;
  maximumBudget: string;
  purpose: PcBuildPurpose;
  request: PcBuildInput;
};

function isPcBuildPurpose(value: unknown): value is PcBuildPurpose {
  return typeof value === "string" && value in purposeLabels;
}

function savedBuildInput(value: unknown): PcBuildInput | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<PcBuildInput>;
  if (
    !Number.isFinite(candidate.minimumBudget) ||
    !Number.isFinite(candidate.maximumBudget) ||
    !isPcBuildPurpose(candidate.purpose) ||
    Number(candidate.minimumBudget) < 1_340_000 ||
    Number(candidate.maximumBudget) < Number(candidate.minimumBudget) ||
    Number(candidate.maximumBudget) > 134_000_000
  ) return null;
  return {
    minimumBudget: Number(candidate.minimumBudget),
    maximumBudget: Number(candidate.maximumBudget),
    purpose: candidate.purpose,
  };
}

const partIcons: Record<Exclude<PcPartKind, "other">, string> = {
  cpu: "🔲",
  motherboard: "🧩",
  memory: "💾",
  gpu: "🎮",
  storage: "💽",
  psu: "🔌",
  case: "🖥️",
  cooling: "❄️",
};

// Visual theme per build tier. Only colours change; the plans themselves come
// unchanged from generatePcBuilds().
const tierThemes: Record<string, { accent: string; soft: string; bar: string; ring: string; tagline: string }> = {
  Value: { accent: "text-emerald-600", soft: "bg-emerald-50", bar: "bg-emerald-500", ring: "ring-emerald-100", tagline: "Most for your money" },
  Balanced: { accent: "text-sky-600", soft: "bg-sky-50", bar: "bg-sky-500", ring: "ring-sky-100", tagline: "Best all-round choice" },
  Performance: { accent: "text-red-600", soft: "bg-red-50", bar: "bg-red-500", ring: "ring-red-100", tagline: "Maximum speed in your range" },
};

const tierExplanations: Record<string, string> = {
  Value: "Keeps the total close to your minimum budget while covering the essential PC part categories.",
  Balanced: "Spreads the budget across the parts for a strong mix of price and performance.",
  Performance: "Uses more of your available budget to prioritise faster parts for your selected usage.",
};

const heroKinds: Array<Exclude<PcPartKind, "other">> = ["gpu", "motherboard", "cooling", "memory"];

const kindNames: Record<Exclude<PcPartKind, "other">, string> = {
  cpu: "Processor",
  motherboard: "Motherboard",
  memory: "Memory",
  gpu: "Graphics card",
  storage: "Storage",
  psu: "Power supply",
  case: "PC case",
  cooling: "Cooling",
};

function coverPhoto(product: Product) {
  return productPhotos(product)[0]?.url ?? null;
}

function PartThumb({ product, kind, size = "md" }: { product: Product; kind: Exclude<PcPartKind, "other">; size?: "sm" | "md" }) {
  const photo = coverPhoto(product);
  const box = size === "sm" ? "h-12 w-12 rounded-xl" : "h-16 w-16 rounded-2xl sm:h-20 sm:w-20";
  return <div className={`${box} relative shrink-0 overflow-hidden border border-zinc-200 bg-white`}>
    {photo
      ? <Image src={photo} alt={product.name} fill sizes="80px" className="object-contain p-1.5" />
      : <span aria-hidden="true" className="flex h-full w-full items-center justify-center bg-zinc-100 text-2xl grayscale">{partIcons[kind]}</span>}
  </div>;
}

export default function PcBuilderPage() {
  const { language, text, t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [minimumBudget, setMinimumBudget] = useState(String(DEFAULT_PC_BUILD_INPUT.minimumBudget));
  const [maximumBudget, setMaximumBudget] = useState(String(DEFAULT_PC_BUILD_INPUT.maximumBudget));
  const [purpose, setPurpose] = useState<PcBuildPurpose>(DEFAULT_PC_BUILD_INPUT.purpose);
  const [request, setRequest] = useState<PcBuildInput>(DEFAULT_PC_BUILD_INPUT);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    let restoredMinimum = String(DEFAULT_PC_BUILD_INPUT.minimumBudget);
    let restoredMaximum = String(DEFAULT_PC_BUILD_INPUT.maximumBudget);
    let restoredPurpose = DEFAULT_PC_BUILD_INPUT.purpose;
    let restoredRequest = DEFAULT_PC_BUILD_INPUT;
    try {
      const stored = window.localStorage.getItem(PC_BUILDER_STORAGE_KEY);
      if (stored) {
        const saved = JSON.parse(stored) as Partial<SavedPcBuilderPreferences>;
        if (typeof saved.minimumBudget === "string") restoredMinimum = saved.minimumBudget;
        if (typeof saved.maximumBudget === "string") restoredMaximum = saved.maximumBudget;
        if (isPcBuildPurpose(saved.purpose)) restoredPurpose = saved.purpose;
        restoredRequest = savedBuildInput({
          minimumBudget: Number(restoredMinimum),
          maximumBudget: Number(restoredMaximum),
          purpose: restoredPurpose,
        }) ?? savedBuildInput(saved.request) ?? DEFAULT_PC_BUILD_INPUT;
      }
    } catch {
      // A blocked or malformed local-storage value should never prevent the
      // planner from working with its normal defaults.
    }
    queueMicrotask(() => {
      if (!active) return;
      setMinimumBudget(restoredMinimum);
      setMaximumBudget(restoredMaximum);
      setPurpose(restoredPurpose);
      setRequest(restoredRequest);
      setPreferencesLoaded(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!preferencesLoaded) return;
    try {
      const saved: SavedPcBuilderPreferences = {
        minimumBudget,
        maximumBudget,
        purpose,
        request,
      };
      window.localStorage.setItem(PC_BUILDER_STORAGE_KEY, JSON.stringify(saved));
    } catch {
      // Private browsing or strict browser settings can disable storage. The
      // planner remains usable for the current visit in that case.
    }
  }, [maximumBudget, minimumBudget, preferencesLoaded, purpose, request]);

  useEffect(() => {
    async function loadProducts() {
      try {
        const loaded: Product[] = [];
        for (let offset = 0; offset < 500; offset += 100) {
          const response = await fetch(`/api/products?limit=100&offset=${offset}`, { cache: "no-store" });
          const data = (await response.json().catch(() => null)) as { products?: Product[]; error?: string } | null;
          if (!response.ok) throw new Error(data?.error ?? "Unable to load the PC-parts catalogue.");
          const page = data?.products ?? [];
          loaded.push(...page);
          if (page.length < 100) break;
        }
        setProducts(loaded);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load PC parts.");
      } finally {
        setIsLoading(false);
      }
    }
    void loadProducts();
  }, []);

  const plans = useMemo(() => generatePcBuilds(products, request), [products, request]);
  const pcParts = products.filter((product) => getProductFamily(product) === "pc_part");
  const availableCategories = countAvailablePcPartCategories(products);

  // Showcase photos for the hero: the most expensive in-stock part of each kind
  // that has a real photo.
  const heroParts = useMemo(() => {
    const withPhotos = pcParts.filter((product) => product.stock === "In Stock" && coverPhoto(product));
    return heroKinds.flatMap((kind) => {
      const match = withPhotos.filter((product) => classifyPcPart(product) === kind).sort((a, b) => effectiveProductPrice(b) - effectiveProductPrice(a))[0];
      return match ? [{ kind, product: match }] : [];
    });
  }, [pcParts]);

  function updateBuildRequest(nextMinimum: string, nextMaximum: string, nextPurpose: PcBuildPurpose) {
    const minimum = Number(nextMinimum);
    const maximum = Number(nextMaximum);
    if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum < 1340000) {
      setError("Enter a minimum budget of at least MMK 1,340,000.");
      return;
    }
    if (maximum < minimum) {
      setError("Maximum budget must be equal to or higher than the minimum budget.");
      return;
    }
    if (maximum > 134000000) {
      setError("Maximum budget must be MMK 134,000,000 or less.");
      return;
    }
    setError("");
    setRequest({ minimumBudget: Math.floor(minimum), maximumBudget: Math.floor(maximum), purpose: nextPurpose });
  }

  function changeMinimumBudget(value: string) {
    setMinimumBudget(value);
    updateBuildRequest(value, maximumBudget, purpose);
  }

  function changeMaximumBudget(value: string) {
    setMaximumBudget(value);
    updateBuildRequest(minimumBudget, value, purpose);
  }

  function changePurpose(value: PcBuildPurpose) {
    setPurpose(value);
    updateBuildRequest(minimumBudget, maximumBudget, value);
  }

  function translateBuildWarning(warning: string) {
    const socket = warning.match(/^No motherboard explicitly lists the (.+) socket\. Confirm CPU and motherboard compatibility with the store\.$/);
    if (socket) return t("builder.socketWarning", { socket: socket[1] });
    const memory = warning.match(/^No memory item explicitly matches (.+)\. Confirm motherboard memory support with the store\.$/);
    if (memory) return t("builder.memoryWarning", { memory: memory[1] });
    return text(warning);
  }

  const stats = [
    { value: isLoading ? "…" : pcParts.length.toLocaleString(), label: "PC parts in catalogue" },
    { value: isLoading ? "…" : String(availableCategories), label: "Part categories" },
    { value: "3", label: "Build ideas per search" },
  ];

  return <main className="min-h-screen bg-zinc-50 text-zinc-950">
    <header className="sticky top-0 z-30 border-b border-zinc-200/70 bg-white/85 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3 sm:px-5"><Link href="/" className="w-28 shrink-0 sm:w-auto"><Image src="/brand/aphrodite-myanmar.png" alt="Aphrodite Myanmar" width={218} height={77} className="h-9 w-auto sm:h-11" priority /></Link><div className="flex shrink-0 gap-2"><Link href="/#pc-parts" className="whitespace-nowrap rounded-full border border-zinc-300 px-2.5 py-2 text-[11px] font-bold transition hover:border-zinc-950 sm:px-4 sm:text-sm">{text("PC parts")}</Link><Link href="/" className="whitespace-nowrap rounded-full bg-zinc-950 px-3 py-2 text-[11px] font-bold text-white transition hover:bg-red-600 sm:px-4 sm:text-sm">{text("Store")}</Link></div></div></header>

    <section className="mx-auto max-w-7xl px-5 py-8 sm:py-10">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-[2rem] bg-zinc-950 text-white shadow-2xl shadow-zinc-950/20">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.18]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px)", backgroundSize: "44px 44px", maskImage: "radial-gradient(ellipse at 70% 40%, black 20%, transparent 75%)" }} />
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-32 h-[28rem] w-[28rem] rounded-full bg-red-600/40 blur-[110px]" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 left-10 h-80 w-80 rounded-full bg-fuchsia-600/20 blur-[100px]" />

        <div className="relative grid gap-10 p-5 sm:p-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="hero-rise">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.25em] text-red-300"><span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />{text("PC Build Planner")}</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-black leading-snug tracking-tight sm:text-6xl">{language === "my" ? text("Turn your budget into a complete demo PC setup.") : <>Turn your budget into a <span className="bg-gradient-to-r from-red-400 via-rose-400 to-orange-300 bg-clip-text text-transparent">complete</span> demo PC setup.</>}</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg">{text("Choose how much you can spend and what you want to do. The planner uses current in-stock Aphrodite PC parts and creates value, balanced, and performance estimates.")}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#requirements" className="rounded-full bg-red-600 px-6 py-3 font-black text-white shadow-lg shadow-red-600/30 transition hover:bg-red-500">{text("Start planning →")}</a>
              <Link href="/#pc-parts" className="rounded-full border border-white/20 bg-white/5 px-6 py-3 font-bold text-white transition hover:bg-white/10">{text("See all parts")}</Link>
            </div>
            <dl className="mt-9 grid max-w-xl grid-cols-1 sm:grid-cols-3 gap-3">
              {stats.map((stat) => <div key={stat.label} className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur"><dt className="order-2 mt-1 text-xs leading-4 text-zinc-400">{text(stat.label)}</dt><dd className="text-2xl font-black sm:text-3xl">{stat.value}</dd></div>)}
            </dl>
          </div>

          <div aria-hidden="true" className="relative hidden lg:block">
            {heroParts.length === 0
              ? <div className="grid grid-cols-2 gap-4">{[0, 1, 2, 3].map((key) => <div key={key} className="aspect-[4/3] animate-pulse rounded-3xl bg-white/10" />)}</div>
              : <div className="grid grid-cols-2 gap-x-4 gap-y-8">{heroParts.map(({ kind, product }, index) => {
                const photo = coverPhoto(product)!;
                const tilt = ["-rotate-3", "rotate-2 translate-y-6", "rotate-2 -translate-y-2", "-rotate-2 translate-y-4"][index];
                return <div key={product.id} className={tilt}>
                  <div className="hero-float rounded-3xl bg-white p-3 shadow-2xl shadow-black/50 ring-1 ring-white/20" style={{ animationDelay: `${index * -1.5}s` }}>
                    <div className="relative aspect-[4/3] w-full"><Image src={photo} alt="" fill sizes="260px" className="object-contain" /></div>
                    <p className="mt-2 truncate text-[11px] font-black uppercase tracking-wider text-zinc-500">{partIcons[kind]} {text(kindNames[kind])}</p>
                  </div>
                </div>;
              })}</div>}
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[380px_1fr]">
        {/* Requirements form */}
        <aside id="requirements" className="scroll-mt-24"><div className="sticky top-24 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-xl">🛠️</span><div><h2 className="text-2xl font-black">{text("Your requirements")}</h2><p className="text-sm text-zinc-500">{text("Example: MMK 6,700,000 – 8,040,000.")}</p></div></div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <label className="block text-sm font-bold">{text("Minimum budget")}
              <span className="mt-2 flex items-center rounded-2xl border border-zinc-300 bg-zinc-50 transition focus-within:border-red-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-red-100"><span className="shrink-0 pl-4 text-xs font-black text-zinc-400">MMK</span><input type="number" min={1340000} max={134000000} step={1} value={minimumBudget} onChange={(event) => changeMinimumBudget(event.target.value)} className="w-full bg-transparent px-3 py-3 text-lg font-black outline-none" /></span>
              <span className="mt-1 block text-xs font-normal text-zinc-400">{Number(minimumBudget) ? formatCurrency(Number(minimumBudget)) : "—"}</span>
            </label>
            <label className="block text-sm font-bold">{text("Maximum budget")}
              <span className="mt-2 flex items-center rounded-2xl border border-zinc-300 bg-zinc-50 transition focus-within:border-red-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-red-100"><span className="shrink-0 pl-4 text-xs font-black text-zinc-400">MMK</span><input type="number" min={1340000} max={134000000} step={1} value={maximumBudget} onChange={(event) => changeMaximumBudget(event.target.value)} className="w-full bg-transparent px-3 py-3 text-lg font-black outline-none" /></span>
              <span className="mt-1 block text-xs font-normal text-zinc-400">{Number(maximumBudget) ? formatCurrency(Number(maximumBudget)) : "—"}</span>
            </label>
          </div>

          <fieldset className="mt-5"><legend className="text-sm font-bold">{text("Usage of PC")}</legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-2">
              {(Object.keys(purposeLabels) as PcBuildPurpose[]).map((value) => {
                const selected = purpose === value;
                return <button key={value} type="button" aria-pressed={selected} onClick={() => changePurpose(value)} className={`flex items-center gap-2 rounded-2xl border px-3 py-3 text-left text-sm font-bold leading-relaxed transition ${selected ? "border-red-500 bg-red-50 text-red-700 ring-4 ring-red-100" : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400"}`}><span className="shrink-0 text-xl leading-none" aria-hidden="true">{purposeIcons[value]}</span><span className="min-w-0">{text(purposeLabels[value])}</span></button>;
              })}
            </div>
          </fieldset>

          <p aria-live="polite" className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-center text-sm font-bold text-red-700">{isLoading ? text("Loading catalogue...") : text("Builds update automatically when you change the budget or usage.")}</p>
          <p className="mt-4 rounded-2xl bg-zinc-50 p-3 text-xs leading-5 text-zinc-500">{text("This is a demo estimate. Before ordering, staff must confirm CPU socket, motherboard, RAM, case clearance, cooling, and power-supply compatibility.")}</p>
        </div></aside>

        {/* Results */}
        <div>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-black uppercase tracking-wider text-red-600">{purposeIcons[request.purpose]} {text("Build ideas")}</p><h2 className="mt-1 text-3xl font-black">{t("builder.forPurpose", { purpose: text(purposeLabels[request.purpose]) })}</h2></div><p className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-bold text-zinc-600">{formatCurrency(request.minimumBudget)} – {formatCurrency(request.maximumBudget)}</p></div>
          {error && <p role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{text(error)}</p>}

          {isLoading ? <div className="space-y-6">{[0, 1].map((key) => <div key={key} className="h-72 animate-pulse rounded-3xl bg-white shadow-sm" />)}</div>
            : plans.length === 0 ? <div className="rounded-3xl bg-white p-10 text-center shadow-sm"><h3 className="text-xl font-black">{text("Not enough recognised PC parts yet")}</h3><p className="mt-2 text-sm text-zinc-500">{text("Sync or add products with categories such as CPU, Motherboard, RAM, GPU, Storage, PSU, Case, and Cooling.")}</p></div>
            : <div className="space-y-6">{plans.map((plan) => {
              const theme = tierThemes[plan.label] ?? tierThemes.Balanced;
              const editorHref = `/pc-builder/customize?${new URLSearchParams({
                parts: plan.parts.map((part) => part.product.id).join(","),
                name: `${plan.label} build`,
              }).toString()}`;
              return <article key={plan.id} className={`hero-rise overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm ring-4 ${theme.ring}`}>
                <div className={`relative p-6 ${theme.soft}`}>
                  <div>
                    <details className="group">
                      <summary className={`flex w-fit cursor-pointer list-none items-center gap-2 text-sm font-black uppercase tracking-wider ${theme.accent} [&::-webkit-details-marker]:hidden`}>
                        {t("builder.planLabel", { label: text(plan.label) })}
                        <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full border border-current text-xs transition group-open:rotate-45">?</span>
                      </summary>
                      <div className="mt-3 max-w-2xl rounded-2xl border border-black/5 bg-white/85 p-4 text-left normal-case tracking-normal shadow-sm">
                        <p className="text-sm font-black text-zinc-950">{text("About this build")}</p>
                        <p className="mt-1 text-sm leading-6 text-zinc-600">{text(tierExplanations[plan.label] ?? tierExplanations.Balanced)}</p>
                        {(plan.missing.length > 0 || plan.warnings.length > 0) && <div className="mt-3 border-t border-amber-200 pt-3 text-sm text-amber-950">
                          <p className="font-black">{text("Compatibility checks before ordering")}</p>
                          {plan.missing.length > 0 && <p className="mt-1"><b>{text("Missing catalogue categories:")}</b> {plan.missing.map(text).join("၊ ")}</p>}
                          {plan.warnings.map((warning) => <p key={warning} className="mt-1">⚠️ {translateBuildWarning(warning)}</p>)}
                        </div>}
                      </div>
                    </details>
                    <p className="mt-1 text-xs font-bold text-zinc-500">{text(theme.tagline)}</p><h3 className="mt-2 text-4xl font-black tracking-tight">{formatCurrency(plan.total)}</h3><p className="text-sm text-zinc-500">{t("builder.target", { price: formatCurrency(plan.targetBudget) })}</p>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">{plan.parts.map((part) => <PartThumb key={`${part.kind}-${part.product.id}`} product={part.product} kind={part.kind} size="sm" />)}</div>
                </div>

                <ul className="divide-y divide-zinc-100">{plan.parts.map((part) => {
                  const share = plan.total > 0 ? Math.round((effectiveProductPrice(part.product) / plan.total) * 100) : 0;
                  return <li key={`${part.kind}-${part.product.id}`} className="group grid grid-cols-[auto_1fr] items-center gap-4 p-4 transition hover:bg-zinc-50 sm:grid-cols-[auto_1fr_auto] sm:px-6">
                    <PartThumb product={part.product} kind={part.kind} />
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-wider text-zinc-400">{partIcons[part.kind]} {text(part.label)}</p>
                      <Link href={`/products/${part.product.id}`} className="mt-0.5 block font-black leading-snug group-hover:text-red-600">{part.product.name}</Link>
                      <p className="text-xs text-zinc-500">{part.product.brand} · {text(part.product.category)}</p>
                      <div className="mt-2 flex items-center gap-2 sm:hidden"><p className="font-black">{formatCurrency(effectiveProductPrice(part.product))}</p></div>
                    </div>
                    <div className="hidden w-40 text-right sm:block"><p className="font-black">{formatCurrency(effectiveProductPrice(part.product))}</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100"><div className={`h-full rounded-full ${theme.bar}`} style={{ width: `${Math.max(share, 3)}%` }} /></div><p className="mt-1 text-[11px] font-bold text-zinc-400">{t("builder.share", { share })}</p></div>
                  </li>;
                })}</ul>

                <div className="flex justify-end border-t border-zinc-100 p-5">
                  <Link
                    href={editorHref}
                    className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-5 py-3 text-sm font-black text-white transition hover:bg-red-600"
                  >
                    {text("Customize & edit build")} <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>;
            })}</div>}
        </div>
      </div>

      <section className="relative mt-10 overflow-hidden rounded-3xl bg-gradient-to-br from-red-600 to-rose-700 p-8 text-white"><div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" /><h2 className="relative text-2xl font-black">{text("Why the price may change")}</h2><p className="relative mt-3 max-w-4xl text-sm leading-6 text-red-50">{text("The generated total uses current catalogue unit prices. Final cost can change when stock, compatibility, Windows licensing, assembly, extra fans, Wi-Fi, monitor, keyboard, mouse, delivery, or promotional pricing is added. Use this planner to start the conversation, then ask Aphrodite staff to confirm the final parts list.")}</p></section>
    </section>
  </main>;
}
