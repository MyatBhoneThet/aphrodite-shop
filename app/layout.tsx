import type { Metadata } from "next";
import "./globals.css";
import LocationSharing from "./components/LocationSharing";
import { LanguageProvider } from "./lib/language";

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
    // Browser extensions (e.g. QuillBot, CrossPilot, Grammarly) add attributes to
    // <html>/<body> before React loads. This only ignores attribute differences on
    // these two elements; mismatches inside the page are still reported.
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <LanguageProvider>
          {children}
          <LocationSharing />
        </LanguageProvider>
      </body>
    </html>
  );
}
