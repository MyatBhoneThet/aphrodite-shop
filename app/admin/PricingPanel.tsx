"use client";

import { useAdminText } from "../lib/useAdminText";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { Product } from "../data/products";
import { authHeaders } from "../lib/client-auth";
import { formatCurrency } from "../lib/format";

type PriceList = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
};

type Tier = {
  id: string;
  price_list_id: string;
  product_id: number;
  min_quantity: number;
  unit_price: number;
  is_active: boolean;
  effective_from: string | null;
  effective_to: string | null;
};

type Pricing = {
  quantity: number;
  retailUnitPrice: number;
  unitPrice: number;
  lineTotal: number;
  savings: number;
  tierMinQuantity: number | null;
  label: string;
};

async function readError(response: Response) {
  const data = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return data?.error ?? "Request failed.";
}

export default function PricingPanel() {
  const a = useAdminText();
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [activeListId, setActiveListId] = useState<string>("");
  const [newListName, setNewListName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [tierForm, setTierForm] = useState({
    product_id: "",
    min_quantity: "",
    unit_price: "",
  });

  const [previewForm, setPreviewForm] = useState({
    product_id: "",
    quantity: "10",
    price_list_id: "",
  });
  const [preview, setPreview] = useState<Pricing | null>(null);

  const loadBase = useCallback(async () => {
    setError("");

    try {
      const [listsResponse, productsResponse] = await Promise.all([
        fetch("/api/admin/price-lists", {
          headers: authHeaders(),
          cache: "no-store",
        }),
        fetch("/api/products?limit=100", {
          headers: authHeaders(),
          cache: "no-store",
        }),
      ]);

      if (!listsResponse.ok) throw new Error(await readError(listsResponse));
      if (!productsResponse.ok) throw new Error(await readError(productsResponse));

      const listsData = (await listsResponse.json()) as { priceLists: PriceList[] };
      const productsData = (await productsResponse.json()) as {
        products: Product[];
      };

      setPriceLists(listsData.priceLists ?? []);
      setProducts(productsData.products ?? []);
      setActiveListId((current) => current || listsData.priceLists?.[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load pricing data.");
    }
  }, []);

  const loadTiers = useCallback(async () => {
    if (!activeListId) {
      setTiers([]);
      return;
    }

    const response = await fetch(
      `/api/admin/tiers?price_list_id=${encodeURIComponent(activeListId)}`,
      { headers: authHeaders(), cache: "no-store" }
    );

    if (response.ok) {
      const data = (await response.json()) as { tiers: Tier[] };
      setTiers(data.tiers ?? []);
    }
  }, [activeListId]);

  useEffect(() => {
    async function loadOnMount() {
      await loadBase();
    }

    loadOnMount();
  }, [loadBase]);

  useEffect(() => {
    async function loadOnChange() {
      await loadTiers();
    }

    loadOnChange();
  }, [loadTiers]);

  function productName(id: number) {
    return products.find((product) => product.id === id)?.name ?? `Product #${id}`;
  }

  async function createPriceList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/price-lists", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ name: newListName.trim() }),
      });

      if (!response.ok) throw new Error(await readError(response));

      setNewListName("");
      setMessage("Price list created.");
      await loadBase();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create price list.");
    }
  }

  async function toggleListActive(list: PriceList) {
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/admin/price-lists/${list.id}`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !list.is_active }),
      });

      if (!response.ok) throw new Error(await readError(response));

      setMessage(`${list.name} ${list.is_active ? "deactivated" : "activated"}.`);
      await loadBase();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update price list.");
    }
  }

  async function addTier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    const productId = Number(tierForm.product_id);
    const minQuantity = Number(tierForm.min_quantity);
    const unitPrice = Number(tierForm.unit_price);

    if (!productId) return setError("Choose a product.");
    if (!Number.isInteger(minQuantity) || minQuantity <= 0) {
      return setError("Minimum quantity must be a positive whole number.");
    }
    if (!Number.isInteger(unitPrice) || unitPrice < 0) {
      return setError("Unit price must be a whole number of 0 or more.");
    }

    try {
      const response = await fetch("/api/admin/tiers", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          price_list_id: activeListId,
          product_id: productId,
          min_quantity: minQuantity,
          unit_price: unitPrice,
        }),
      });

      if (!response.ok) throw new Error(await readError(response));

      setTierForm({ product_id: tierForm.product_id, min_quantity: "", unit_price: "" });
      setMessage("Tier added.");
      await loadTiers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add tier.");
    }
  }

  async function toggleTierActive(tier: Tier) {
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/admin/tiers/${tier.id}`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !tier.is_active }),
      });

      if (!response.ok) throw new Error(await readError(response));

      await loadTiers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update tier.");
    }
  }

  async function removeTier(tier: Tier) {
    if (!window.confirm(`Delete the ${tier.min_quantity}+ tier for ${productName(tier.product_id)}?`)) {
      return;
    }

    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/admin/tiers/${tier.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });

      if (!response.ok) throw new Error(await readError(response));

      setMessage("Tier removed.");
      await loadTiers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove tier.");
    }
  }

  async function runPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPreview(null);
    setError("");

    const params = new URLSearchParams({
      product_id: previewForm.product_id,
      quantity: previewForm.quantity,
    });

    if (previewForm.price_list_id) {
      params.set("price_list_id", previewForm.price_list_id);
    }

    const response = await fetch(`/api/admin/pricing-preview?${params.toString()}`, {
      headers: authHeaders(),
      cache: "no-store",
    });

    if (!response.ok) {
      setError(await readError(response));
      return;
    }

    const data = (await response.json()) as { pricing: Pricing };
    setPreview(data.pricing);
  }

  const activeList = priceLists.find((list) => list.id === activeListId) ?? null;

  return (
    <section className="mt-6 space-y-6">
      {(message || error) && (
        <div
          className={`rounded-xl p-4 text-sm font-semibold ${
            error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
          }`}
        >
          {error || message}
        </div>
      )}

      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-zinc-100">
        <div className="border-b px-5 py-4">
          <h2 className="font-bold">{a("Price Lists")}</h2>
          <p className="text-sm text-zinc-500">
             {a("Wholesale accounts are assigned to one price list; inactive lists fall back to retail pricing.")} </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 p-5">
          {priceLists.map((list) => (
            <div
              key={list.id}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm ${
                list.id === activeListId ? "border-red-500 bg-red-50" : ""
              }`}
            >
              <button
                onClick={() => setActiveListId(list.id)}
                className="font-semibold"
              >
                {a(list.name)}
              </button>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  list.is_active
                    ? "bg-green-100 text-green-700"
                    : "bg-zinc-200 text-zinc-600"
                }`}
              >
                {list.is_active ? a("active") : a("inactive")}
              </span>
              <button
                onClick={() => toggleListActive(list)}
                className="text-xs text-zinc-500 underline"
              >
                {list.is_active ? a("deactivate") : a("activate")}
              </button>
            </div>
          ))}

          <form onSubmit={createPriceList} className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <input
              value={newListName}
              onChange={(event) => setNewListName(event.target.value)}
              placeholder={a("New price list name")}
              className="rounded-full border px-4 py-2 text-sm outline-none focus:border-red-500"
            />
            <button
              type="submit"
              disabled={newListName.trim().length < 2}
              className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-zinc-400"
            >
               {a("Add")} </button>
          </form>
        </div>
      </div>

      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-zinc-100">
        <div className="border-b px-5 py-4">
          <h2 className="font-bold">
             {a("Quantity Tiers")}{activeList ? ` — ${activeList.name}` : ""}
          </h2>
          <p className="text-sm text-zinc-500">
             {a("The tier with the highest minimum quantity ≤ the ordered quantity applies. Below every tier the retail price is used.")} </p>
        </div>

        <form onSubmit={addTier} className="flex flex-wrap items-end gap-3 border-b p-5">
          <div>
            <label className="mb-1 block text-xs font-semibold">{a("Product")}</label>
            <select
              value={tierForm.product_id}
              onChange={(event) =>
                setTierForm({ ...tierForm, product_id: event.target.value })
              }
              className="rounded-xl border px-3 py-2 text-sm outline-none focus:border-red-500"
            >
              <option value="">{a("Choose product")}</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({formatCurrency(product.price)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold">{a("Min quantity")}</label>
            <input
              type="number"
              min={1}
              value={tierForm.min_quantity}
              onChange={(event) =>
                setTierForm({ ...tierForm, min_quantity: event.target.value })
              }
              className="w-28 rounded-xl border px-3 py-2 text-sm outline-none focus:border-red-500"
              placeholder="10"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold">{a("Unit price (MMK)")}</label>
            <input
              type="number"
              min={0}
              value={tierForm.unit_price}
              onChange={(event) =>
                setTierForm({ ...tierForm, unit_price: event.target.value })
              }
              className="w-32 rounded-xl border px-3 py-2 text-sm outline-none focus:border-red-500"
              placeholder="48000"
            />
          </div>

          <button
            type="submit"
            disabled={!activeListId}
            className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white disabled:bg-zinc-400"
          >
             {a("Add tier")} </button>
        </form>

        {tiers.length === 0 ? (
          <p className="p-5 text-sm text-zinc-500">
             {a("No tiers in this price list yet.")} </p>
        ) : (
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={a("Quantity pricing tiers")}>
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="p-4">{a("Product")}</th>
                  <th className="p-4">{a("Min quantity")}</th>
                  <th className="p-4">{a("Unit price")}</th>
                  <th className="p-4">{a("Status")}</th>
                  <th className="p-4">{a("Action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tiers.map((tier) => (
                  <tr key={tier.id}>
                    <td className="p-4 font-semibold">
                      {productName(tier.product_id)}
                    </td>
                    <td className="p-4">{tier.min_quantity}+</td>
                    <td className="p-4">{formatCurrency(tier.unit_price)}</td>
                    <td className="p-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          tier.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-zinc-200 text-zinc-600"
                        }`}
                      >
                        {tier.is_active ? a("active") : a("inactive")}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleTierActive(tier)}
                          className="rounded-full border px-3 py-1 text-xs font-semibold hover:bg-zinc-100"
                        >
                          {tier.is_active ? a("Deactivate") : a("Activate")}
                        </button>
                        <button
                          onClick={() => removeTier(tier)}
                          className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                        >
                           {a("Delete")} </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-zinc-100">
        <div className="border-b px-5 py-4">
          <h2 className="font-bold">{a("Price Preview")}</h2>
          <p className="text-sm text-zinc-500">
             {a("Check what a retail customer or a wholesale account on a given price list pays for a quantity.")} </p>
        </div>

        <form onSubmit={runPreview} className="flex flex-wrap items-end gap-3 p-5">
          <div>
            <label className="mb-1 block text-xs font-semibold">{a("Product")}</label>
            <select
              value={previewForm.product_id}
              onChange={(event) =>
                setPreviewForm({ ...previewForm, product_id: event.target.value })
              }
              className="rounded-xl border px-3 py-2 text-sm outline-none focus:border-red-500"
            >
              <option value="">{a("Choose product")}</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold">{a("Customer")}</label>
            <select
              value={previewForm.price_list_id}
              onChange={(event) =>
                setPreviewForm({
                  ...previewForm,
                  price_list_id: event.target.value,
                })
              }
              className="rounded-xl border px-3 py-2 text-sm outline-none focus:border-red-500"
            >
              <option value="">{a("Retail customer")}</option>
              {priceLists.map((list) => (
                <option key={list.id} value={list.id}>
                   {a("Wholesale —")} {a(list.name)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold">{a("Quantity")}</label>
            <input
              type="number"
              min={1}
              value={previewForm.quantity}
              onChange={(event) =>
                setPreviewForm({ ...previewForm, quantity: event.target.value })
              }
              className="w-28 rounded-xl border px-3 py-2 text-sm outline-none focus:border-red-500"
            />
          </div>

          <button
            type="submit"
            disabled={!previewForm.product_id}
            className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white disabled:bg-zinc-400"
          >
             {a("Preview")} </button>

          {preview && (
            <div className="rounded-2xl bg-zinc-50 px-5 py-3 text-sm">
              <p className="font-bold">
                {formatCurrency(preview.unitPrice)}{a("/unit ·")}{" "}
                {formatCurrency(preview.lineTotal)}  {a("total")} </p>
              <p className="text-xs text-zinc-500">
                {preview.label}
                {preview.savings > 0
                  ? ` · saves ${formatCurrency(preview.savings)} vs retail`
                  : ""}
              </p>
            </div>
          )}
        </form>
      </div>
    </section>
  );
}
