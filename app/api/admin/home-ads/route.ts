import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { authenticate } from "@/app/lib/backend";
import { badRequest, handleRouteError } from "@/app/lib/errors";
import {
  deleteHomepageAdObject,
  insertHomepageAd,
  requireBackoffice,
  selectHomepageAds,
  uploadHomepageAdObject,
} from "@/app/lib/supabase";

export const runtime = "nodejs";

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function safeHref(value: FormDataEntryValue | null) {
  const href = String(value ?? "/").trim() || "/";
  if (!href.startsWith("/") && !/^https:\/\//i.test(href)) {
    throw badRequest("Link must start with / or https://.");
  }
  return href.slice(0, 500);
}

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    requireBackoffice(user);
    return NextResponse.json({ ads: await selectHomepageAds(true) });
  } catch (error) {
    return handleRouteError("admin.home-ads.list", error);
  }
}

export async function POST(request: NextRequest) {
  let uploadedPath: string | null = null;
  try {
    const user = await authenticate(request);
    requireBackoffice(user);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw badRequest("Choose an advertisement image.");
    if (!IMAGE_TYPES.has(file.type)) throw badRequest("Advertisement must be a JPG, PNG or WebP image.");
    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) throw badRequest("Advertisement must be 8 MB or smaller.");

    const title = String(form.get("title") ?? "").trim();
    const altText = String(form.get("alt_text") ?? "").trim();
    if (!title || title.length > 120) throw badRequest("Title must be 1 to 120 characters.");
    if (!altText || altText.length > 240) throw badRequest("Image description must be 1 to 240 characters.");

    const width = Number(form.get("width"));
    const height = Number(form.get("height"));
    const safeName = (file.name || "banner").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-100);
    uploadedPath = `uploads/${randomUUID()}-${safeName || "banner"}`;
    const imageUrl = await uploadHomepageAdObject(uploadedPath, await file.arrayBuffer(), file.type);
    const existing = await selectHomepageAds(true);
    const sortOrder = existing.reduce((max, ad) => Math.max(max, ad.sort_order), -1) + 1;
    const ad = await insertHomepageAd({
      title,
      alt_text: altText,
      image_url: imageUrl,
      storage_path: uploadedPath,
      href: safeHref(form.get("href")),
      width: Number.isInteger(width) && width > 0 ? width : null,
      height: Number.isInteger(height) && height > 0 ? height : null,
      is_active: true,
      sort_order: sortOrder,
      // The manifest lives beside public banner images, so never persist an
      // administrator identifier in it.
      created_by: null,
    });
    return NextResponse.json({ ad }, { status: 201 });
  } catch (error) {
    if (uploadedPath) await deleteHomepageAdObject(uploadedPath).catch(() => {});
    return handleRouteError("admin.home-ads.create", error);
  }
}
