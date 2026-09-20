import { NextResponse, type NextRequest } from "next/server";
import { adminDeactivateInviteCode, authenticate } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";

export const runtime = "nodejs";

// Turning a code off is reversible-by-reissue and never deletes the audit
// trail of who already redeemed it, so it needs no extra confirmation.
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request);
    const { id } = await context.params;
    const invite = await adminDeactivateInviteCode(user, id);

    return NextResponse.json({ invite });
  } catch (error) {
    return handleRouteError("admin.invite-codes.deactivate", error);
  }
}
