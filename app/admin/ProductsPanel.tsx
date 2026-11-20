"use client";

import type { Dispatch, FormEvent, SetStateAction } from "react";
import { useEffect, useState } from "react";
import type { Product } from "../data/products";
import { belongsToCatalogSection } from "../lib/catalog";
import { useAdminText } from "../lib/useAdminText";
import ProductCatalogList from "./ProductCatalogList";
import ProductPhotoUploader from "./ProductPhotoUploader";
import RecentlyDeletedProducts from "./RecentlyDeletedProducts";
import { loadProductCatalog } from "./product-catalog";
import { categoriesForSheet, emptyProductForm, productToForm, switchSheetTab } from "./product-form";
import type { ProductFormState } from "./types";

const VIEWS = ["All Products", "Laptops", "Accessories", "PC Parts"] as const;

type Props = {
  catalogVersion: number;
  productForm: ProductFormState;
  setProductForm: Dispatch<SetStateAction<ProductFormState>>;
  isProductFormOpen: boolean;
  setIsProductFormOpen: (open: boolean) => void;
  isSavingProduct: boolean;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: (product: Product) => void;
  search: string;
  setSearch: (value: string) => void;
  isAdmin: boolean;
  isStaff: boolean;
  /** Reloads the product list after a deleted product is restored. */
  onProductsChanged?: () => void | Promise<void>;
};

