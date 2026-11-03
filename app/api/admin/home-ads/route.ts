import { NextResponse, type NextRequest } from "next/server";
import { recordAdminAction } from "@/app/lib/admin-audit";
import { authenticate } from "@/app/lib/backend";
import { badRequest, handleRouteError } from "@/app/lib/errors";
import { isHomepageAdPlacement } from "@/app/lib/homepage-ads";
import { adImagePath, assertAdImage } from "@/app/lib/homepage-ad-image";
import {
  deleteHomepageAdObject,
  insertHomepageAd,
  requireBackoffice,
  selectHomepageAds,
  uploadHomepageAdObject,
} from "@/app/lib/supabase";

export const runtime = "nodejs";

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
  let uploadedPathMy: string | null = null;
  try {
    const user = await authenticate(request);
    requireBackoffice(user);
    const form = await request.formData();
    const file = form.get("file");
    assertAdImage(file, "Advertisement");
    // Optional: the same banner with Burmese words, shown to Burmese visitors.
    const fileMy = form.get("file_my");
    const hasBurmese = fileMy instanceof File && fileMy.size > 0;
    if (hasBurmese) assertAdImage(fileMy, "Burmese banner");

    const title = String(form.get("title") ?? "").trim();
    const altText = String(form.get("alt_text") ?? "").trim();
    const placement = String(form.get("placement") ?? "hero");
    if (!title || title.length > 120) throw badRequest("Title must be 1 to 120 characters.");
    if (!altText || altText.length > 240) throw badRequest("Image description must be 1 to 240 characters.");
    if (!isHomepageAdPlacement(placement)) throw badRequest("Choose a valid advertisement placement.");

    const width = Number(form.get("width"));
    const height = Number(form.get("height"));
    uploadedPath = adImagePath(file);
    const imageUrl = await uploadHomepageAdObject(uploadedPath, await file.arrayBuffer(), file.type);
    let imageUrlMy: string | null = null;
    if (hasBurmese) {
      uploadedPathMy = adImagePath(fileMy, "-my");
      imageUrlMy = await uploadHomepageAdObject(uploadedPathMy, await fileMy.arrayBuffer(), fileMy.type);
    }
    const existing = await selectHomepageAds(true, placement);
    const sortOrder = existing.reduce((max, ad) => Math.max(max, ad.sort_order), -1) + 1;
    const ad = await insertHomepageAd({
      title,
      alt_text: altText,
      image_url: imageUrl,
      storage_path: uploadedPath,
      image_url_my: imageUrlMy,
      storage_path_my: uploadedPathMy,
      href: safeHref(form.get("href")),
      placement,
      width: Number.isInteger(width) && width > 0 ? width : null,
      height: Number.isInteger(height) && height > 0 ? height : null,
      is_active: true,
      sort_order: sortOrder,
      // The manifest lives beside public banner images, so never persist an
      // administrator identifier in it.
      created_by: null,
    });
    await recordAdminAction({ actorId: user.id, action: "home_ad.create", targetType: "home_ad", targetId: ad.id, next: { title, placement } });
    return NextResponse.json({ ad }, { status: 201 });
  } catch (error) {
    if (uploadedPath) await deleteHomepageAdObject(uploadedPath).catch(() => {});
    if (uploadedPathMy) await deleteHomepageAdObject(uploadedPathMy).catch(() => {});
    return handleRouteError("admin.home-ads.create", error);
  }
}
