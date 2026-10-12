import type { Metadata } from "next";
import CategoryCatalogPage from "../../components/CategoryCatalogPage";

export const metadata: Metadata = {
  title: "PC Parts | Aphrodite Store",
  description: "Browse CPUs, GPUs, motherboards, memory, storage, power supplies, cases, and cooling parts.",
};

export default function PcPartsCatalogPage() {
  return <CategoryCatalogPage section="PC Parts" />;
}
