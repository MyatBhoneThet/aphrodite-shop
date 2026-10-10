import { NextResponse, type NextRequest } from "next/server";
import { badRequest, handleRouteError } from "@/app/lib/errors";
import { authenticateBackoffice } from "@/app/lib/mfa-routes";
import { readJsonBody } from "@/app/lib/request";
import { setSessionCookies } from "@/app/lib/session-cookies";
import { loginUser } from "@/app/lib/supabase";

/**
 * "Enter your password again" for back-office accounts that have no
 * authenticator yet. Accounts with one confirm a code instead.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateBackoffice(request, { limit: true });
    if (user.mfa.enrolled) throw badRequest("Use the 6-digit code from your authenticator app.");
    const body = (await readJsonBody(request)) as { password?: unknown } | null;
    const password = typeof body?.password === "string" ? body.password : "";
    if (!password) throw badRequest("Enter your password.");

    let session;
    try {
      session = await loginUser(user.email, password);
    } catch {
      throw badRequest("That password is not right.");
    }
    return setSessionCookies(NextResponse.json({ ok: true }), session.access_token, { isBackoffice: true });
  } catch (error) {
    return handleRouteError("auth.reauth", error);
  }
}
