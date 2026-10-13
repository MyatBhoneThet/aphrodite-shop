"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState } from "react";
import { authHeaders } from "../lib/client-auth";
import { formatCurrency, formatDateTime } from "../lib/format";
import { useAdminText } from "../lib/useAdminText";
import { confirmAction } from "./confirm";
import { fetchWithReauth } from "./reauth";

type DeletedProduct = {
  id: number;
  name: string;
  brand: string;
  category: string;
  image: string | null;
  price: number;
  source_sheet: string | null;
  stock_quantity: number;
  deleted_at: string;
  days_left: number;
};

async function errorOf(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? fallback;
}

/**
 * Products an admin deleted. They stay here for 30 days and can be restored
 * with the stock they had; after that the scheduled sync erases them.
 */
export default function RecentlyDeletedProducts({
  refreshKey,
  onChanged,
}: {
  /** Changes whenever the product list changes, so this list reloads after a delete. */
  refreshKey: number;
  onChanged: () => void | Promise<void>;
}) {
  const a = useAdminText();
  const [items, setItems] = useState<DeletedProduct[]>([]);
  const [keepDays, setKeepDays] = useState(30);
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/deleted-products", { headers: authHeaders(), cache: "no-store" });
      if (!response.ok) throw new Error(await errorOf(response, "Could not load deleted products."));
      const data = (await response.json()) as { products: DeletedProduct[]; keepDays: number };
      setItems(data.products ?? []);
      setKeepDays(data.keepDays ?? 30);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load deleted products.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load, refreshKey]);

  async function restore(item: DeletedProduct) {
    setBusy(item.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/deleted-products/${item.id}`, { method: "POST", headers: authHeaders() });
      if (!response.ok) throw new Error(await errorOf(response, "Could not restore the product."));
      setMessage(`Restored “${item.name}”. It is back on the shop.`);
      await load();
      await onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not restore the product.");
    } finally {
      setBusy(null);
    }
  }

  async function erase(item: DeletedProduct) {
    const confirmed = await confirmAction({
      title: "Delete this product forever?",
      subject: item.name,
      message: "It is erased now instead of waiting for the 30 days.",
      consequences: [
        ...(item.source_sheet ? [`Its row is also deleted from the "${item.source_sheet}" tab of the Google Sheet.`] : []),
        "A product that already has orders stays hidden, so the order history still reads correctly.",
        "This cannot be undone.",
      ],
      confirmLabel: "Delete forever",
      requireText: "ERASE",
    });
    if (!confirmed) return;

    setBusy(item.id);
    setError("");
    setMessage("");
    try {
      const response = await fetchWithReauth(`/api/admin/deleted-products/${item.id}`, {
        method: "DELETE",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "ERASE" }),
      });
      if (!response.ok) throw new Error(await errorOf(response, "Could not delete the product."));
      setMessage(`Erased “${item.name}”.`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete the product.");
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0 && !error && !message) return null;

  return (
    <details className="mt-6 rounded-2xl bg-white shadow-sm ring-1 ring-zinc-100" open={items.length > 0 && items.length <= 5}>
      <summary className="cursor-pointer select-none px-5 py-4 font-bold">
        {a("Recently deleted")} ({items.length})
        <span className="ml-2 text-sm font-normal text-zinc-500">
          {a("Kept for")} {keepDays} {a("days, then erased for good.")}
        </span>
      </summary>
      <div className="border-t px-5 py-4">
        {error && <p role="alert" className="mb-3 text-sm font-semibold text-red-600">{error}</p>}
        {message && <p role="status" className="mb-3 text-sm font-semibold text-green-700">{message}</p>}
        <ul className="divide-y">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-3 py-3">
              {item.image ? (
                <img src={item.image} alt="" className="h-12 w-12 shrink-0 rounded-lg bg-zinc-100 object-contain" />
              ) : (
                <span className="h-12 w-12 shrink-0 rounded-lg bg-zinc-100" aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{item.name}</p>
                <p className="text-xs text-zinc-500">
                  {item.brand} · {item.category} · {formatCurrency(item.price)} · {a("Stock when deleted:")} {item.stock_quantity}
                </p>
                <p className="text-xs text-zinc-500">
                  {a("Deleted")} {formatDateTime(item.deleted_at)} ·{" "}
                  <span className={item.days_left <= 3 ? "font-bold text-red-600" : ""}>
                    {item.days_left} {a("day(s) left to restore")}
                  </span>
                </p>
              </div>
              <button
                type="button"
                disabled={busy === item.id}
                onClick={() => void restore(item)}
                className="rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {a("Restore")}
              </button>
              <button
                type="button"
                disabled={busy === item.id}
                onClick={() => void erase(item)}
                className="rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
              >
                {a("Delete forever")}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
