import { NextResponse, type NextRequest } from "next/server";
import { authenticate, getAdminPresence, setAdminPresence } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { readJsonBody } from "@/app/lib/request";
import { adminPresenceSchema, firstIssueMessage } from "@/app/lib/validation";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await authenticate(request);
    return NextResponse.json({ presence: await getAdminPresence() });
  } catch (error) {
    return handleRouteError("admin.presence.get", error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await authenticate(request);
    const parsed = adminPresenceSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      return NextResponse.json(
        { error: firstIssueMessage(parsed.error) },
        { status: 400 }
      );
    }

    return NextResponse.json({
      presence: await setAdminPresence(user, parsed.data),
    });
  } catch (error) {
    return handleRouteError("admin.presence.set", error);
  }
}
