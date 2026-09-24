"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Product } from "../../data/products";
import { authHeaders } from "../../lib/client-auth";
import { formatCurrency } from "../../lib/format";
import { useLanguage } from "../../lib/language";
import { effectiveProductPrice } from "../../lib/promotions";
import {
  classifyPcPart,
  getProductFamily,
  type PcPartKind,
} from "../../lib/product-specifications";
import { useCurrentUser } from "../../lib/useCurrentUser";

type BuildKind = Exclude<PcPartKind, "other">;

const buildKinds: BuildKind[] = [
  "cpu",
  "motherboard",
  "memory",
  "gpu",
  "storage",
  "psu",
  "case",
  "cooling",
];

const kindDetails: Record<BuildKind, { label: string; icon: string }> = {
  cpu: { label: "Processor", icon: "▣" },
  motherboard: { label: "Motherboard", icon: "▦" },
  memory: { label: "Memory", icon: "▤" },
  gpu: { label: "Graphics card", icon: "◫" },
  storage: { label: "Storage", icon: "▰" },
  psu: { label: "Power supply", icon: "⌁" },
  case: { label: "PC case", icon: "▥" },
  cooling: { label: "Cooling", icon: "❄" },
};

function PartPicker({
  label,
  options,
  chosen,
  isLoading,
  onChoose,
}: {
  label: string;
  options: Product[];
  chosen?: Product;
  isLoading: boolean;
  onChoose: (productId: number) => void;
}) {
  const pickerRef = useRef<HTMLDetailsElement>(null);
  const disabled = isLoading || options.length === 0;

  return (
    <details ref={pickerRef} className="group min-w-0">
      <summary
        aria-disabled={disabled}
        onClick={(event) => {
          if (disabled) event.preventDefault();
        }}
        className={`flex min-h-16 list-none items-center gap-3 rounded-xl border px-3 py-2 outline-none transition marker:content-none [&::-webkit-details-marker]:hidden ${
          disabled
            ? "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400"
            : "cursor-pointer border-zinc-300 bg-white hover:border-red-400 group-open:border-red-500 group-open:ring-2 group-open:ring-red-100"
        }`}
      >
        {chosen ? (
          <>
            <span className="relative h-11 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-50">
              <Image
                src={chosen.image}
                alt=""
                fill
                sizes="56px"
                className="object-contain p-1"
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-1 block text-sm font-bold">{chosen.name}</span>
              <span className="mt-0.5 block text-xs font-semibold text-red-600">
                {formatCurrency(effectiveProductPrice(chosen))}
              </span>
            </span>
          </>
        ) : (
          <span className="min-w-0 flex-1 text-sm font-bold">
            {isLoading ? "Loading..." : "Add a part"}
          </span>
        )}
        <span aria-hidden="true" className="shrink-0 text-zinc-400 transition group-open:rotate-180">⌄</span>
      </summary>

      {!disabled && (
        <div className="mt-2 max-h-80 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-2 shadow-xl">
          <div className="grid grid-cols-3 gap-2" aria-label={`${label} products`}>
            {options.map((product) => {
              const active = chosen?.id === product.id;
              return (
                <button
                  key={product.id}
                  type="button"
                  aria-pressed={active}
                  title={product.name}
                  onClick={() => {
                    onChoose(product.id);
                    if (pickerRef.current) pickerRef.current.open = false;
                  }}
                  className={`min-w-0 rounded-lg border p-2 text-left transition hover:border-red-400 hover:bg-red-50 ${
                    active ? "border-red-500 bg-red-50 ring-1 ring-red-200" : "border-zinc-200"
                  }`}
                >
                  <span className="relative block aspect-[4/3] w-full overflow-hidden rounded-md bg-zinc-50">
                    <Image
                      src={product.image}
                      alt=""
                      fill
                      sizes="120px"
                      className="object-contain p-1"
                    />
                  </span>
                  <span className="mt-1.5 line-clamp-2 block text-[11px] font-bold leading-4">
                    {product.name}
                  </span>
                  <span className="mt-1 block truncate text-[10px] font-semibold text-red-600">
                    {formatCurrency(effectiveProductPrice(product))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </details>
  );
}

export default function CustomizePcBuildPage() {
  const { text } = useLanguage();
  const { user, status: userStatus } = useCurrentUser();
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Partial<Record<BuildKind, number>>>({});
  const [buildName, setBuildName] = useState("My custom PC build");
  const [buildQuantity, setBuildQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ids = new Set(
      (params.get("parts") ?? "")
        .split(",")
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    );
    const requestedName = params.get("name")?.trim();

    async function loadProducts() {
      try {
        const loaded: Product[] = [];
        for (let offset = 0; offset < 500; offset += 100) {
          const response = await fetch(`/api/products?limit=100&offset=${offset}`, {
            cache: "no-store",
          });
          const data = (await response.json().catch(() => null)) as
            | { products?: Product[]; error?: string }
            | null;
          if (!response.ok) {
            throw new Error(data?.error ?? "Unable to load PC parts.");
          }
          const page = data?.products ?? [];
          loaded.push(...page);
          if (page.length < 100) break;
        }

        const initial: Partial<Record<BuildKind, number>> = {};
        for (const product of loaded) {
          if (!ids.has(product.id)) continue;
          const kind = classifyPcPart(product);
          if (kind !== "other") initial[kind] = product.id;
        }
        if (requestedName) setBuildName(requestedName.slice(0, 80));
        setProducts(loaded);
        setSelected(initial);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load PC parts.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadProducts();
  }, []);

  const optionsByKind = useMemo(() => {
    const groups = new Map<BuildKind, Product[]>();
    for (const kind of buildKinds) groups.set(kind, []);
    for (const product of products) {
      if (
        product.stock !== "In Stock" ||
        getProductFamily(product) !== "pc_part" ||
        effectiveProductPrice(product) <= 0
      ) continue;
      const kind = classifyPcPart(product);
      if (kind === "other") continue;
      groups.get(kind)?.push(product);
    }
    for (const group of groups.values()) {
      group.sort((left, right) => effectiveProductPrice(left) - effectiveProductPrice(right));
    }
    return groups;
  }, [products]);

  const selectedProducts = useMemo(
    () => buildKinds.flatMap((kind) => {
      const id = selected[kind];
      const product = id ? products.find((item) => item.id === id) : undefined;
      return product ? [{ kind, product }] : [];
    }),
    [products, selected]
  );
  const total = selectedProducts.reduce(
    (sum, item) => sum + effectiveProductPrice(item.product),
    0
  );

  function choosePart(kind: BuildKind, value: string) {
    setMessage("");
    setSelected((current) => {
      const next = { ...current };
      const id = Number(value);
      if (Number.isInteger(id) && id > 0) next[kind] = id;
      else delete next[kind];
      return next;
    });
  }

  async function addBuildToCart() {
    if (!user || selectedProducts.length === 0 || isAdding) return;
    setIsAdding(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/cart/build", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          product_ids: selectedProducts.map(({ product }) => product.id),
          quantity: buildQuantity,
        }),
      });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Unable to add this build to the cart.");
      setMessage(`${buildQuantity} complete PC build${buildQuantity === 1 ? "" : "s"} (${selectedProducts.length * buildQuantity} component units) added to your cart.`);
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Unable to add this build to the cart. Please try again.");
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4">
          <Link href="/" className="shrink-0">
            <Image
              src="/brand/aphrodite-myanmar.png"
              alt="Aphrodite Myanmar"
              width={218}
              height={77}
              className="h-10 w-auto"
              priority
            />
          </Link>
          <Link href="/pc-builder" className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-bold hover:border-red-500 hover:text-red-600">
            ← {text("Back to build ideas")}
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-10">
        <div className="mb-8 max-w-3xl">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-red-600">
            {text("Custom PC builder")}
          </p>
          <input
            value={buildName}
            maxLength={80}
            onChange={(event) => setBuildName(event.target.value)}
            aria-label={text("Build name")}
            className="mt-3 w-full border-b-2 border-zinc-200 bg-transparent pb-2 text-3xl font-black outline-none transition focus:border-red-500 sm:text-4xl"
          />
          <p className="mt-3 text-zinc-500">
            {text("Add, replace, or remove parts. Your build total updates immediately.")}
          </p>
        </div>

        {error && <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{text(error)}</p>}
        {message && <p role="status" className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-800">{text(message)} <Link href="/cart" className="underline">{text("View cart")}</Link></p>}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            {buildKinds.map((kind) => {
              const details = kindDetails[kind];
              const options = optionsByKind.get(kind) ?? [];
              const chosen = selected[kind]
                ? products.find((product) => product.id === selected[kind])
                : undefined;
              return (
                <div key={kind} className="grid gap-4 border-b border-zinc-100 p-5 last:border-b-0 sm:grid-cols-[140px_minmax(0,1fr)_auto] sm:items-center">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-zinc-400">
                      <span aria-hidden="true">{details.icon}</span> {text(details.label)}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">{options.length} {text("available")}</p>
                  </div>
                  <div className="min-w-0">
                    <PartPicker
                      label={text(details.label)}
                      options={options}
                      chosen={chosen}
                      isLoading={isLoading}
                      onChoose={(productId) => choosePart(kind, String(productId))}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!chosen}
                    onClick={() => choosePart(kind, "")}
                    className="justify-self-start rounded-lg border border-zinc-300 px-3 py-2 text-sm font-bold text-zinc-600 transition enabled:hover:border-red-500 enabled:hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-35 sm:justify-self-end"
                  >
                    {text("Remove")}
                  </button>
                </div>
              );
            })}
          </div>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-2xl bg-zinc-950 p-6 text-white shadow-xl">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-red-400">{text("Build summary")}</p>
              <p className="mt-3 text-sm text-zinc-400">{buildName || text("Untitled build")}</p>
              <p className="mt-2 text-xs font-bold uppercase tracking-wider text-zinc-500">{text("Price per PC")}</p>
              <p className="mt-1 text-3xl font-black tracking-tight">{formatCurrency(total)}</p>
              <p className="mt-1 text-sm text-zinc-400">
                {selectedProducts.length} / {buildKinds.length} {text("parts selected")}
              </p>

              <div className="mt-5 rounded-xl border border-zinc-700 bg-zinc-900 p-4">
                <label htmlFor="build-quantity" className="block text-sm font-bold text-white">
                  {text("Number of identical PCs")}
                </label>
                <div className="mt-3 grid grid-cols-[44px_minmax(0,1fr)_44px] gap-2">
                  <button
                    type="button"
                    disabled={buildQuantity <= 1 || isAdding}
                    onClick={() => setBuildQuantity((quantity) => Math.max(1, quantity - 1))}
                    aria-label={text("Decrease PC quantity")}
                    className="rounded-lg border border-zinc-600 text-xl font-black disabled:cursor-not-allowed disabled:opacity-35"
                  >−</button>
                  <input
                    id="build-quantity"
                    type="number"
                    min={1}
                    max={999}
                    inputMode="numeric"
                    value={buildQuantity}
                    disabled={isAdding}
                    onChange={(event) => setBuildQuantity(Math.min(999, Math.max(1, Number(event.target.value) || 1)))}
                    className="min-w-0 rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-center text-lg font-black text-white outline-none focus:border-red-500"
                  />
                  <button
                    type="button"
                    disabled={buildQuantity >= 999 || isAdding}
                    onClick={() => setBuildQuantity((quantity) => Math.min(999, quantity + 1))}
                    aria-label={text("Increase PC quantity")}
                    className="rounded-lg border border-zinc-600 text-xl font-black disabled:cursor-not-allowed disabled:opacity-35"
                  >+</button>
                </div>
                <div className="mt-4 flex items-end justify-between gap-3 border-t border-zinc-700 pt-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">{text("Order total")}</span>
                  <span className="text-xl font-black text-white">{formatCurrency(total * buildQuantity)}</span>
                </div>
              </div>

              {userStatus === "checking" ? (
                <button disabled className="mt-6 w-full rounded-xl bg-zinc-700 px-5 py-3 font-black text-zinc-300">
                  {text("Checking account...")}
                </button>
              ) : user ? (
                <button
                  type="button"
                  disabled={selectedProducts.length === 0 || isAdding}
                  onClick={addBuildToCart}
                  className="mt-6 w-full rounded-xl bg-red-600 px-5 py-3 font-black text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-700"
                >
                  {isAdding ? text("Adding build...") : `${text("Add")} ${buildQuantity} ${text(buildQuantity === 1 ? "PC build to cart" : "PC builds to cart")}`}
                </button>
              ) : (
                <Link href="/login" className="mt-6 block w-full rounded-xl bg-red-600 px-5 py-3 text-center font-black text-white transition hover:bg-red-500">
                  {text("Login to add build to cart")}
                </Link>
              )}

              <p className="mt-4 text-xs leading-5 text-zinc-400">
                {text("Each selected component is added at the chosen PC quantity. Staff should confirm compatibility and stock before checkout.")}
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
