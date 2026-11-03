import { randomUUID } from "node:crypto";
import { badRequest } from "./errors";

/** Shared by the routes that accept a banner image, so the limits stay the same everywhere. */
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
export const MAX_AD_IMAGE_BYTES = 8 * 1024 * 1024;

export function assertAdImage(file: unknown, label = "Advertisement"): asserts file is File {
  if (!(file instanceof File)) throw badRequest(`Choose a ${label.toLowerCase()} image.`);
  if (!IMAGE_TYPES.has(file.type)) throw badRequest(`${label} must be a JPG, PNG or WebP image.`);
  if (file.size <= 0 || file.size > MAX_AD_IMAGE_BYTES) throw badRequest(`${label} must be 8 MB or smaller.`);
}

/** A fresh storage path for an uploaded banner; `suffix` marks the Burmese copy. */
export function adImagePath(file: File, suffix = "") {
  const safeName = (file.name || "banner").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-100) || "banner";
  return `uploads/${randomUUID()}${suffix}-${safeName}`;
}
