import type { Product } from "../data/products";

export type CatalogSection = "Laptops" | "Accessories" | "PC Parts";

export const CATALOG_SECTION_DETAILS: Record<
  CatalogSection,
  { title: string; description: string; href: string }
> = {
  Laptops: {
    title: "Laptops",
    description:
      "Browse every laptop currently available in the Aphrodite Myanmar catalogue.",
    href: "/catalog/laptops",
  },
  Accessories: {
    title: "Accessories",
    description:
      "Browse monitors, mice, keyboards, headsets, bags, cables, and other accessories.",
    href: "/catalog/accessories",
  },
  "PC Parts": {
    title: "PC Parts",
    description:
      "Browse CPUs, GPUs, motherboards, memory, storage, power supplies, cases, and cooling parts.",
    href: "/catalog/pc-parts",
  },
};

export function belongsToCatalogSection(
  product: Product,
  section: CatalogSection
) {
  if (product.sourceSheet) return product.sourceSheet === section;
  if (section === "Laptops") return product.type === "laptop";
  if (section === "Accessories") return product.type === "accessory";
  return false;
}

/** Returns a new Fisher-Yates shuffled array and never mutates API data. */
export function shuffleProducts<T>(
  products: readonly T[],
  random: () => number = Math.random
) {
  const shuffled = [...products];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}