/** The product list with its add / edit form. */
export default function ProductsPanel({
  catalogVersion,
  productForm,
  setProductForm,
  isProductFormOpen,
  setIsProductFormOpen,
  isSavingProduct,
  onSave: handleSaveProduct,
  onDelete: handleDeleteProduct,
  search,
  setSearch,
  isAdmin,
  isStaff,
  onProductsChanged,
}: Props) {
  const a = useAdminText();
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [view, setView] = useState<(typeof VIEWS)[number]>("All Products");
  const [pageSize, setPageSize] = useState(25);
  const [catalog, setCatalog] = useState<{ version: number; products: Product[] | null; error: string } | null>(null);
  const isLoading = catalog?.version !== catalogVersion;
  const allProducts = catalog?.products ?? [];
  const keyword = search.trim().toLowerCase();
  const matches = keyword ? allProducts.filter(product =>
    `${product.name} ${product.brand} ${product.category} ${product.stock}`.toLowerCase().includes(keyword)
  ) : allProducts;
  const productsForView = (section: (typeof VIEWS)[number]) => section === "All Products"
    ? matches
    : matches.filter(product => belongsToCatalogSection(product, section));

  useEffect(() => {
    const controller = new AbortController();
    void loadProductCatalog(controller.signal).then(products => {
      if (!controller.signal.aborted) setCatalog({ version: catalogVersion, products, error: "" });
    }).catch(error => {
      if (!controller.signal.aborted) setCatalog(previous => ({
        version: catalogVersion,
        products: previous?.products ?? null,
        error: error instanceof Error ? error.message : "Could not load products.",
      }));
    });
    return () => controller.abort();
  }, [catalogVersion]);

  const categoryOptions = categoriesForSheet(allProducts, productForm.sourceSheet);
  // A category typed by hand, or one the list does not know yet, uses the text box.
  const typesCategory =
    productForm.sourceSheet !== "Laptops" &&
    (isNewCategory ||
      (productForm.category !== "" && !categoryOptions.includes(productForm.category)));

  return (
    <>
      <section className="grid min-w-0 gap-6">
        {isProductFormOpen && (
        <div className="w-full max-w-3xl rounded-2xl bg-white shadow-sm ring-1 ring-zinc-100">
          <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
            <div>
              <h2 className="font-bold">
                {productForm.id ? a("Edit Product") : a("Add Product")}
              </h2>
              <p className="text-sm text-zinc-500">
                 {a("Add laptops, accessories, price and stock.")} </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsProductFormOpen(false);
                setProductForm(emptyProductForm());
              }}
              aria-label={a("Close form")}
              className="rounded-full px-2 text-xl leading-none text-zinc-400 hover:text-zinc-700"
            >
               {a("&times;")} </button>
          </div>

          {isStaff ? (
          <form onSubmit={handleSaveProduct} className="space-y-4 p-5">
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{a("Staff can change the stock quantity only. Ask an administrator to change prices or product details.")}</p>
            <div>
              <p className="text-xs font-semibold uppercase text-zinc-500">{a("Product")}</p>
              <p className="break-words font-semibold">{productForm.name}</p>
              <p className="text-sm text-zinc-500">{productForm.brand}</p>
            </div>
            <div>
              <label htmlFor="staff-stock-quantity" className="mb-1 block text-sm font-semibold">{a("Stock Quantity")}</label>
              <input
                id="staff-stock-quantity"
                type="number"
                min={0}
                value={productForm.stockQuantity}
                onChange={(event) => setProductForm({ ...productForm, stockQuantity: event.target.value })}
                className="w-full rounded-xl border px-4 py-3 outline-none focus:border-red-500"
              />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={isSavingProduct} className="flex-1 rounded-full bg-red-600 px-5 py-3 font-semibold text-white disabled:bg-zinc-400">
                {isSavingProduct ? a("Saving...") : a("Save stock")}
              </button>
              <button type="button" onClick={() => { setIsProductFormOpen(false); setProductForm(emptyProductForm()); }} className="rounded-full border px-5 py-3 font-semibold">{a("Cancel")}</button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSaveProduct} className="space-y-4 p-5">
            <div>
              <label className="mb-1 block text-sm font-semibold">
                 {a("Product Name")} </label>
              <input
                value={productForm.name}
                onChange={(event) =>
                  setProductForm({
                    ...productForm,
                    name: event.target.value,
                  })
                }
                className="w-full rounded-xl border px-4 py-3 outline-none focus:border-red-500"
                placeholder={a("ASUS Vivobook 15")}
              />
            </div>

            {!productForm.id && (
              <div>
                <label className="mb-1 block text-sm font-semibold">
                   {a("Google Sheet tab")} </label>
                <select
                  value={productForm.sourceSheet}
                  onChange={(event) => {
                    setIsNewCategory(false);
                    setProductForm(
                      switchSheetTab(productForm, event.target.value as ProductFormState["sourceSheet"])
                    );
                  }}
                  className="w-full rounded-xl border px-4 py-3 outline-none focus:border-red-500"
                >
                  <option value="Laptops">{a("Laptops")}</option>
                  <option value="Accessories">{a("Accessories")}</option>
                  <option value="PC Parts">{a("PC Parts")}</option>
                </select>
                <p className="mt-1 text-xs text-zinc-500">
                   {a("The product is added as a new row in this tab, then shown on the website.")} </p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold">
                   {a("Type")} </label>
                <select
                  value={productForm.sourceSheet}
                  onChange={(event) => {
                    const sourceSheet = event.target.value as ProductFormState["sourceSheet"];
                    setIsNewCategory(false);
                    setProductForm(
                      productForm.id
                        ? {
                            ...productForm,
                            sourceSheet,
                            type: sourceSheet === "Laptops" ? "laptop" : "accessory",
                          }
                        : switchSheetTab(productForm, sourceSheet)
                    );
                  }}
                  className="w-full rounded-xl border px-4 py-3 outline-none focus:border-red-500"
                >
                  <option value="Laptops">{a("Laptop")}</option>
                  <option value="Accessories">{a("Accessory")}</option>
                  <option value="PC Parts">{a("PC Part")}</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold">
                   {a("Stock")} </label>
                <select
                  value={productForm.stock}
                  onChange={(event) =>
                    setProductForm({
                      ...productForm,
                      stock: event.target.value as Product["stock"],
                    })
                  }
                  className="w-full rounded-xl border px-4 py-3 outline-none focus:border-red-500"
                >
                  <option value="In Stock">{a("In Stock")}</option>
                  <option value="Out of Stock">{a("Out of Stock")}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold">
                   {a("Brand")} </label>
                <input
                  value={productForm.brand}
                  onChange={(event) =>
                    setProductForm({
                      ...productForm,
                      brand: event.target.value,
                    })
                  }
                  className="w-full rounded-xl border px-4 py-3 outline-none focus:border-red-500"
                  placeholder={a("Lenovo")}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold">
                   {a("Category")} </label>
                <select
                  value={typesCategory ? "__new__" : productForm.category}
                  disabled={productForm.sourceSheet === "Laptops"}
                  onChange={(event) => {
                    const isNew = event.target.value === "__new__";
                    setIsNewCategory(isNew);
                    setProductForm({
                      ...productForm,
                      category: isNew ? "" : event.target.value,
                    });
                  }}
                  className="w-full rounded-xl border px-4 py-3 outline-none focus:border-red-500 disabled:bg-zinc-100"
                >
                  {productForm.sourceSheet !== "Laptops" && (
                    <option value="">{a("Choose a category")}</option>
                  )}
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                  {productForm.sourceSheet !== "Laptops" && (
                    <option value="__new__">{a("+ New category…")}</option>
                  )}
                </select>
                {typesCategory && (
                  <input
                    value={productForm.category}
                    onChange={(event) =>
                      setProductForm({
                        ...productForm,
                        category: event.target.value,
                      })
                    }
                    className="mt-2 w-full rounded-xl border px-4 py-3 outline-none focus:border-red-500"
                    placeholder={a("New category name")}
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold">
                   {a("Retail Price")} </label>
                <input
                  type="number"
                  value={productForm.price}
                  onChange={(event) =>
                    setProductForm({
                      ...productForm,
                      price: event.target.value,
                    })
                  }
                  className="w-full rounded-xl border px-4 py-3 outline-none focus:border-red-500"
                  placeholder="25000"
                />
              </div>

              {isAdmin && <div>
                <label className="mb-1 block text-sm font-semibold">
                   {a("Wholesale Price (legacy)")} </label>
                <input
                  type="number"
                  value={productForm.wholesalePrice}
                  onChange={(event) =>
                    setProductForm({
                      ...productForm,
                      wholesalePrice: event.target.value,
                    })
                  }
                  className="w-full rounded-xl border px-4 py-3 outline-none focus:border-red-500"
                  placeholder="23000"
                />
                <p className="mt-1 text-xs text-zinc-400">
                   {a("Not used for pricing — manage quantity tiers in “Price Lists &amp; Tiers”.")} </p>
              </div>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold">
                 {a("Stock Quantity")} </label>
              <input
                type="number"
                min={0}
                value={productForm.stockQuantity}
                onChange={(event) =>
                  setProductForm({
                    ...productForm,
                    stockQuantity: event.target.value,
                  })
                }
                className="w-full rounded-xl border px-4 py-3 outline-none focus:border-red-500"
                placeholder="100"
              />
              <p className="mt-1 text-xs text-zinc-400">
                 {a("Authoritative inventory for checkout. The In/Out of Stock label follows this number automatically. For products from the Google Sheet, a new number is also written to the sheet.")} </p>
            </div>

            <ProductPhotoUploader
              key={productForm.id ?? "new"}
              photos={productForm.gallery}
              onChange={(gallery) =>
                setProductForm((current) => current.id === productForm.id ? { ...current, gallery } : current)
              }
            />

            <details className="rounded-xl border px-4 py-3">
              <summary className="cursor-pointer text-sm font-semibold text-zinc-700">
                 {a("Advanced: specifications (optional)")} </summary>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold">
                     {a("Short Specs JSON")} </label>
                  <textarea
                    value={productForm.specs}
                    onChange={(event) =>
                      setProductForm({
                        ...productForm,
                        specs: event.target.value,
                      })
                    }
                    rows={5}
                    className="w-full rounded-xl border px-4 py-3 font-mono text-xs outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold">
                     {a("Full Specs JSON")} </label>
                  <textarea
                    value={productForm.fullSpecs}
                    onChange={(event) =>
                      setProductForm({
                        ...productForm,
                        fullSpecs: event.target.value,
                      })
                    }
                    rows={7}
                    className="w-full rounded-xl border px-4 py-3 font-mono text-xs outline-none focus:border-red-500"
                  />
                </div>
              </div>
            </details>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSavingProduct}
                className="flex-1 rounded-full bg-red-600 px-5 py-3 font-semibold text-white disabled:bg-zinc-400"
              >
                {isSavingProduct
                  ? a("Saving...")
                  : productForm.id
                  ? a("Update Product")
                  : a("Add Product")}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsProductFormOpen(false);
                  setProductForm(emptyProductForm());
                }}
                className="rounded-full border px-5 py-3 font-semibold hover:bg-zinc-100"
              >
                 {a("Cancel")} </button>
            </div>
          </form>
        )}
        </div>
        )}

        <div className="min-w-0 rounded-2xl bg-white shadow-sm ring-1 ring-zinc-100">
          <div className="flex flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="text-2xl font-bold tracking-tight">{a("Product List")}</h2>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                aria-label={a("Search products")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="min-w-0 flex-1 rounded-full border border-zinc-300 px-4 py-2.5 outline-none focus:border-red-500 sm:w-64"
                placeholder={a("Search products...")}
              />
              {isAdmin && !isProductFormOpen && (
                <button
                  onClick={() => {
                    const form = emptyProductForm();
                    setProductForm(view === "All Products" ? form : switchSheetTab(form, view));
                    setIsNewCategory(false);
                    setIsProductFormOpen(true);
                  }}
                  className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
                >
                   {a("+ Add Product")} </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 px-4 pb-4 sm:px-6" role="group" aria-label={a("Product categories")}>
            {VIEWS.map(section => (
              <button
                type="button"
                key={section}
                aria-pressed={view === section}
                onClick={() => setView(section)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${view === section ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 text-zinc-700 hover:bg-zinc-100"}`}
              >
                {a(section)}
                {catalog?.products && (
                  <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${view === section ? "bg-white/15" : "bg-zinc-100"}`}>
                    {productsForView(section).length.toLocaleString()}
                  </span>
                )}
              </button>
            ))}
          </div>
          {isLoading && (
            <p role="status" className="px-4 py-4 text-sm text-zinc-600 sm:px-6">{a("Loading products…")}</p>
          )}
          {!isLoading && catalog?.error && (
            <div role="alert" className="flex flex-wrap items-center gap-3 bg-red-50 px-4 py-4 text-sm text-red-700 sm:px-6">
              <p>{a(catalog.products ? "Could not refresh the product list." : "Could not load products.")} {a(catalog.error)}</p>
              <button type="button" onClick={() => void onProductsChanged?.()} className="rounded-full border border-red-200 px-3 py-1 font-semibold">{a("Retry")}</button>
            </div>
          )}
          {catalog?.products && (
            <ProductCatalogList
              key={`${view}:${keyword}`}
              products={productsForView(view)}
              pageSize={pageSize}
              onPageSize={setPageSize}
              onEdit={(product) => {
                setProductForm(productToForm(product));
                setIsNewCategory(false);
                setIsProductFormOpen(true);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              onDelete={isAdmin ? handleDeleteProduct : undefined}
            />
          )}
        </div>
      </section>
      {isAdmin && (
        <RecentlyDeletedProducts
          refreshKey={allProducts.length}
          onChanged={() => onProductsChanged?.()}
        />
      )}
    </>
  );
}
