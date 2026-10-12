import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getProductForViewer } from "@/app/lib/backend";
import { formatCurrency } from "@/app/lib/format";
import { productSharePreview } from "@/app/lib/product-share";
import { parseProductIdParam } from "@/app/lib/validation";
import ProductDetailsClient, { type ProductResponse } from "./ProductDetailsClient";

// Prices, promotions and stock change all day: never serve a stale copy.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * The signed-out view of a product, shared by the page and its metadata so the
 * database is read once per request. A lookup failure is treated as "no
 * preview" rather than an error page: the client component still loads the
 * product itself and shows its own message.
 */
const loadPublicProduct = cache(async (rawId: string) => {
  const id = parseProductIdParam(rawId);
  if (id === null) return { id: null, data: null, failed: false };

  try {
    return { id, data: await getProductForViewer(null, id, 1), failed: false };
  } catch (error) {
    console.error("[product-page] public lookup failed", {
      id,
      error: error instanceof Error ? error.message : String(error),
    });
    return { id, data: null, failed: true };
  }
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const { data } = await loadPublicProduct(id);

  if (!data) {
    return { title: "Product", robots: { index: false } };
  }

  const preview = productSharePreview(data.product, data.pricing.unitPrice, formatCurrency);
  const url = `/products/${data.product.id}`;

  return {
    title: `${preview.title} | Aphrodite Store`,
    description: preview.description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: "Aphrodite Myanmar",
      url,
      title: preview.shareTitle,
      description: preview.description,
      images: [{ url: preview.image, alt: data.product.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: preview.shareTitle,
      description: preview.description,
      images: [preview.image],
    },
    other: preview.priceAmount
      ? {
          "product:price:amount": String(preview.priceAmount),
          "product:price:currency": "MMK",
          "product:availability": preview.inStock ? "in stock" : "out of stock",
        }
      : undefined,
  };
}

export default async function ProductPage({ params }: Params) {
  const { id } = await params;
  const { id: productId, data, failed } = await loadPublicProduct(id);

  // A malformed id, or an id the database says does not exist, is a real 404
  // so search engines drop it. If the lookup itself failed we cannot know, so
  // the client component gets a chance to load the product on its own.
  if (productId === null || (data === null && !failed)) {
    notFound();
  }

  const structuredData = data
    ? productSharePreview(data.product, data.pricing.unitPrice, formatCurrency).jsonLd
    : null;

  return (
    <>
      {structuredData && (
        <script
          type="application/ld+json"
          // "<" is escaped so a product name can never close the script tag.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
          }}
        />
      )}
      <ProductDetailsClient initial={data as ProductResponse | null} />
    </>
  );
}
