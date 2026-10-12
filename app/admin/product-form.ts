import type { Product } from "../data/products";
import { productPhotos } from "../lib/product-gallery";
import type { ProductFormState } from "./types";

type SheetTab = ProductFormState["sourceSheet"];

// Starting points for the specs editors. Laptops show example values; the
// other tabs list the usual fields empty, so nothing untrue is saved when they
// are left alone (empty fields are skipped).
const DEFAULT_SPECS: Record<SheetTab, { specs: object; fullSpecs: object }> = {
  Laptops: {
    specs: {
      cpu: "Intel Core i5",
      ram: "8GB",
      storage: "256GB SSD",
      display: "14 inch",
    },
    fullSpecs: {
      processor: "Intel Core i5",
      ram: "8GB",
      storage: "256GB SSD",
      graphics: "Integrated Graphics",
      display: "14-inch FHD",
      battery: "Up to 8 hours",
      weight: "1.4 kg",
      ports: "USB-C, USB-A, HDMI",
      operatingSystem: "Windows 11",
      warranty: "1 year",
      condition: "New",
      color: "Black",
    },
  },
  Accessories: {
    specs: { model: "", connection: "" },
    fullSpecs: {
      model: "",
      connection: "",
      compatibility: "",
      dimensions: "",
      color: "",
      warranty: "",
      condition: "New",
    },
  },
  "PC Parts": {
    specs: { model: "", interface: "" },
    fullSpecs: {
      model: "",
      interface: "",
      capacity: "",
      compatibility: "",
      warranty: "",
      condition: "New",
    },
  },
};

export function defaultSpecsFor(sheet: SheetTab) {
  return {
    specs: JSON.stringify(DEFAULT_SPECS[sheet].specs, null, 2),
    fullSpecs: JSON.stringify(DEFAULT_SPECS[sheet].fullSpecs, null, 2),
  };
}

/**
 * Moves the form to another Google Sheet tab. Specs the admin has not edited
 * are swapped for the new tab's defaults; edited specs are kept.
 */
export function switchSheetTab(form: ProductFormState, sourceSheet: SheetTab): ProductFormState {
  const before = defaultSpecsFor(form.sourceSheet);
  const after = defaultSpecsFor(sourceSheet);
  return {
    ...form,
    sourceSheet,
    type: sourceSheet === "Laptops" ? "laptop" : "accessory",
    category: sourceSheet === "Laptops" ? "Laptop" : "",
    specs: form.specs === before.specs ? after.specs : form.specs,
    fullSpecs: form.fullSpecs === before.fullSpecs ? after.fullSpecs : form.fullSpecs,
  };
}

// Used until the tab has products of its own to take categories from.
const FALLBACK_CATEGORIES: Record<SheetTab, string[]> = {
  Laptops: ["Laptop"],
  Accessories: ["Mouse", "Keyboard", "Monitor", "Headset", "Speaker", "Printer"],
  "PC Parts": ["CPU", "GPU", "Mobo", "PC - RAM", "SSD", "PSU", "PC Case", "CPU Cooler"],
};

/** Categories already used in a tab, most used first. Laptops have just one. */
export function categoriesForSheet(products: Product[], sheet: SheetTab) {
  if (sheet === "Laptops") return FALLBACK_CATEGORIES.Laptops;

  const counts = new Map<string, number>();
  for (const product of products) {
    if (product.sourceSheet !== sheet || !product.category) continue;
    counts.set(product.category, (counts.get(product.category) ?? 0) + 1);
  }
  const used = [...counts]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([category]) => category);

  return used.length ? used : FALLBACK_CATEGORIES[sheet];
}

export function emptyProductForm(): ProductFormState {
  return {
    name: "",
    type: "laptop",
    sourceSheet: "Laptops",
    category: "Laptop",
    brand: "",
    price: "",
    wholesalePrice: "",
    gallery: [],
    stock: "In Stock",
    stockQuantity: "100",
    ...defaultSpecsFor("Laptops"),
  };
}

export function productToForm(product: Product): ProductFormState {
  return {
    id: product.id,
    name: product.name,
    type: product.type,
    sourceSheet:
      product.sourceSheet === "Accessories" || product.sourceSheet === "PC Parts"
        ? product.sourceSheet
        : product.type === "laptop"
          ? "Laptops"
          : "Accessories",
    category: product.category,
    brand: product.brand,
    price: String(product.price),
    wholesalePrice: product.wholesalePrice
      ? String(product.wholesalePrice)
      : "",
    gallery: productPhotos(product),
    stock: product.stock,
    stockQuantity:
      product.stockQuantity !== undefined ? String(product.stockQuantity) : "",
    specs: JSON.stringify(product.specs ?? {}, null, 2),
    fullSpecs: JSON.stringify(product.fullSpecs ?? {}, null, 2),
  };
}

export async function getErrorMessage(response: Response) {
  const data = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  return data?.error ?? "Request failed.";
}

export function parseJsonObject(value: string, label: string) {
  try {
    const parsed = JSON.parse(value || "{}");

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error();
    }

    return parsed;
  } catch {
    throw new Error(`${label} must be valid JSON object format.`);
  }
}
