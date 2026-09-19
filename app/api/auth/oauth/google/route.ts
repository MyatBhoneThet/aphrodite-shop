import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, oauthAuthorizeUrl } from "@/app/lib/supabase";
import { checkRateLimit } from "@/app/lib/rate-limit";
import {
  appOrigin,
  createCodeChallenge,
  createCodeVerifier,
  OAUTH_VERIFIER_COOKIE,
  OAUTH_VERIFIER_MAX_AGE_SECONDS,
  safeNextPath,
} from "@/app/lib/oauth";

/**
 * Step 1 of "Continue with Google": send the browser to Google via Supabase.
 *
 * A GET so the sign-in control can be a plain link -- no form, no JavaScript,
 * and nothing for the Content-Security-Policy to allow. The PKCE verifier
 * generated here is kept in an httpOnly cookie and is the only thing that can
 * redeem the authorization code the callback receives.
 */
export async function GET(request: NextRequest) {
  const rateLimit = checkRateLimit(request, "oauth");

  if (!rateLimit.allowed) {
    return NextResponse.redirect(
      loginUrlWithError(request, "Too many sign-in attempts. Please try again in a minute.")
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(
      loginUrlWithError(request, "Google sign-in is not set up on this store yet.")
    );
  }

  // Where to land afterwards. Attacker-supplied values are dropped, so this
  // cannot be turned into an open redirect (see safeNextPath).
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const verifier = createCodeVerifier();
  const challenge = await createCodeChallenge(verifier);

  const callbackUrl = new URL("/api/auth/oauth/callback", appOrigin());
  callbackUrl.searchParams.set("next", next);

  const response = NextResponse.redirect(
    oauthAuthorizeUrl({
      provider: "google",
      redirectTo: callbackUrl.toString(),
      codeChallenge: challenge,
    })
  );

  // SameSite=Lax (not Strict): the callback arrives as a top-level navigation
  // from Supabase, and Strict would withhold the cookie exactly then.
  response.cookies.set(OAUTH_VERIFIER_COOKIE, verifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: OAUTH_VERIFIER_MAX_AGE_SECONDS,
  });

  return response;
}

function loginUrlWithError(request: NextRequest, message: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", message);
  return url;
}
