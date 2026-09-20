"use client";

import { useLanguage } from "../lib/language";
import { useState } from "react";
import type { Product } from "../data/products";
import { authHeaders } from "../lib/client-auth";
import {
  suggestedAlertKinds,
  type AlertKind,
  type AlertStatus,
} from "../lib/product-alerts";

export type FollowedAlert = {
  id: string;
  product_id: number;
  kind: AlertKind;
  status: AlertStatus;
};

const KIND_LABELS: Record<AlertKind, { follow: string; following: string; icon: string }> = {
  back_in_stock: {
    follow: "Notify me when back in stock",
    following: "Watching stock",
    icon: "🔔",
  },
  price_drop: {
    follow: "Notify me if the price drops",
    following: "Watching price",
    icon: "📉",
  },
};

/**
 * Follow / unfollow buttons for one product, plus the good-news banner.
 *
 * The parent owns the alert list so a page can show many products without
 * each button fetching its own copy.
 */
export default function ProductAlertButtons({
  product,
  alerts,
  onChange,
  compact = false,
}: {
  product: Product;
  alerts: FollowedAlert[];
  onChange: (alerts: FollowedAlert[]) => void;
  compact?: boolean;
}) {
  const { text } = useLanguage();
  const [busy, setBusy] = useState<AlertKind | null>(null);
  const [error, setError] = useState("");

  const mine = alerts.filter((alert) => alert.product_id === product.id);
  const kinds = suggestedAlertKinds(product);

  async function follow(kind: AlertKind) {
    setBusy(kind);
    setError("");

    try {
      const response = await fetch("/api/alerts", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: product.id, kind }),
      });
      const data = (await response.json().catch(() => null)) as
        | { alerts?: FollowedAlert[]; error?: string }
        | null;

      if (!response.ok || !data?.alerts) {
        throw new Error(data?.error ?? "Unable to set up the alert.");
      }

      onChange(data.alerts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to set up the alert.");
    } finally {
      setBusy(null);
    }
  }

  async function unfollow(id: string, kind: AlertKind) {
    setBusy(kind);
    setError("");

    try {
      const response = await fetch(`/api/alerts/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = (await response.json().catch(() => null)) as
        | { alerts?: FollowedAlert[]; error?: string }
        | null;

      if (!response.ok || !data?.alerts) {
        throw new Error(data?.error ?? "Unable to remove the alert.");
      }

      onChange(data.alerts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove the alert.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={compact ? "" : "mt-4"}>
      {mine
        .filter((alert) => alert.status.triggered)
        .map((alert) => (
          <p
            key={`news-${alert.id}`}
            className="mb-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-xs font-bold text-emerald-800"
          >
            🎉 {alert.status.headline}
            <span className="mt-0.5 block font-medium text-emerald-700">
              {alert.status.detail}
            </span>
          </p>
        ))}

      <div className={`flex flex-wrap gap-2 ${compact ? "justify-center" : ""}`}>
        {kinds.map((kind) => {
          const existing = mine.find((alert) => alert.kind === kind);
          const labels = KIND_LABELS[kind];

          return existing ? (
            <button
              key={kind}
              type="button"
              onClick={() => unfollow(existing.id, kind)}
              disabled={busy === kind}
              title={existing.status.detail}
              className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 transition hover:border-red-400 disabled:opacity-50"
            >
              {labels.icon} {busy === kind ? text("Removing...") : text(labels.following)} ✕
            </button>
          ) : (
            <button
              key={kind}
              type="button"
              onClick={() => follow(kind)}
              disabled={busy === kind}
              className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-bold text-zinc-700 transition hover:border-zinc-950 disabled:opacity-50"
            >
              {labels.icon}{" "}
              {busy === kind
                ? text("Saving...")
                : compact
                  ? text(labels.following)
                  : text(labels.follow)}
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs font-semibold text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
