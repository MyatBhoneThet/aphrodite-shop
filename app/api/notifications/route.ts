import { NextResponse, type NextRequest } from "next/server";
import { authenticate } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { listNotifications } from "@/app/lib/notification-service";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    return NextResponse.json(await listNotifications(user), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return handleRouteError("notifications.list", error);
  }
}
