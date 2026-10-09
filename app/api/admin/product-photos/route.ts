import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { authenticate } from "@/app/lib/backend";
import { badRequest, handleRouteError } from "@/app/lib/errors";
import { requireBackoffice, uploadProductPhotoObject } from "@/app/lib/supabase";

export const runtime = "nodejs";

// The product-photos bucket itself only accepts these types and rejects
// anything over 5 MB, so reject early with a message the admin can act on.
const PRODUCT_PHOTO_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_PRODUCT_PHOTO_BYTES = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    requireBackoffice(user);

    const form = await request.formData();
    const files = form
      .getAll("file")
      .filter((entry): entry is File => entry instanceof File);

    if (!files.length) throw badRequest("Choose at least one photo.");
    if (files.length > 12) throw badRequest("Upload up to 12 photos at a time.");

    const photos: { url: string; label: string }[] = [];

    for (const file of files) {
      const name = file.name || "That file";

      if (!PRODUCT_PHOTO_TYPES.has(file.type)) {
        throw badRequest(`${name} is not a JPG, PNG or WebP image.`);
      }

      if (file.size <= 0 || file.size > MAX_PRODUCT_PHOTO_BYTES) {
        throw badRequest(`${name} must be 5 MB or smaller.`);
      }

      const safeName =
        file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-100) || "photo";

      const url = await uploadProductPhotoObject(
        `uploads/${randomUUID()}-${safeName}`,
        await file.arrayBuffer(),
        file.type
      );

      photos.push({ url, label: "Product view" });
    }

    return NextResponse.json({ photos }, { status: 201 });
  } catch (error) {
    return handleRouteError("admin.product-photos.upload", error);
  }
}
