/**
 * Small copies of product photos for places that show them tiny (the search
 * suggestions are 44 px wide). The product photos in storage are full size,
 * often hundreds of kilobytes each, which is a lot to pull over mobile data
 * for a thumbnail.
 *
 * Pure helpers shared by the page (build the address) and the route (check
 * the address before fetching anything).
 */

/** Only these sizes are served, so the endpoint cannot be used to make arbitrary images. */
export const THUMBNAIL_WIDTHS = [48, 96, 160, 320] as const;
export type ThumbnailWidth = (typeof THUMBNAIL_WIDTHS)[number];

const PUBLIC_OBJECT_PREFIX = "/storage/v1/object/public/";

export function clampThumbnailWidth(value: unknown): ThumbnailWidth {
  const wanted = Number(value);
  if (!Number.isFinite(wanted)) return 96;
  return THUMBNAIL_WIDTHS.find((width) => width >= wanted) ?? THUMBNAIL_WIDTHS[THUMBNAIL_WIDTHS.length - 1];
}

/**
 * True only for a public photo in this shop's own Supabase storage. Anything
 * else is refused, which is what keeps the thumbnail route from fetching
 * arbitrary addresses on a stranger's behalf.
 */
export function isThumbnailSource(value: string, supabaseUrl: string | undefined): boolean {
  if (!supabaseUrl) return false;
  try {
    const source = new URL(value);
    const allowed = new URL(supabaseUrl);
    return (
      source.protocol === "https:" &&
      source.hostname === allowed.hostname &&
      !source.username &&
      !source.password &&
      !source.port &&
      source.pathname.startsWith(PUBLIC_OBJECT_PREFIX) &&
      !source.pathname.includes("..")
    );
  } catch {
    return false;
  }
}

/**
 * The address to put in an <img>: a thumbnail for the shop's own storage
 * photos, the original for everything else (local files, other hosts).
 */
export function thumbnailSrc(
  image: string,
  width: number = 96,
  supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL
): string {
  if (!isThumbnailSource(image, supabaseUrl)) return image;
  const params = new URLSearchParams({ src: image, w: String(clampThumbnailWidth(width)) });
  return `/api/thumb?${params.toString()}`;
}
