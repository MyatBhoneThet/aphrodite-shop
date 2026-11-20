"use client";

/* eslint-disable @next/next/no-img-element */

import type { Product } from "../data/products";
import { belongsToCatalogSection } from "../lib/catalog";
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
      <table className="w-full min-w-[850px] table-fixed text-left">
        <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
          <tr>
            <th scope="col" className="p-4 sm:pl-6">{t("adminTable.product")}</th>
            <th scope="col" className="w-28 p-4">{t("adminTable.type")}</th>
            <th scope="col" className="w-40 p-4">{t("adminTable.price")}</th>
            <th scope="col" className="w-32 p-4">{t("adminTable.stock")}</th>
            <th scope="col" className={`p-4 ${onDelete ? "w-44" : "w-24"}`}>{t("adminTable.action")}</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-zinc-200">
          {products.map((product) => (
            <tr key={product.id} className="hover:bg-zinc-50/60">
              <td className="p-4 sm:pl-6">
                <div className="flex items-center gap-3">
                  <img
                    src={product.image}
                    alt=""
                    loading="lazy"
                    className="h-16 w-16 shrink-0 rounded-xl bg-white object-contain ring-1 ring-zinc-200"
                  />

                  <div className="min-w-0 wrap-anywhere">
                    <p className="font-semibold leading-snug">{product.name}</p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {product.brand} • {a(product.category)}
                    </p>
                  </div>
                </div>
              </td>

              <td className="p-4 text-sm font-medium">
                {a(belongsToCatalogSection(product, "PC Parts") ? "PC Part" : belongsToCatalogSection(product, "Laptops") ? "Laptop" : "Accessory")}
              </td>

              <td className="whitespace-nowrap p-4 text-sm">
                <p className="font-bold">{product.price > 0 ? formatCurrency(product.price) : a("Price pending")}</p>
                {product.wholesalePrice && (
                  <p className="text-xs text-zinc-500">
                     {a("W/S")} {formatCurrency(product.wholesalePrice)}
                  </p>
                )}
              </td>

              <td className="p-4">
                <span
                  className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${
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
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold hover:bg-zinc-100"
                  >
                     {a("Edit")} </button>

                  {onDelete && <button
                    onClick={() => onDelete(product)}
                    className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
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
