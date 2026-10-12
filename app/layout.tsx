import type { Metadata } from "next";
import "./globals.css";
import LocationSharing from "./components/LocationSharing";
import { LanguageProvider } from "./lib/language";
import { publicSiteUrl } from "./lib/site-url";

const DESCRIPTION =
  "Explore laptops, accessories and PC parts at Aphrodite Myanmar. Compare specifications, plan a PC and track your orders.";

export const metadata: Metadata = {
  // Lets every relative share-image / canonical URL become absolute, which is
  // what Facebook, Messenger and Viber need to show a preview card.
  metadataBase: new URL(publicSiteUrl()),
  title: "Aphrodite Store",
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Aphrodite Myanmar",
    title: "Aphrodite Myanmar",
    description: DESCRIPTION,
    images: [{ url: "/brand/og-share.png", width: 1200, height: 630, alt: "Aphrodite Myanmar" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Aphrodite Myanmar",
    description: DESCRIPTION,
    images: ["/brand/og-share.png"],
  },
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
