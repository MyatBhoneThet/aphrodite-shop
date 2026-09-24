import { NextResponse, type NextRequest } from "next/server";
import { authenticate } from "@/app/lib/backend";
import { isApproximatelyInYangon, normalizeYangonTownship } from "@/app/lib/delivery-country";
import { handleRouteError } from "@/app/lib/errors";

type NominatimResult = {
  display_name?: string;
  address?: Record<string, string | undefined>;
};

export async function GET(request: NextRequest) {
  try {
    await authenticate(request);
    const latitude = Number(request.nextUrl.searchParams.get("lat"));
    const longitude = Number(request.nextUrl.searchParams.get("lng"));
    if (!isApproximatelyInYangon(latitude, longitude)) {
      return NextResponse.json({ error: "Place the pin inside Yangon Region." }, { status: 400 });
    }

    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("zoom", "18");
    // Nominatim may ignore Accept-Language for Myanmar unless the preference
    // is also explicit in the query. English township names match the values
    // in our Yangon selector; road/ward names still fall back to local data.
    url.searchParams.set("accept-language", "en");
    const response = await fetch(url, {
      headers: { "User-Agent": "AphroditeMyanmar/1.0 (delivery address autofill)", "Accept-Language": "en,my;q=0.8" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Reverse geocoding failed: ${response.status}`);
    const result = await response.json() as NominatimResult;
    const address = result.address ?? {};
    const townshipCandidates = [address.city_district, address.town, address.suburb, address.county, address.city];
    const township = townshipCandidates.map(normalizeYangonTownship).find(Boolean) ?? null;
    const street = [address.road, address.neighbourhood, address.quarter, address.village]
      .filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index)
      .join(", ");
    return NextResponse.json({
      address: {
        address_line2: street || null,
        township,
        postal_code: address.postcode ?? null,
        formatted: result.display_name ?? null,
      },
    }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (error) {
    return handleRouteError("geocode.reverse", error);
  }
}
