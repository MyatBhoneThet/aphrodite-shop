import { NextResponse, type NextRequest } from "next/server";
import { authenticate } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    // Back-office accounts also learn whether a two-step code is still owed;
    // the role in `user` is already "normal" until it has been entered.
    const mfa = user.mfa && ["admin", "staff"].includes(user.mfa.realRole)
      ? { pending: user.mfa.pending, enrolled: user.mfa.enrolled, realRole: user.mfa.realRole }
      : undefined;
    return NextResponse.json({ profile: user.profile, user: mfa ? { ...user.profile, mfa } : user.profile });
  } catch (error) {
    return handleRouteError("auth.me", error);
  }
}
