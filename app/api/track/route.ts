import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@/app/lib/rate-limit";
import { handleRouteError } from "@/app/lib/errors";
import { readJsonBody } from "@/app/lib/request";
import { selectOrdersByPhoneTailService } from "@/app/lib/supabase";
import {
  guestTrackingView,
  orderCodeMatches,
  phoneTail,
  phonesMatch,
} from "@/app/lib/guest-tracking";

/**
 * "Where is my order?", without signing in.
 *
 * The caller must produce both the order code from their confirmation email
 * and the phone number on the order. The lookup runs service-role, because
 * there is no session to run it under -- which is exactly why everything this
 * route can return goes through guestTrackingView() first.
 *
 * POST, not GET, so the phone number stays out of URLs, browser history,
 * referrer headers and server access logs.
 *
 * A wrong code and a wrong phone give the same answer, with no hint which was
 * wrong: otherwise the endpoint becomes a way to find out whether a given
 * phone number has ever ordered here.
 */
const NOT_FOUND =
  "We could not find an order with that code and phone number. Please check the order code in your confirmation email and the phone number used for delivery.";

export async function POST(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(request, "track");

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many lookups. Please try again in a minute." },
        { status: 429 }
      );
    }

    const body = (await readJsonBody(request)) as {
      code?: unknown;
      phone?: unknown;
    };
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";

    if (!code || !phone) {
      return NextResponse.json(
        { error: "Enter both your order code and your phone number." },
        { status: 400 }
      );
    }

    const tail = phoneTail(phone);

    if (tail.length < 6) {
      return NextResponse.json(
        { error: "That phone number looks too short." },
        { status: 400 }
      );
    }

    const candidates = await selectOrdersByPhoneTailService(tail);
    // `like.*tail` only narrows the rows; these two checks are what actually
    // authorise the answer, and both have to pass.
    const order = candidates.find(
      (row) =>
        phonesMatch(row.shipping_phone ?? "", phone) &&
        orderCodeMatches(row.id, code)
    );

    if (!order) {
      return NextResponse.json({ error: NOT_FOUND }, { status: 404 });
    }

    return NextResponse.json({ tracking: guestTrackingView(order) });
  } catch (error) {
    return handleRouteError("track.lookup", error);
  }
}
