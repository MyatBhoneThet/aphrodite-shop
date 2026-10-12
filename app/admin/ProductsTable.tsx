"use client";

/* eslint-disable @next/next/no-img-element */

import type { Product } from "../data/products";
import { formatCurrency } from "../lib/format";
import { useLanguage } from "../lib/language";
import { useAdminText } from "../lib/useAdminText";

export default function ProductsTable({
  products,
  onEdit,
  onDelete,
}: {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete?: (product: Product) => void;
}) {
  const a = useAdminText();
  const { t } = useLanguage();

  if (products.length === 0) {
    return <p className="p-5 text-sm text-zinc-500">{a("No products found.")}</p>;
  }

  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={a("Products table")}>
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
          <tr>
            <th className="p-4">{t("adminTable.product")}</th>
            <th className="p-4">{t("adminTable.type")}</th>
            <th className="p-4">{t("adminTable.price")}</th>
            <th className="p-4">{t("adminTable.stock")}</th>
            <th className="p-4">{t("adminTable.action")}</th>
          </tr>
        </thead>

        <tbody className="divide-y">
          {products.map((product) => (
            <tr key={product.id} className="align-top">
              <td className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="h-14 w-14 rounded-xl object-contain ring-1 ring-zinc-200"
                  />

                  <div>
                    <p className="font-bold">{product.name}</p>
                    <p className="text-xs text-zinc-500">
                      {product.brand} • {a(product.category)}
                    </p>
                  </div>
                </div>
              </td>

              <td className="p-4 capitalize">{product.type}</td>

              <td className="p-4">
                <p className="font-bold">{product.price > 0 ? formatCurrency(product.price) : a("Price pending")}</p>
                {product.wholesalePrice && (
                  <p className="text-xs text-zinc-500">
                     {a("W/S")} {formatCurrency(product.wholesalePrice)}
                  </p>
                )}
              </td>

              <td className="p-4">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    product.stock === "In Stock"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {a(product.stock)}
                </span>
                {product.stockQuantity !== undefined && (
                  <p className="mt-1 text-xs text-zinc-500">
                    {product.stockQuantity}  {a("unit(s)")} </p>
                )}
              </td>

              <td className="p-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => onEdit(product)}
                    className="rounded-full border px-3 py-2 text-xs font-semibold hover:bg-zinc-100"
                  >
                     {a("Edit")} </button>

                  {onDelete && <button
                    onClick={() => onDelete(product)}
                    className="rounded-full bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                  >
                     {a("Delete")} </button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
