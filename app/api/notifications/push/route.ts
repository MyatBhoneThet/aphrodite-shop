import { NextResponse, type NextRequest } from "next/server";
import { authenticate } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { pushPublicKey, subscribePush, unsubscribePush } from "@/app/lib/notification-service";
import { checkRateLimit } from "@/app/lib/rate-limit";
import { readJsonBody } from "@/app/lib/request";

const noStore = { "Cache-Control": "private, no-store" };

/** The public key the browser needs to subscribe. It is public by design. */
export async function GET(request: NextRequest) {
  try {
    await authenticate(request);
    return NextResponse.json(await pushPublicKey(), { headers: noStore });
  } catch (error) {
    return handleRouteError("notifications.push.key", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!checkRateLimit(request, "register").allowed) {
      return NextResponse.json({ error: "Too many attempts. Please wait a minute." }, { status: 429 });
    }
    const user = await authenticate(request);
    await subscribePush(user, await readJsonBody(request), request.headers.get("user-agent"));
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return handleRouteError("notifications.push.subscribe", error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await authenticate(request);
    await unsubscribePush(user, await readJsonBody(request));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError("notifications.push.unsubscribe", error);
  }
}
