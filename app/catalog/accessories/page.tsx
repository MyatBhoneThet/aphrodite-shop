import type { Metadata } from "next";
import CategoryCatalogPage from "../../components/CategoryCatalogPage";

export const metadata: Metadata = {
  title: "Accessories | Aphrodite Store",
  description: "Browse monitors, mice, keyboards, headsets, bags, cables, and other accessories.",
};

export default function AccessoriesCatalogPage() {
  return <CategoryCatalogPage section="Accessories" />;
}
