import { NextResponse, type NextRequest } from "next/server";
import { recordAdminAction } from "@/app/lib/admin-audit";
import { scheduleSignInAlert } from "@/app/lib/admin-signin";
import { badRequest, handleRouteError } from "@/app/lib/errors";
import { authenticateBackoffice, parseCode } from "@/app/lib/mfa-routes";
import { readJsonBody } from "@/app/lib/request";
import { setSessionCookies } from "@/app/lib/session-cookies";
import { mfaChallengeAndVerify } from "@/app/lib/supabase";

/**
 * Confirms a six-digit code. Used to finish sign-in, to confirm a newly
 * scanned authenticator, and to re-confirm before a risky action. Supabase
 * answers with a stronger session, which replaces the cookies.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateBackoffice(request, { limit: true });
    const body = (await readJsonBody(request)) as { code?: unknown; factor_id?: unknown } | null;
    const code = parseCode(body?.code);
    const totps = user.mfa.factors.filter((factor) => factor.factor_type === "totp");
    const requested = typeof body?.factor_id === "string" ? body.factor_id : null;
    const factor = requested
      ? totps.find((entry) => entry.id === requested)
      : totps.find((entry) => entry.status === "verified");
    if (!factor) throw badRequest("Set up your authenticator first.");

    let session;
    try {
      session = await mfaChallengeAndVerify(user.accessToken, factor.id, code);
    } catch {
      throw badRequest("That code did not work. Check the 6 digits and try again; they change every 30 seconds.");
    }

    if (factor.status !== "verified") {
      await recordAdminAction({ actorId: user.id, action: "auth.mfa.enrolled", targetType: "profile", targetId: user.id, next: { factor: factor.id } });
    }
    // The sign-in alert goes out now for an account that was being held back.
    if (user.mfa.pending) scheduleSignInAlert(request, { ...user.profile, role: user.mfa.realRole as "admin" | "staff" }, "Password + authenticator code");

    return setSessionCookies(NextResponse.json({ ok: true }), session.access_token, { isBackoffice: true });
  } catch (error) {
    return handleRouteError("auth.mfa.verify", error);
  }
}
