import type { Product } from "../data/products";
import { productPhotos } from "./product-gallery";
import { publicSiteUrl } from "./site-url";

/** Shown when a product has no photo Facebook/Viber can use (they cannot read SVG). */
const FALLBACK_SHARE_IMAGE = "/brand/og-share.png";

type SharePreview = {
  /** Browser tab / search result title. */
  title: string;
  /** Title in a Messenger / Viber card: name plus the price. */
  shareTitle: string;
  description: string;
  image: string;
  priceAmount: number | null;
  inStock: boolean;
  jsonLd: Record<string, unknown>;
};

function firstShareablePhoto(product: Pick<Product, "image" | "fullSpecs">) {
  const photo = productPhotos(product).find(
    (item) => !/\.svg(\?|#|$)/i.test(item.url)
  );
  return photo?.url ?? FALLBACK_SHARE_IMAGE;
}

function specLine(product: Pick<Product, "specs">) {
  const { cpu, ram, storage, display } = product.specs ?? {};
  return [cpu, ram, storage, display]
    .filter((value): value is string => typeof value === "string" && value.trim() !== "")
    .map((value) => value.trim())
    .join(" · ");
}

/**
 * What a shared product link should look like, and the structured data search
 * engines read. Pure so it can be tested; the page only passes the public
 * product and the price the visitor would pay for one unit.
 */
export function productSharePreview(
  product: Pick<Product, "id" | "name" | "brand" | "category" | "image" | "fullSpecs" | "specs" | "stock">,
  unitPrice: number,
  formatPrice: (value: number) => string,
  siteUrl = publicSiteUrl()
): SharePreview {
  const priced = Number.isFinite(unitPrice) && unitPrice > 0;
  const inStock = product.stock === "In Stock";
  const image = firstShareablePhoto(product);
  const absoluteImage = /^https?:\/\//i.test(image) ? image : `${siteUrl}${image}`;
  const specs = specLine(product);

  const description = [
    [product.brand, product.category].filter(Boolean).join(" "),
    specs,
    priced ? formatPrice(unitPrice) : "Price coming soon",
    inStock ? "In stock" : "Currently out of stock",
    "Delivery across Yangon from Aphrodite Myanmar.",
  ]
    .filter(Boolean)
    .join(" — ")
    .slice(0, 300);

  return {
    title: product.name,
    shareTitle: priced ? `${product.name} — ${formatPrice(unitPrice)}` : product.name,
    description,
    image,
    priceAmount: priced ? Math.round(unitPrice) : null,
    inStock,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      image: [absoluteImage],
      description,
      sku: String(product.id),
      brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
      category: product.category || undefined,
      url: `${siteUrl}/products/${product.id}`,
      offers: priced
        ? {
            "@type": "Offer",
            priceCurrency: "MMK",
            price: Math.round(unitPrice),
            availability: inStock
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
            url: `${siteUrl}/products/${product.id}`,
            seller: { "@type": "Organization", name: "Aphrodite Myanmar" },
          }
        : undefined,
    },
  };
}
