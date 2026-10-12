import { describe, expect, it } from "vitest";
import { clampThumbnailWidth, isThumbnailSource, thumbnailSrc } from "../app/lib/thumbnail";

const SUPABASE = "https://abc123.supabase.co";
const PHOTO = `${SUPABASE}/storage/v1/object/public/product-photos/laptops/x13.png`;

describe("thumbnail helpers", () => {
  it("only accepts public photos from this shop's own storage", () => {
    expect(isThumbnailSource(PHOTO, SUPABASE)).toBe(true);
    expect(isThumbnailSource("https://evil.example/storage/v1/object/public/a.png", SUPABASE)).toBe(false);
    expect(isThumbnailSource(`${SUPABASE}/storage/v1/object/sign/private/a.png`, SUPABASE)).toBe(false);
    expect(isThumbnailSource(`${SUPABASE}/rest/v1/profiles`, SUPABASE)).toBe(false);
    expect(isThumbnailSource(`http://abc123.supabase.co/storage/v1/object/public/a.png`, SUPABASE)).toBe(false);
    expect(isThumbnailSource(`https://user:pw@abc123.supabase.co/storage/v1/object/public/a.png`, SUPABASE)).toBe(false);
    expect(isThumbnailSource(`https://abc123.supabase.co:8443/storage/v1/object/public/a.png`, SUPABASE)).toBe(false);
    expect(isThumbnailSource(`${SUPABASE}/storage/v1/object/public/../../auth/v1/user`, SUPABASE)).toBe(false);
    expect(isThumbnailSource("/products/mouse.png", SUPABASE)).toBe(false);
    expect(isThumbnailSource("javascript:alert(1)", SUPABASE)).toBe(false);
    expect(isThumbnailSource(PHOTO, undefined)).toBe(false);
  });

  it("serves a fixed set of sizes", () => {
    expect(clampThumbnailWidth(44)).toBe(48);
    expect(clampThumbnailWidth(96)).toBe(96);
    expect(clampThumbnailWidth(100)).toBe(160);
    expect(clampThumbnailWidth(5000)).toBe(320);
    expect(clampThumbnailWidth("abc")).toBe(96);
  });

  it("points storage photos at the thumbnail route and leaves everything else alone", () => {
    const src = thumbnailSrc(PHOTO, 96, SUPABASE);
    expect(src.startsWith("/api/thumb?")).toBe(true);
    const params = new URL(src, "https://shop.example").searchParams;
    expect(params.get("src")).toBe(PHOTO);
    expect(params.get("w")).toBe("96");

    expect(thumbnailSrc("/products/mouse.png", 96, SUPABASE)).toBe("/products/mouse.png");
    expect(thumbnailSrc("https://cdn.other.example/a.png", 96, SUPABASE)).toBe("https://cdn.other.example/a.png");
    expect(thumbnailSrc(PHOTO, 96, undefined)).toBe(PHOTO);
  });
});
