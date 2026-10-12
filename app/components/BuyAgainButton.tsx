"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authHeaders } from "../lib/client-auth";
import { useLanguage } from "../lib/language";

type Result = {
  added: { product_id: number; name: string; quantity: number; requested: number }[];
  skipped: { product_id: number; name: string; reason: "out_of_stock" | "price_pending" | "unavailable" | "in_cart" }[];
};

const REASONS: Record<Result["skipped"][number]["reason"], string> = {
  out_of_stock: "out of stock",
  price_pending: "price not set yet",
  unavailable: "no longer available",
  in_cart: "all we have is already in your cart",
};

/**
 * "Buy again" on a delivered order. The server re-checks price and stock for
 * every line, so what this shows is exactly what landed in the cart.
 */
export default function BuyAgainButton({ orderId }: { orderId: string }) {
  const { text } = useLanguage();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  async function buyAgain() {
    if (busy) return;
    setBusy(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(`/api/orders/${orderId}/reorder`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = (await response.json().catch(() => null)) as (Result & { error?: string }) | null;

      if (!response.ok || !data) {
        throw new Error(data?.error ?? "Unable to add these items to your cart.");
      }

      // Everything went in: straight to the cart. Otherwise say what did not.
      if (data.skipped.length === 0 && data.added.length > 0) {
        router.push("/cart");
        return;
      }
      setResult(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to add these items to your cart.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={() => void buyAgain()}
        disabled={busy}
        className="inline-flex min-h-10 items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-60"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" />
          <path d="M3 21v-5h5" />
        </svg>
        {busy ? text("Adding…") : text("Buy again")}
      </button>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </p>
      )}

      {result && (
        <div role="status" className="max-w-sm rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {result.added.length > 0 && (
            <p className="font-semibold">
              {text("Added to your cart:")} {result.added.map((line) => `${line.name} × ${line.quantity}`).join(", ")}
            </p>
          )}
          {result.skipped.length > 0 && (
            <>
              <p className="mt-1 font-semibold">{text("Could not add:")}</p>
              <ul className="list-disc pl-4">
                {result.skipped.map((line) => (
                  <li key={line.product_id}>
                    {line.name} — {text(REASONS[line.reason])}
                  </li>
                ))}
              </ul>
            </>
          )}
          {result.added.length > 0 && (
            <Link href="/cart" className="mt-2 inline-block font-bold text-red-600 underline">
              {text("View cart")}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
