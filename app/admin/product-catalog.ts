import type { Product } from "../data/products";
import { authHeaders } from "../lib/client-auth";
import { getErrorMessage } from "./product-form";

const CATALOG_BATCH_SIZE = 100;

export async function loadProductCatalog(signal: AbortSignal): Promise<Product[]> {
  const products = new Map<number, Product>();
  const headers = authHeaders();

  for (let offset = 0; ; offset += CATALOG_BATCH_SIZE) {
    const response = await fetch(`/api/products?limit=${CATALOG_BATCH_SIZE}&offset=${offset}`, {
      headers,
      cache: "no-store",
      signal,
    });

    if (!response.ok) throw new Error(await getErrorMessage(response));

    const { products: batch } = (await response.json()) as { products: Product[] };
    for (const product of batch) products.set(product.id, product);
    if (batch.length < CATALOG_BATCH_SIZE) return [...products.values()];
  }
}
