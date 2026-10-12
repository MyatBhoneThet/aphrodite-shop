import type { Metadata } from "next";
import CategoryCatalogPage from "../../components/CategoryCatalogPage";

export const metadata: Metadata = {
  title: "Laptops | Aphrodite Store",
  description: "Browse every laptop currently available in the Aphrodite Myanmar catalogue.",
};

export default function LaptopsCatalogPage() {
  return <CategoryCatalogPage section="Laptops" />;
}
