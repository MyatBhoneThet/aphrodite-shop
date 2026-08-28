import type { Product } from "../data/products";

export type ProductFilterState = {
  minPrice: string;
  maxPrice: string;
  type: "all" | "laptop" | "accessory";
  stock: "all" | Product["stock"];
  brand: string;
  sort: "recommended" | "price-asc" | "price-desc" | "name";
};

export const EMPTY_PRODUCT_FILTERS: ProductFilterState = {
  minPrice: "",
  maxPrice: "",
  type: "all",
  stock: "all",
  brand: "all",
  sort: "recommended",
};

export function countActiveProductFilters(filters: ProductFilterState) {
  return [
    filters.minPrice,
    filters.maxPrice,
    filters.type !== "all",
    filters.stock !== "all",
    filters.brand !== "all",
    filters.sort !== "recommended",
  ].filter(Boolean).length;
}

export function filterAndSortProducts(
  products: Product[],
  filters: ProductFilterState
) {
  const minimum =
    filters.minPrice.trim() === "" ? null : Number(filters.minPrice);
  const maximum =
    filters.maxPrice.trim() === "" ? null : Number(filters.maxPrice);

  return products
    .filter((product) => {
      if (
        Number.isFinite(minimum) &&
        minimum !== null &&
        product.price < minimum
      ) {
        return false;
      }

      if (
        Number.isFinite(maximum) &&
        maximum !== null &&
        product.price > maximum
      ) {
        return false;
      }

      if (filters.type !== "all" && product.type !== filters.type) {
        return false;
      }

      if (filters.stock !== "all" && product.stock !== filters.stock) {
        return false;
      }

      if (filters.brand !== "all" && product.brand !== filters.brand) {
        return false;
      }

      return true;
    })
    .sort((left, right) => {
      if (filters.sort === "price-asc") return left.price - right.price;
      if (filters.sort === "price-desc") return right.price - left.price;
      if (filters.sort === "name") return left.name.localeCompare(right.name);
      return 0;
    });
}
