import { NextResponse } from "next/server";
import { handleRouteError } from "@/app/lib/errors";
import { selectHomepageAds } from "@/app/lib/supabase";

export async function GET() {
  try {
    const ads = await selectHomepageAds(false);
    return NextResponse.json(
      { ads: ads.map(({ id, title, alt_text, image_url, href }) => ({ id, title, alt_text, image_url, href })) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return handleRouteError("home-ads.list", error);
  }
}
