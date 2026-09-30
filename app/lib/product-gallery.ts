import type { Product } from "../data/products";
export type ProductPhoto = { url: string; label: string };
export const PRODUCT_PLACEHOLDER = "/products/production-placeholder.svg";
export function safeImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (/^\/(?!\/)[a-zA-Z0-9_./% -]+$/.test(url) && !url.includes("..")) return url;
  try { const parsed = new URL(url); return parsed.protocol === "https:" && !parsed.username && !parsed.password ? url : null; }
  catch { return null; }
}
export function normalizeGallery(value: unknown): ProductPhoto[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((item, i) => {
    const url = safeImageUrl(typeof item === "string" ? item : item?.url);
    if (!url || seen.has(url) || url === PRODUCT_PLACEHOLDER) return [];
    seen.add(url);
    return [{ url, label: typeof item?.label === "string" && item.label.trim() ? item.label.trim().slice(0,80) : `Photo ${i + 1}` }];
  }).slice(0, 12);
}
export function productPhotos(product: Pick<Product, "image" | "fullSpecs">): ProductPhoto[] {
  const gallery = normalizeGallery(product.fullSpecs?.gallery);
  const cover = safeImageUrl(product.image);
  if (cover && cover !== PRODUCT_PLACEHOLDER && !gallery.some(photo => photo.url === cover)) gallery.unshift({ url: cover, label: "Product view" });
  return gallery.slice(0, 12);
}
export function parseGalleryLines(text: string): ProductPhoto[] {
  const rows = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (rows.length > 12) throw new Error("Use up to 12 product photos.");
  return normalizeGallery(rows.map((line, i) => {
    const [url, ...label] = line.split("|");
    if (!safeImageUrl(url)) throw new Error(`Photo ${i + 1} needs an HTTPS URL or a local /products/ path.`);
    return { url: url.trim(), label: label.join("|").trim() || `Photo ${i + 1}` };
  }));
}
export function sheetGallery(headers: string[], cells: unknown[]): ProductPhoto[] {
  const photos = [
    ["front_image_url", "Front view"], ["rear_image_url", "Rear view"], ["side_image_url", "Side view"],
  ].map(([key,label]) => ({ url: cells[headers.indexOf(key)], label }));
  const extra = cells[headers.indexOf("gallery_image_urls")];
  if (typeof extra === "string") extra.split(/\s*\|\s*|\r?\n/).filter(Boolean).forEach((url,i) => photos.push({ url, label: `Product view ${i + 1}` }));
  return normalizeGallery(photos);
}
