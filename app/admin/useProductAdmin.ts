"use client";

import { FormEvent, useState } from "react";
import type { Product } from "../data/products";
import { authHeaders } from "../lib/client-auth";
import { PRODUCT_PLACEHOLDER, normalizeGallery } from "../lib/product-gallery";
import { emptyProductForm, getErrorMessage, parseJsonObject } from "./product-form";
import { confirmAction } from "./confirm";
import { fetchWithReauth } from "./reauth";
import type { ProductFormState } from "./types";

type Options = {
  loadDashboardData: () => Promise<void>;
  setMessage: (message: string) => void;
  setError: (message: string) => void;
};

/** The add / edit product form: its state, saving and deleting. */
export function useProductAdmin({ loadDashboardData, setMessage, setError }: Options) {
  const [productForm, setProductForm] = useState<ProductFormState>(emptyProductForm);
  // The add/edit form is hidden until requested so the product list gets the
  // full panel width by default.
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  async function handleSaveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setIsSavingProduct(true);

    try {
      const price = Number(productForm.price);
      const wholesalePrice = productForm.wholesalePrice
        ? Number(productForm.wholesalePrice)
        : undefined;

      if (!productForm.name.trim()) throw new Error("Product name is required.");
      if (!productForm.brand.trim()) throw new Error("Brand is required.");
      if (!productForm.category.trim()) {
        throw new Error("Category is required.");
      }

      if (!Number.isFinite(price) || price < 0) {
        throw new Error("Retail price must be a valid number.");
      }

      if (
        productForm.wholesalePrice &&
        (!Number.isFinite(wholesalePrice) || Number(wholesalePrice) < 0)
      ) {
        throw new Error("Wholesale price must be a valid number.");
      }

      const stockQuantity = productForm.stockQuantity
        ? Number(productForm.stockQuantity)
        : undefined;

      if (
        stockQuantity !== undefined &&
        (!Number.isInteger(stockQuantity) || stockQuantity < 0)
      ) {
        throw new Error("Stock quantity must be a whole number of 0 or more.");
      }

      const payload: Partial<Product> = {
        name: productForm.name.trim(),
        type: productForm.type,
        // Only a new product is placed in a sheet tab; edits never move it.
        ...(productForm.id ? {} : { sourceSheet: productForm.sourceSheet }),
        category: productForm.category.trim(),
        brand: productForm.brand.trim(),
        price,
        wholesalePrice,
        image: productForm.gallery[0]?.url ?? PRODUCT_PLACEHOLDER,
        stock: productForm.stock,
        stockQuantity,
        specs: parseJsonObject(productForm.specs, "Short specs"),
        fullSpecs: { ...parseJsonObject(productForm.fullSpecs, "Full specs"), gallery: normalizeGallery(productForm.gallery), galleryManagedBy: "admin" },
      };

      const response = await fetch(
        productForm.id ? `/api/products/${productForm.id}` : "/api/products",
        {
          method: productForm.id ? "PATCH" : "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const data = (await response.json().catch(() => null)) as {
        product?: Product;
        sheetStock?: {
          sheet: string;
          cells: { row: number; from: number; to: number }[];
          sheetQuantityBefore: number;
          sheetQuantityAfter: number;
          warning: string | null;
        } | null;
      } | null;
      const sheetStock = data?.sheetStock;

      setProductForm(emptyProductForm());
      setIsProductFormOpen(false);
      await loadDashboardData();

      if (sheetStock) {
        const changedRows = sheetStock.cells.length
          ? sheetStock.cells.map((cell) => `row ${cell.row}: ${cell.from} → ${cell.to}`).join(", ")
          : "the sheet already had this number";
        setMessage(
          `Product updated. Google Sheet "${sheetStock.sheet}" stock is now ${sheetStock.sheetQuantityAfter} (was ${sheetStock.sheetQuantityBefore}; ${changedRows}).`
        );
        if (sheetStock.warning) setError(sheetStock.warning);
      } else {
        setMessage(
          productForm.id
            ? "Product updated successfully."
            : data?.product?.sourceSheet
              ? `Product added to the website and to the "${data.product.sourceSheet}" tab of the Google Sheet.`
              : "Product added successfully."
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save product.");
    } finally {
      setIsSavingProduct(false);
    }
  }

  async function handleDeleteProduct(product: Product) {
    const confirmed = await confirmAction({
      title: "Delete this product?",
      subject: product.name,
      message: "It is taken off the shop right away and kept in Recently deleted for 30 days.",
      consequences: [
        "You can restore it from Recently deleted, with the stock it had, within 30 days.",
        ...(product.sourceSheet
          ? [`Its row stays in the "${product.sourceSheet}" tab of the Google Sheet until the 30 days are up, then it is deleted there too.`]
          : []),
        "After 30 days it is erased for good.",
      ],
      confirmLabel: "Delete product",
      requireText: "DELETE",
    });

    if (!confirmed) return;

    setMessage("");
    setError("");

    try {
      const response = await fetchWithReauth(`/api/products/${product.id}`, {
        method: "DELETE",
        // The server asks for the word again, so a bare request cannot delete.
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      await loadDashboardData();
      setMessage(
        `Moved “${product.name}” to Recently deleted. You can restore it for 30 days.`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete product."
      );
    }
  }

  return {
    productForm,
    setProductForm,
    isProductFormOpen,
    setIsProductFormOpen,
    isSavingProduct,
    handleSaveProduct,
    handleDeleteProduct,
  };
}
