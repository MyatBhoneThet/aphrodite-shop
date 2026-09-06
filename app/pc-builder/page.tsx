"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Product } from "../data/products";
import { formatCurrency } from "../lib/format";
import { getProductFamily } from "../lib/product-specifications";
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

export default function PcBuilderPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [minimumBudget, setMinimumBudget] = useState("6700000");
  const [maximumBudget, setMaximumBudget] = useState("8040000");
  const [purpose, setPurpose] = useState<PcBuildPurpose>("gaming");
  const [request, setRequest] = useState<PcBuildInput>({ minimumBudget: 6700000, maximumBudget: 8040000, purpose: "gaming" });

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

  function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const minimum = Number(minimumBudget);
    const maximum = Number(maximumBudget);
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
    setRequest({ minimumBudget: Math.floor(minimum), maximumBudget: Math.floor(maximum), purpose });
  }

  return <main className="min-h-screen bg-zinc-50 text-zinc-950">
    <header className="border-b bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4"><Link href="/"><Image src="/brand/aphrodite-myanmar.png" alt="Aphrodite Myanmar" width={218} height={77} className="h-12 w-auto" priority /></Link><div className="flex gap-2"><Link href="/#pc-parts" className="rounded-full border px-4 py-2 text-sm font-bold">Browse PC parts</Link><Link href="/" className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-bold text-white">Store</Link></div></div></header>

    <section className="mx-auto max-w-7xl px-5 py-10">
      <div className="overflow-hidden rounded-[2rem] bg-zinc-950 p-8 text-white sm:p-12"><p className="text-sm font-black uppercase tracking-[0.25em] text-red-400">PC Build Planner</p><h1 className="mt-3 max-w-4xl text-4xl font-black sm:text-6xl">Turn your budget into a complete demo PC setup.</h1><p className="mt-5 max-w-3xl text-zinc-300">Choose how much you can spend and what you want to do. The planner uses current in-stock Aphrodite PC parts and creates value, balanced, and performance estimates.</p><div className="mt-6 flex flex-wrap gap-3 text-sm"><span className="rounded-full bg-white/10 px-4 py-2">{pcParts.length} PC-part products loaded</span><span className="rounded-full bg-white/10 px-4 py-2">{availableCategories} part categories available</span><span className="rounded-full bg-white/10 px-4 py-2">Live catalogue prices</span></div></div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[380px_1fr]">
        <aside><form onSubmit={generate} className="sticky top-6 rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-2xl font-black">Your requirements</h2><p className="mt-2 text-sm text-zinc-500">Example: MMK 6,700,000 minimum and MMK 8,040,000 maximum.</p>
          <label className="mt-6 block text-sm font-bold">Minimum budget (MMK)<input type="number" min={1340000} max={134000000} step={100000} value={minimumBudget} onChange={(event) => setMinimumBudget(event.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3 text-lg font-bold outline-none focus:border-red-500" /></label>
          <label className="mt-4 block text-sm font-bold">Maximum budget (MMK)<input type="number" min={1340000} max={134000000} step={100000} value={maximumBudget} onChange={(event) => setMaximumBudget(event.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3 text-lg font-bold outline-none focus:border-red-500" /></label>
          <label className="mt-4 block text-sm font-bold">What will you use the PC for?<select value={purpose} onChange={(event) => setPurpose(event.target.value as PcBuildPurpose)} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 font-normal outline-none focus:border-red-500">{Object.entries(purposeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <button type="submit" disabled={isLoading} className="mt-6 w-full rounded-full bg-red-600 px-5 py-3 font-black text-white disabled:bg-zinc-400">{isLoading ? "Loading catalogue..." : "Generate PC builds"}</button>
          <p className="mt-4 text-xs leading-5 text-zinc-500">This is a demo estimate. Before ordering, staff must confirm CPU socket, motherboard, RAM, case clearance, cooling, and power-supply compatibility.</p>
        </form></aside>

        <div>
          <div className="mb-5"><h2 className="text-3xl font-black">Build ideas for {purposeLabels[request.purpose]}</h2><p className="mt-2 text-zinc-500">Requested range: {formatCurrency(request.minimumBudget)} – {formatCurrency(request.maximumBudget)}</p></div>
          {error && <p role="alert" className="mb-5 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p>}
          {!isLoading && plans.length === 0 ? <div className="rounded-3xl bg-white p-10 text-center shadow-sm"><h3 className="text-xl font-black">Not enough recognised PC parts yet</h3><p className="mt-2 text-sm text-zinc-500">Sync or add products with categories such as CPU, Motherboard, RAM, GPU, Storage, PSU, Case, and Cooling.</p></div> : <div className="space-y-6">{plans.map((plan) => <article key={plan.id} className="overflow-hidden rounded-3xl bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-6"><div><p className="text-sm font-black uppercase tracking-wider text-red-600">{plan.label} build</p><h3 className="mt-1 text-3xl font-black">{formatCurrency(plan.total)}</h3><p className="text-sm text-zinc-500">Target {formatCurrency(plan.targetBudget)}</p></div><span className={`rounded-full px-4 py-2 text-xs font-black ${plan.withinRequestedRange ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}`}>{plan.withinRequestedRange ? "Within requested range" : "Needs review"}</span></div>
            <div className="divide-y">{plan.parts.map((part) => <div key={`${part.kind}-${part.product.id}`} className="grid gap-3 p-5 sm:grid-cols-[130px_1fr_auto] sm:items-center"><p className="text-xs font-black uppercase tracking-wider text-zinc-400">{part.label}</p><div><Link href={`/products/${part.product.id}`} className="font-black hover:text-red-600">{part.product.name}</Link><p className="text-xs text-zinc-500">{part.product.brand} · {part.product.category}</p></div><p className="font-black">{formatCurrency(part.product.price)}</p></div>)}</div>
            {(plan.missing.length > 0 || plan.warnings.length > 0) && <div className="border-t bg-amber-50 p-5 text-sm text-amber-950">{plan.missing.length > 0 && <p><b>Missing catalogue categories:</b> {plan.missing.join(", ")}</p>}{plan.warnings.map((warning) => <p key={warning} className="mt-1">• {warning}</p>)}</div>}
          </article>)}</div>}
        </div>
      </div>

      <section className="mt-10 rounded-3xl bg-red-600 p-8 text-white"><h2 className="text-2xl font-black">Why the price may change</h2><p className="mt-3 max-w-4xl text-sm leading-6 text-red-50">The generated total uses current catalogue unit prices. Final cost can change when stock, compatibility, Windows licensing, assembly, extra fans, Wi-Fi, monitor, keyboard, mouse, delivery, or promotional pricing is added. Use this planner to start the conversation, then ask Aphrodite staff to confirm the final parts list.</p></section>
    </section>
  </main>;
}
