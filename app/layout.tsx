import type { Metadata } from "next";
import "./globals.css";
import LocationSharing from "./components/LocationSharing";

export const metadata: Metadata = {
  title: "Aphrodite Store",
  description: "Explore laptops, accessories and PC parts at Aphrodite Myanmar. Compare specifications, plan a PC and track your orders.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}<LocationSharing /></body>
    </html>
  );
}
