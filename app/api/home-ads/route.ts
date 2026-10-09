<<<<<<< HEAD
import { NextResponse, type NextRequest } from "next/server";
import { badRequest, handleRouteError } from "@/app/lib/errors";
import { isHomepageAdPlacement } from "@/app/lib/homepage-ads";
import { selectHomepageAds } from "@/app/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const requestedPlacement = request.nextUrl.searchParams.get("placement") ?? "hero";
    if (!isHomepageAdPlacement(requestedPlacement)) throw badRequest("Invalid advertisement placement.");
    const ads = await selectHomepageAds(false, requestedPlacement);
    return NextResponse.json(
      { ads: ads.map(({ id, title, alt_text, image_url, href, placement }) => ({ id, title, alt_text, image_url, href, placement })) },
=======
import { NextResponse } from "next/server";
import { handleRouteError } from "@/app/lib/errors";
import { selectHomepageAds } from "@/app/lib/supabase";

export async function GET() {
  try {
    const ads = await selectHomepageAds(false);
    return NextResponse.json(
      { ads: ads.map(({ id, title, alt_text, image_url, href }) => ({ id, title, alt_text, image_url, href })) },
>>>>>>> origin/main
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return handleRouteError("home-ads.list", error);
  }
}
