import { NextResponse, type NextRequest } from "next/server";
import { authenticate } from "@/app/lib/backend";
import { badRequest, handleRouteError, notFound } from "@/app/lib/errors";
import { readJsonBody } from "@/app/lib/request";
import {
  deleteHomepageAd,
  deleteHomepageAdObject,
  requireAdmin,
  selectHomepageAds,
  updateHomepageAd,
} from "@/app/lib/supabase";

function safeFields(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw badRequest("Invalid advertisement update.");
  const input = body as Record<string, unknown>;
  const fields: Record<string, string | number | boolean> = {};
  if ("title" in input) {
    const value = String(input.title ?? "").trim();
    if (!value || value.length > 120) throw badRequest("Title must be 1 to 120 characters.");
    fields.title = value;
  }
  if ("alt_text" in input) {
    const value = String(input.alt_text ?? "").trim();
    if (!value || value.length > 240) throw badRequest("Image description must be 1 to 240 characters.");
    fields.alt_text = value;
  }
  if ("href" in input) {
    const value = String(input.href ?? "").trim() || "/";
    if (!value.startsWith("/") && !/^https:\/\//i.test(value)) throw badRequest("Link must start with / or https://.");
    fields.href = value.slice(0, 500);
  }
  if ("is_active" in input) fields.is_active = Boolean(input.is_active);
  if ("sort_order" in input) {
    const value = Number(input.sort_order);
    if (!Number.isInteger(value)) throw badRequest("Order must be a whole number.");
    fields.sort_order = value;
  }
  if (!Object.keys(fields).length) throw badRequest("No advertisement changes were provided.");
  return fields;
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await authenticate(request);
    requireAdmin(user);
    const { id } = await context.params;
    const ad = await updateHomepageAd(id, safeFields(await readJsonBody(request)));
    if (!ad) throw notFound("Advertisement not found.");
    return NextResponse.json({ ad });
  } catch (error) {
    return handleRouteError("admin.home-ads.update", error);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await authenticate(request);
    requireAdmin(user);
    const { id } = await context.params;
    const existing = (await selectHomepageAds(true)).find((ad) => ad.id === id);
    if (!existing) throw notFound("Advertisement not found.");
    await deleteHomepageAd(id);
    await deleteHomepageAdObject(existing.storage_path);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return handleRouteError("admin.home-ads.delete", error);
  }
}
