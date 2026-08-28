import { describe, expect, it } from "vitest";
import type { Product } from "../app/data/products";
import {
  EMPTY_PRODUCT_FILTERS,
  filterAndSortProducts,
} from "../app/lib/product-filters";

function product(
  id: number,
  price: number,
  overrides: Partial<Product> = {}
): Product {
  return {
    id,
    name: `Product ${id}`,
    type: "laptop",
    category: "Laptop",
    brand: "Apple",
    price,
    image: "/product.png",
    stock: "In Stock",
    specs: {},
    fullSpecs: {},
    ...overrides,
  };
}

const products = [
  product(1, 56_900),
  product(2, 33_500, { brand: "Acer", name: "Acer Swift" }),
  product(3, 2_890, {
    type: "accessory",
    category: "Accessories",
    brand: "Keychron",
    stock: "Out of Stock",
  }),
];

describe("storefront product filters", () => {
  it("combines price, type, brand, and stock filters", () => {
    const result = filterAndSortProducts(products, {
      ...EMPTY_PRODUCT_FILTERS,
      minPrice: "30000",
      maxPrice: "40000",
      type: "laptop",
      brand: "Acer",
      stock: "In Stock",
    });

    expect(result.map((item) => item.id)).toEqual([2]);
  });

  it("sorts the filtered catalogue by price", () => {
    const result = filterAndSortProducts(products, {
      ...EMPTY_PRODUCT_FILTERS,
      sort: "price-asc",
    });

    expect(result.map((item) => item.price)).toEqual([2_890, 33_500, 56_900]);
  });
});
