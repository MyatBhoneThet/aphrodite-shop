import { NextResponse, type NextRequest } from "next/server";
import { authenticate } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { markRead } from "@/app/lib/notification-service";
import { readJsonBody } from "@/app/lib/request";

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    await markRead(user, await readJsonBody(request));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError("notifications.read", error);
  }
}
