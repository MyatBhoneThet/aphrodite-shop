import { NextResponse, type NextRequest } from "next/server";
import { exchangeOAuthCode, getProfile } from "@/app/lib/supabase";
import { checkRateLimit } from "@/app/lib/rate-limit";
import { setSessionCookies } from "@/app/lib/session-cookies";
import {
  appOrigin,
  isSupabaseSocialProvider,
  OAUTH_VERIFIER_COOKIE,
  safeNextPath,
  SOCIAL_PROVIDER_NAMES,
} from "@/app/lib/oauth";

/**
 * Step 2 of a Supabase-brokered sign-in (Google): Supabase sends the browser
 * back here with a one-time authorization code.
 *
 * The code is swapped for a session on the server, using the PKCE verifier
 * cookie set in step 1, and the access token goes straight into the same
 * httpOnly cookie a password login uses. The token is never written into the
 * page, the URL, or localStorage.
 *
 * The profile row itself is created by the `on_auth_user_created` trigger in
 * supabase/schema.sql, which always assigns the 'normal' role -- signing in
 * with a social account cannot grant wholesale or admin access.
 *
 * LINE does not come through here: Supabase has no LINE provider, so that one
 * has its own callback at /api/auth/oauth/line/callback.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNextPath(params.get("next"));
  // Set by the start route. Only used to name the service in a message, and
  // it comes back through Supabase, so it is treated as untrusted: anything
  // unrecognised degrades to the generic wording.
  const provider = params.get("provider") ?? "";
  const name = isSupabaseSocialProvider(provider)
    ? SOCIAL_PROVIDER_NAMES[provider]
    : "Social";

  const rateLimit = checkRateLimit(request, "oauth");

  if (!rateLimit.allowed) {
    return failure("Too many sign-in attempts. Please try again in a minute.");
  }

  const providerError = params.get("error");

  if (providerError) {
    // `error_description` comes from an external service, so it is logged but
    // never echoed back into our page.
    console.warn("[auth.oauth.callback] provider error", {
      provider,
      error: providerError,
      code: params.get("error_code"),
      description: params.get("error_description"),
    });

    // `access_denied` is the customer changing their mind at the provider's
    // consent screen. Anything else reaching this point is a configuration
    // problem -- most often the provider not being enabled in Supabase --
    // and saying so saves the shop a long hunt.
    return failure(
      providerError === "access_denied"
        ? `${name} sign-in was cancelled. Please try again.`
        : `${name} sign-in could not be completed. If this keeps happening, the store may not have finished setting up ${name} sign-in.`
    );
  }

  const authCode = params.get("code");
  const verifier = request.cookies.get(OAUTH_VERIFIER_COOKIE)?.value;

  if (!authCode || !verifier) {
    // A missing verifier means this callback did not start in this browser
    // (or took longer than the cookie's ten minutes).
    return failure("This sign-in link has expired. Please try again.");
  }

  try {
    const session = await exchangeOAuthCode(authCode, verifier);
    const profile = await getProfile(session.user.id, session.access_token);

    const destination = profile?.role === "admin" ? "/admin/dashboard" : next;
    // The server URL may use an internal host such as 0.0.0.0 behind a proxy.
    // Use the same public origin as the OAuth start route.
    const response = NextResponse.redirect(new URL(destination, appOrigin()));

    setSessionCookies(response, session.access_token, {
      isAdmin: profile?.role === "admin",
    });
    // The verifier is single-use; leaving it behind would only widen the
    // window in which a replayed code could be redeemed.
    response.cookies.delete(OAUTH_VERIFIER_COOKIE);

    return response;
  } catch (error) {
    console.error("[auth.oauth.callback] failed", { provider, error });
    return failure(
      `Could not finish signing in with ${name}. Please try again.`
    );
  }
}

function failure(message: string) {
  const url = new URL("/login", appOrigin());
  url.searchParams.set("error", message);

  const response = NextResponse.redirect(url);
  response.cookies.delete(OAUTH_VERIFIER_COOKIE);

  return response;
}
