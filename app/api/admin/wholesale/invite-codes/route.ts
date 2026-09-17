import { NextResponse, type NextRequest } from "next/server";
import {
  adminCreateInviteCode,
  adminListInviteCodes,
  authenticate,
} from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { readJsonBody } from "@/app/lib/request";
import { firstIssueMessage, inviteCodeInputSchema } from "@/app/lib/validation";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    const codes = await adminListInviteCodes(user);

    return NextResponse.json({ codes });
  } catch (error) {
    return handleRouteError("admin.invite-codes.list", error);
  }
}

// The response contains the PLAIN code exactly once -- only the hash is
// stored, so it can never be shown again.
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    const parsed = inviteCodeInputSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      return NextResponse.json(
        { error: firstIssueMessage(parsed.error) },
        { status: 400 }
      );
    }

    const created = await adminCreateInviteCode(user, parsed.data);

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleRouteError("admin.invite-codes.create", error);
  }
}
