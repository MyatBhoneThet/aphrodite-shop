import type { Product } from "../data/products";

export const PRODUCT_GRADES = {
  "brand-new": { label: "Brand New", color: "bg-emerald-50 text-emerald-800" },
  "commercial-new": { label: "Commercial · Brand New", color: "bg-sky-50 text-sky-800" },
  "new-clearance": { label: "Brand New · Clearance", color: "bg-amber-50 text-amber-900" },
  "clearance-b": { label: "Clearance · Grade B", color: "bg-orange-50 text-orange-900" },
} as const;

export type ProductGrade = keyof typeof PRODUCT_GRADES;

export function availableProductGrade(product: Pick<Product, "type" | "stock" | "fullSpecs">): ProductGrade | null {
  const condition = product.fullSpecs?.condition;
  if (product.type !== "laptop" || product.stock !== "In Stock" || typeof condition !== "string") return null;

  const grade = condition.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
    .replace(/\bclearnace\b/g, "clearance");

  switch (grade) {
    case "brand new":
    case "brand new official":
      return "brand-new";
    case "commercial brand new":
    case "brand new commercial":
      return "commercial-new";
    case "brand new clearance":
    case "brand new clearance sale":
    case "brand new clearance sales":
      return "new-clearance";
    case "brand new clearance sale b":
    case "brand new clearance sales b":
    case "clearance sale b":
    case "clearance sales b":
    case "clearance grade b":
    case "grade b clearance":
      return "clearance-b";
    default:
      return null;
  }
}

export function availableProductGrades(products: Product[]): ProductGrade[] {
  const grades = new Set(products.map(availableProductGrade));
  return (Object.keys(PRODUCT_GRADES) as ProductGrade[]).filter((grade) => grades.has(grade));
}
