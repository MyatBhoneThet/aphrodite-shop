import type { Metadata } from "next";
import StatusScreen from "./components/StatusScreen";

export const metadata: Metadata = { title: "Page not found | Aphrodite Store" };

export default function NotFound() {
  return <StatusScreen kind="not-found" />;
}
