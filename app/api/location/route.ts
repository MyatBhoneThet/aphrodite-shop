import { NextResponse, type NextRequest } from "next/server";
import { authenticate } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { readJsonBody } from "@/app/lib/request";
import { locationShareSchema } from "@/app/lib/location-share";
import { getLocationShare, saveLocationShare, removeLocationShare } from "@/app/lib/supabase";
import { checkRateLimit } from "@/app/lib/rate-limit";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    return NextResponse.json({ location: await getLocationShare(user.id) }, { headers });
  } catch (error) { return handleRouteError("location.get", error); }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!checkRateLimit(request, "location-share").allowed) {
      return NextResponse.json({ error: "Please wait a minute before sharing again." }, { status: 429, headers });
    }
    const parsed = locationShareSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) return NextResponse.json({ error: "Location permission and valid coordinates are required." }, { status: 400, headers });
    const { latitude, longitude, accuracy_m } = parsed.data;
    const coordinates = { latitude, longitude, accuracy_m };
    return NextResponse.json({ location: await saveLocationShare(user.id, coordinates) }, { headers });
  } catch (error) { return handleRouteError("location.share", error); }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await authenticate(request);
    await removeLocationShare(user.id);
    return NextResponse.json({ ok: true }, { headers });
  } catch (error) { return handleRouteError("location.remove", error); }
}
