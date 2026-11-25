import { describe, expect, it } from "vitest";
import type { Product } from "../app/data/products";
import { availableProductGrades } from "../app/lib/product-grades";
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
  product(4, 12_000, {
    type: "accessory",
    sourceSheet: "PC Parts",
    category: "CPU",
    brand: "AMD",
  }),
];

describe("storefront product filters", () => {
  it("offers the workbook grades only for in-stock laptops and keeps their own prices", () => {
    const catalog = [
      product(1, 3_000_000, { fullSpecs: { condition: "Brand New" } }),
      product(2, 2_900_000, { fullSpecs: { condition: "Commercial - Brand New" } }),
      product(3, 2_750_000, { fullSpecs: { condition: "Brand New (Clearnace Sales)" } }),
      product(4, 2_250_000, { fullSpecs: { condition: "Brand New (Clearance Sales B)" } }),
      product(5, 2_100_000, { stock: "Out of Stock", fullSpecs: { condition: "Brand New (Clearance Sales B)" } }),
      product(6, 50_000, { type: "accessory", fullSpecs: { condition: "Brand New" } }),
      product(7, 1_900_000, { fullSpecs: { condition: "Used - Grade B" } }),
    ];

    expect(availableProductGrades(catalog)).toEqual(["brand-new", "commercial-new", "new-clearance", "clearance-b"]);
    expect(availableProductGrades(catalog.slice(4))).toEqual([]);
    expect(filterAndSortProducts(catalog, { ...EMPTY_PRODUCT_FILTERS, grade: "clearance-b" }))
      .toEqual([catalog[3]]);
  });

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

    expect(result.map((item) => item.price)).toEqual([
      2_890, 12_000, 33_500, 56_900,
    ]);
  });

  it("separates PC parts from accessories and filters exact categories", () => {
    const pcParts = filterAndSortProducts(products, {
      ...EMPTY_PRODUCT_FILTERS,
      type: "pc_part",
      category: "CPU",
    });

    expect(pcParts.map((item) => item.id)).toEqual([4]);
  });
});
