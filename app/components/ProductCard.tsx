import Link from "next/link";
import type { Product, UserRole } from "../data/products";
import Product3DViewer from "./Product3DViewer";

type Props = {
  // The API only attaches `tiers` for approved wholesale viewers; prices
  // themselves are always calculated server-side.
  product: Product & { tiers?: { minQuantity: number; unitPrice: number }[] };
  userRole: UserRole;
};

export default function ProductCard({ product }: Props) {
  const displayPrice = product.price;
  const bestTier = product.tiers?.[0];

  return (
    <article className="rounded-[2rem] bg-zinc-100 p-5 text-center transition hover:-translate-y-1 hover:shadow-xl">
      <Link href={`/products/${product.id}`} className="block">
        <div className="relative h-64 overflow-hidden rounded-[1.5rem] bg-white">
          <Product3DViewer
            modelUrl={product.model3D}
            imageUrl={product.image}
            productName={product.name}
            interactive={false}
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

      {product.type === "laptop" ? (
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-white p-2">{product.specs.cpu}</div>
          <div className="rounded-xl bg-white p-2">{product.specs.ram}</div>
          <div className="rounded-xl bg-white p-2">
            {product.specs.storage}
          </div>
          <div className="rounded-xl bg-white p-2">
            {product.specs.display}
          </div>
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-white p-3 text-sm">
          {product.specs.detail}
        </p>
      )}
    </article>
  );
}
