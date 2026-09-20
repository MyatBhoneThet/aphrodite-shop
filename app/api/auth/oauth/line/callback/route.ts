import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@/app/lib/rate-limit";
import { setSessionCookies } from "@/app/lib/session-cookies";
import {
  createFederatedUser,
  createSessionForVerifiedEmail,
  getProfile,
  selectProfileByEmailService,
} from "@/app/lib/supabase";
import { lineCallbackUrl, resolveLineIdentity } from "@/app/lib/line-auth";
import {
  appOrigin,
  LINE_OAUTH_COOKIE,
  OAUTH_DEFAULT_NEXT_PATH,
  safeNextPath,
  timingSafeEquals,
} from "@/app/lib/oauth";

type LineOAuthCookie = {
  verifier?: unknown;
  state?: unknown;
  nonce?: unknown;
  next?: unknown;
};

/**
 * Step 2 of "Log in with your LINE account".
 *
 * Nothing here trusts the query string on its own. The `state` LINE echoes
 * back is compared against the cookie from step 1, the authorization code is
 * redeemed with that cookie's PKCE verifier and the channel secret, and the
 * id_token that comes back is handed to LINE's own verify endpoint together
 * with the `nonce`. Only after all three pass does an account get touched.
 *
 * The Supabase session is then minted server-side for the address LINE
 * vouched for, and lands in exactly the same httpOnly cookie a password login
 * uses. First-time customers get their profile from the same
 * `on_auth_user_created` trigger as everyone else -- always with the 'normal'
 * role, so LINE cannot grant wholesale or admin access.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const rateLimit = checkRateLimit(request, "oauth");

  if (!rateLimit.allowed) {
    return failure(request, "Too many sign-in attempts. Please try again in a minute.");
  }

  const stored = readCookie(request);

  // No cookie means this callback did not start in this browser, or it took
  // longer than the cookie's ten minutes.
  if (!stored) {
    return failure(request, "This sign-in link has expired. Please try again.");
  }

  const next = safeNextPath(stored.next, OAUTH_DEFAULT_NEXT_PATH);
  const returnedState = params.get("state") ?? "";

  if (!timingSafeEquals(returnedState, stored.state)) {
    console.warn("[auth.line.callback] state mismatch");
    return failure(request, "This sign-in link has expired. Please try again.");
  }

  // LINE (or the customer) declined. `error_description` comes from an
  // external service, so it is logged but never echoed into our page.
  if (params.get("error")) {
    console.warn("[auth.line.callback] provider error", {
      error: params.get("error"),
      description: params.get("error_description"),
    });
    return failure(request, "LINE sign-in was cancelled. Please try again.");
  }

  const authCode = params.get("code");

  if (!authCode) {
    return failure(request, "This sign-in link has expired. Please try again.");
  }

  try {
    const identity = await resolveLineIdentity({
      code: authCode,
      redirectUri: lineCallbackUrl(appOrigin()),
      codeVerifier: stored.verifier,
      nonce: stored.nonce,
    });

    if (!identity.email) {
      // The channel has not been granted LINE's email permission, or the
      // customer's LINE account has no address on it. There is nothing to
      // attach an order or a receipt to, so stop rather than invent one.
      return failure(
        request,
        "Your LINE account did not share an email address, so we could not sign you in. Please use Google, or your email and password."
      );
    }

    // An address LINE has verified is allowed to land in the account that
    // already owns it -- the same linking Supabase does for Google.
    if (!(await selectProfileByEmailService(identity.email))) {
      try {
        await createFederatedUser({
          email: identity.email,
          fullName: identity.name,
        });
      } catch (error) {
        // Two sign-ins for the same brand-new address can reach this at the
        // same time, and the loser is rejected for a duplicate email. It only
        // needs the account to exist, not to have been the one that made it.
        if (!(await selectProfileByEmailService(identity.email))) throw error;
      }
    }

    const session = await createSessionForVerifiedEmail(identity.email);
    const profile = await getProfile(session.user.id, session.access_token);
    const isAdmin = profile?.role === "admin";

    const response = NextResponse.redirect(
      new URL(isAdmin ? "/admin/dashboard" : next, request.url)
    );

    setSessionCookies(response, session.access_token, { isAdmin });
    response.cookies.delete(LINE_OAUTH_COOKIE);

    return response;
  } catch (error) {
    console.error("[auth.line.callback] failed", error);
    return failure(
      request,
      "Could not finish signing in with LINE. Please try again."
    );
  }
}

/**
 * The step-1 cookie, or null when it is missing, unparseable, or short of a
 * field. Every value is re-checked here because a cookie is still browser
 * input, even an httpOnly one.
 */
function readCookie(request: NextRequest) {
  const raw = request.cookies.get(LINE_OAUTH_COOKIE)?.value;

  if (!raw) return null;

  let parsed: LineOAuthCookie;

  try {
    parsed = JSON.parse(raw) as LineOAuthCookie;
  } catch {
    return null;
  }

  const { verifier, state, nonce, next } = parsed;

  if (
    typeof verifier !== "string" ||
    typeof state !== "string" ||
    typeof nonce !== "string" ||
    !verifier ||
    !state ||
    !nonce
  ) {
    return null;
  }

  return {
    verifier,
    state,
    nonce,
    next: typeof next === "string" ? next : null,
  };
}

function failure(request: NextRequest, message: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", message);

  const response = NextResponse.redirect(url);
  response.cookies.delete(LINE_OAUTH_COOKIE);

  return response;
}
