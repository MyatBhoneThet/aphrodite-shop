"use client";

import Link from "next/link";
import { useState } from "react";
import { formatCurrency } from "../lib/format";

export type OrderLine = {
  id: string;
  product_id: number;
  quantity: number;
  unit_price: number;
  product?: {
    name: string;
    image?: string;
    brand?: string;
    category?: string;
    specs?: Record<string, unknown>;
    fullSpecs?: Record<string, unknown>;
  } | null;
};

const VISIBLE_LINES = 4;

const ACRONYMS = new Set(["cpu", "gpu", "ram", "ssd", "os"]);
const label = (key: string) => {
  const text = key.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ").trim().toLowerCase();
  return ACRONYMS.has(text) ? text.toUpperCase() : text.replace(/^./, (c) => c.toUpperCase());
};

/** Short grey line under the name: the spec text, e.g. "16GB · 512GB · i7". */
function summary(product: OrderLine["product"]) {
  const specs = product?.specs ?? {};
  const parts = [specs.cpu, specs.ram, specs.storage, specs.detail]
    .filter((value): value is string => typeof value === "string" && value.trim() !== "");
  return parts.join(" · ");
}

function detailRows(product: OrderLine["product"]) {
  const merged: Record<string, unknown> = { ...(product?.specs ?? {}), ...(product?.fullSpecs ?? {}) };
  return Object.entries(merged)
    .filter(([, value]) => typeof value === "string" && value.trim() !== "")
    .slice(0, 16) as [string, string][];
}

export default function OrderItemsList({ items }: { items: OrderLine[] }) {
  const [showAll, setShowAll] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const visible = showAll ? items : items.slice(0, VISIBLE_LINES);

  return (
    <div>
      <ul className="divide-y divide-zinc-100">
        {visible.map((item) => {
          const product = item.product;
          const name = product?.name ?? `Product #${item.product_id}`;
          const open = openId === item.id;
          const extra = summary(product);
          return (
            <li key={item.id} className="py-4 first:pt-0">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : item.id)}
                className="grid w-full grid-cols-[64px_1fr] items-start gap-4 text-left sm:grid-cols-[80px_1fr_auto_auto] sm:gap-6"
              >
                {product?.image ? (
                  <img src={product.image} alt="" loading="lazy" className="h-16 w-16 rounded-xl bg-white object-contain sm:h-20 sm:w-20" />
                ) : (
                  <span className="h-16 w-16 rounded-xl bg-zinc-100 sm:h-20 sm:w-20" />
                )}
                <span className="min-w-0">
                  <span className="line-clamp-2 text-base font-medium text-zinc-900">{name}</span>
                  {extra && <span className="mt-1 block truncate text-sm text-zinc-400">{extra}</span>}
                  <span className="mt-1 block text-sm text-zinc-500 sm:hidden">
                    {formatCurrency(item.unit_price)} · Qty: {item.quantity}
                  </span>
                </span>
                <span className="hidden text-base font-medium text-zinc-900 sm:block">{formatCurrency(item.unit_price)}</span>
                <span className="hidden text-base sm:block"><span className="text-zinc-400">Qty:</span> {item.quantity}</span>
              </button>

              {open && (
                <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                  <div className="flex flex-col gap-5 sm:flex-row">
                    {product?.image && (
                      <img src={product.image} alt={name} className="h-40 w-40 shrink-0 rounded-xl bg-white object-contain" />
                    )}
                    <div className="min-w-0 flex-1">
                      <h4 className="text-lg font-bold text-zinc-900">{name}</h4>
                      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                        {product?.brand && <div><dt className="text-xs uppercase text-zinc-400">Brand</dt><dd className="font-semibold">{product.brand}</dd></div>}
                        {product?.category && <div><dt className="text-xs uppercase text-zinc-400">Category</dt><dd className="font-semibold">{product.category}</dd></div>}
                        <div><dt className="text-xs uppercase text-zinc-400">Unit price</dt><dd className="font-semibold">{formatCurrency(item.unit_price)}</dd></div>
                        <div><dt className="text-xs uppercase text-zinc-400">Quantity</dt><dd className="font-semibold">{item.quantity}</dd></div>
                        <div><dt className="text-xs uppercase text-zinc-400">Line total</dt><dd className="font-bold text-red-600">{formatCurrency(item.unit_price * item.quantity)}</dd></div>
                      </dl>
                      {detailRows(product).length > 0 && (
                        <dl className="mt-4 grid gap-x-6 gap-y-2 border-t border-zinc-200 pt-4 text-sm lg:grid-cols-2">
                          {detailRows(product).map(([key, value]) => (
                            <div key={key} className="flex gap-2"><dt className="w-24 shrink-0 text-zinc-400 sm:w-32">{label(key)}</dt><dd className="min-w-0 flex-1 break-words text-zinc-800">{value}</dd></div>
                          ))}
                        </dl>
                      )}
                      <Link href={`/products/${item.product_id}`} className="mt-4 inline-block text-sm font-semibold text-red-600 hover:underline">View product →</Link>
                    </div>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {items.length > VISIBLE_LINES && (
        <button type="button" onClick={() => setShowAll((value) => !value)} className="mt-2 rounded-full border px-4 py-2 text-sm font-semibold hover:border-red-500 hover:text-red-600">
          {showAll ? "See less" : `See more (${items.length - VISIBLE_LINES})`}
        </button>
      )}
    </div>
  );
}
