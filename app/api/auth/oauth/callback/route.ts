import { NextResponse, type NextRequest } from "next/server";
import { exchangeOAuthCode, getProfile } from "@/app/lib/supabase";
import { checkRateLimit } from "@/app/lib/rate-limit";
import { setSessionCookies } from "@/app/lib/session-cookies";
import { OAUTH_VERIFIER_COOKIE, safeNextPath } from "@/app/lib/oauth";

/**
 * Step 2 of "Continue with Google": Supabase sends the browser back here with
 * a one-time authorization code.
 *
 * The code is swapped for a session on the server, using the PKCE verifier
 * cookie set in step 1, and the access token goes straight into the same
 * httpOnly cookie a password login uses. The token is never written into the
 * page, the URL, or localStorage.
 *
 * The profile row itself is created by the `on_auth_user_created` trigger in
 * supabase/schema.sql, which always assigns the 'normal' role -- signing in
 * with Google cannot grant wholesale or admin access.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNextPath(params.get("next"));

  const rateLimit = checkRateLimit(request, "oauth");

  if (!rateLimit.allowed) {
    return failure(request, "Too many sign-in attempts. Please try again in a minute.");
  }

  // Google (or the user) declined. `error_description` comes from an external
  // service, so it is never echoed back into our page.
  if (params.get("error")) {
    console.warn("[auth.oauth.callback] provider error", {
      error: params.get("error"),
      code: params.get("error_code"),
    });
    return failure(request, "Google sign-in was cancelled. Please try again.");
  }

  const authCode = params.get("code");
  const verifier = request.cookies.get(OAUTH_VERIFIER_COOKIE)?.value;

  if (!authCode || !verifier) {
    // A missing verifier means this callback did not start in this browser
    // (or took longer than the cookie's ten minutes).
    return failure(request, "This sign-in link has expired. Please try again.");
  }

  try {
    const session = await exchangeOAuthCode(authCode, verifier);
    const profile = await getProfile(session.user.id, session.access_token);

    const destination = profile?.role === "admin" ? "/admin/dashboard" : next;
    const response = NextResponse.redirect(new URL(destination, request.url));

    setSessionCookies(response, session.access_token, {
      isAdmin: profile?.role === "admin",
    });
    // The verifier is single-use; leaving it behind would only widen the
    // window in which a replayed code could be redeemed.
    response.cookies.delete(OAUTH_VERIFIER_COOKIE);

    return response;
  } catch (error) {
    console.error("[auth.oauth.callback] failed", error);
    return failure(request, "Could not finish signing in with Google. Please try again.");
  }
}

function failure(request: NextRequest, message: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", message);

  const response = NextResponse.redirect(url);
  response.cookies.delete(OAUTH_VERIFIER_COOKIE);

  return response;
}
