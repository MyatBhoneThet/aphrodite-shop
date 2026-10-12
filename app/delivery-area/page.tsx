import type { Metadata } from "next";
import DeliveryLocationWelcome from "../components/DeliveryLocationWelcome";

export const metadata: Metadata = {
  title: "Delivery area — Aphrodite Myanmar",
  description: "Check that Aphrodite Myanmar delivers to your address in Yangon.",
};

export default function DeliveryAreaPage() {
  return <DeliveryLocationWelcome />;
}
