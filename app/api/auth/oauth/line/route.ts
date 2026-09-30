import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@/app/lib/rate-limit";
import { isSocialProviderEnabled, loginUrlWithError } from "@/app/lib/social-login";
import { lineAuthorizeUrl, lineCallbackUrl } from "@/app/lib/line-auth";
import {
  appOrigin,
  createCodeChallenge,
  createCodeVerifier,
  createRandomToken,
  LINE_OAUTH_COOKIE,
  OAUTH_VERIFIER_MAX_AGE_SECONDS,
  safeNextPath,
} from "@/app/lib/oauth";

/**
 * Step 1 of "Log in with your LINE account": send the browser to LINE.
 *
 * Supabase has no LINE provider, so this app is the OAuth client itself. That
 * means carrying three secrets across the round trip instead of one, and they
 * all travel together in a single httpOnly cookie:
 *
 *  - `verifier` -- PKCE, redeems the authorization code.
 *  - `state`    -- compared on the way back, so a code cannot be planted in
 *                  this browser from elsewhere.
 *  - `nonce`    -- echoed inside LINE's id_token, so an old token cannot be
 *                  replayed.
 *
 * `next` rides in the cookie too, because LINE matches the channel's
 * registered callback URL exactly and a `?next=` of ours would not survive.
 */
export async function GET(request: NextRequest) {
  const rateLimit = checkRateLimit(request, "oauth");

  if (!rateLimit.allowed) {
    return NextResponse.redirect(
      loginUrlWithError(
        request,
        "Too many sign-in attempts. Please try again in a minute."
      )
    );
  }

  if (!isSocialProviderEnabled("line")) {
    return NextResponse.redirect(
      loginUrlWithError(request, "LINE sign-in is not set up on this store yet.")
    );
  }

  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const verifier = createCodeVerifier();
  const challenge = await createCodeChallenge(verifier);
  const state = createRandomToken();
  const nonce = createRandomToken();

  // Built from APP_URL, not from the incoming request, so a forged Host
  // header cannot move the callback -- and so it matches the address
  // registered with the LINE channel character for character.
  const redirectUri = lineCallbackUrl(appOrigin());

  const response = NextResponse.redirect(
    lineAuthorizeUrl({ redirectUri, state, nonce, codeChallenge: challenge })
  );

  // SameSite=Lax (not Strict): the callback arrives as a top-level navigation
  // from LINE, and Strict would withhold the cookie exactly then.
  response.cookies.set(
    LINE_OAUTH_COOKIE,
    JSON.stringify({ verifier, state, nonce, next }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: OAUTH_VERIFIER_MAX_AGE_SECONDS,
    }
  );

  return response;
}
