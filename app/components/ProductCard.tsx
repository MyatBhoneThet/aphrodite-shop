import Link from "next/link";
import type { Product, UserRole } from "../data/products";
import { getProductSpecifications } from "../lib/product-specifications";

type Props = {
  // The API only attaches `tiers` for approved wholesale viewers; prices
  // themselves are always calculated server-side.
  product: Product & { tiers?: { minQuantity: number; unitPrice: number }[] };
  userRole: UserRole;
};

export default function ProductCard({ product }: Props) {
  const displayPrice = product.price;
  const bestTier = product.tiers?.[0];
  const specification = getProductSpecifications(product);
  const summaryRows = specification.rows
    .filter(
      (row) =>
        !["Brand", "Category", "Availability", "Product details"].includes(
          row.label
        )
    )
    .slice(0, 3);

  return (
    <article className="rounded-[2rem] bg-zinc-100 p-5 text-center transition hover:-translate-y-1 hover:shadow-xl">
      <Link href={`/products/${product.id}`} className="block">
        <div className="relative h-64 overflow-hidden rounded-[1.5rem] bg-white">
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-contain p-6"
          />

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white px-4 py-2 text-xs font-semibold shadow">
            View Details
          </div>
        </div>
      </Link>

      <Link href={`/products/${product.id}`}>
        <h3 className="mt-6 text-xl font-bold hover:text-red-600">
          {product.name}
        </h3>
      </Link>

      <p className="text-sm text-zinc-500">
        {product.brand} • {product.category}
      </p>

      <p
        className={`mt-3 text-sm font-bold ${
          product.stock === "In Stock" ? "text-green-600" : "text-red-600"
        }`}
      >
        {product.stock}
      </p>

      <p className="mt-4 text-2xl font-bold">
        ฿{displayPrice.toLocaleString()}
      </p>

      {bestTier && (
        <p className="mt-1 text-xs font-semibold text-red-600">
          Wholesale from ฿{bestTier.unitPrice.toLocaleString()} ({bestTier.minQuantity}+ units)
        </p>
      )}

      {summaryRows.length > 0 ? (
        <dl className="mt-4 space-y-2 text-left text-sm">
          {summaryRows.map((row) => (
            <div key={row.label} className="rounded-xl bg-white p-3">
              <dt className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                {row.label}
              </dt>
              <dd className="mt-1 line-clamp-2 font-semibold">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-4 max-h-24 overflow-hidden rounded-xl bg-white p-3 text-sm">
          {String(product.specs.detail ?? "Product details are being prepared.")}
        </p>
      )}
    </article>
  );
}
