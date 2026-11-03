import { NextResponse, type NextRequest } from "next/server";
import { recordAdminAction } from "@/app/lib/admin-audit";
import { authenticate } from "@/app/lib/backend";
import { handleRouteError, notFound } from "@/app/lib/errors";
import { adImagePath, assertAdImage } from "@/app/lib/homepage-ad-image";
import {
  deleteHomepageAdObject,
  requireBackoffice,
  selectHomepageAds,
  updateHomepageAd,
  uploadHomepageAdObject,
} from "@/app/lib/supabase";

export const runtime = "nodejs";

/**
 * The Burmese version of one banner: a second image shown instead of the
 * English one when the visitor's language is Burmese. POST uploads or
 * replaces it; DELETE removes it, so Burmese visitors see the English image.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let uploadedPath: string | null = null;
  try {
    const user = await authenticate(request);
    requireBackoffice(user);
    const { id } = await context.params;
    const existing = (await selectHomepageAds(true)).find((ad) => ad.id === id);
    if (!existing) throw notFound("Advertisement not found.");

    const file = (await request.formData()).get("file");
    assertAdImage(file, "Burmese banner");

    uploadedPath = adImagePath(file, "-my");
    const imageUrl = await uploadHomepageAdObject(uploadedPath, await file.arrayBuffer(), file.type);
    const ad = await updateHomepageAd(id, { image_url_my: imageUrl, storage_path_my: uploadedPath });
    if (!ad) throw notFound("Advertisement not found.");

    // The replaced file is no longer referenced anywhere.
    if (existing.storage_path_my) await deleteHomepageAdObject(existing.storage_path_my).catch(() => {});

    await recordAdminAction({ actorId: user.id, action: "home_ad.burmese_image", targetType: "home_ad", targetId: id, next: { title: ad.title } });
    return NextResponse.json({ ad });
  } catch (error) {
    if (uploadedPath) await deleteHomepageAdObject(uploadedPath).catch(() => {});
    return handleRouteError("admin.home-ads.burmese.upload", error);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await authenticate(request);
    requireBackoffice(user);
    const { id } = await context.params;
    const existing = (await selectHomepageAds(true)).find((ad) => ad.id === id);
    if (!existing) throw notFound("Advertisement not found.");

    const ad = await updateHomepageAd(id, { image_url_my: null, storage_path_my: null });
    if (existing.storage_path_my) await deleteHomepageAdObject(existing.storage_path_my).catch(() => {});

    await recordAdminAction({ actorId: user.id, action: "home_ad.burmese_image.remove", targetType: "home_ad", targetId: id, previous: { title: existing.title } });
    return NextResponse.json({ ad });
  } catch (error) {
    return handleRouteError("admin.home-ads.burmese.remove", error);
  }
}
