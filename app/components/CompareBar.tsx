import type { Product } from "../data/products";

type Props = {
  compareIds: number[];
  products: Product[];
  onRemove: (id: number) => void;
  language: "en" | "my";
};

export default function CompareBar({
  compareIds,
  products,
  onRemove,
  language,
}: Props) {
  if (compareIds.length === 0) return null;

  const compareProducts = products.filter((product) =>
    compareIds.includes(product.id)
  );

  return (
    <section className="mx-auto max-w-7xl px-5 pb-20">
      <h2 className="mb-5 text-3xl font-bold">
        {language === "en" ? "Compare Products" : "ပစ္စည်းနှိုင်းယှဉ်ရန်"}
      </h2>

      <div className="grid gap-5 md:grid-cols-3">
        {compareProducts.map((product) => (
          <div key={product.id} className="rounded-[2rem] border p-6">
            <div className="flex items-start justify-between gap-4">
              <h3 className="font-bold">{product.name}</h3>

              <button
                onClick={() => onRemove(product.id)}
                className="text-red-600"
              >
                Remove
              </button>
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <p>Brand: {product.brand}</p>
              <p>Category: {product.category}</p>

              {product.type === "laptop" ? (
                <>
                  <p>CPU: {product.specs.cpu}</p>
                  <p>RAM: {product.specs.ram}</p>
                  <p>Storage: {product.specs.storage}</p>
                  <p>Display: {product.specs.display}</p>
                </>
              ) : (
                <p>Detail: {product.specs.detail}</p>
              )}

              <p>Stock: {product.stock}</p>
              <p>Price: ฿{product.price.toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>

      {compareIds.length >= 3 && (
        <p className="mt-4 text-sm text-red-600">
          You can compare maximum 3 products.
        </p>
      )}
    </section>
  );
}
