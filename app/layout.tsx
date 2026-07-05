import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aphrodite Store",
  description: "Laptop ecommerce frontend",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}