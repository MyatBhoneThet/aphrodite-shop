import type { Product, UserRole } from "../data/products";
import ProductCard from "./ProductCard";

type Props = {
  title: string;
  products: Product[];
  userRole: UserRole;
};

export default function ProductSection({ title, products, userRole }: Props) {
  return (
    <section className="mx-auto max-w-7xl px-5 pb-16">
      <h2 className="mb-8 text-center text-4xl font-bold">{title}</h2>

      {products.length === 0 ? (
        <p className="text-center text-zinc-500">No products found.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              userRole={userRole}
            />
          ))}
        </div>
      )}
    </section>
  );
}
