import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, oauthAuthorizeUrl } from "./supabase";
import { isLineLoginConfigured } from "./line-auth";
import {
  appOrigin,
  createCodeChallenge,
  createCodeVerifier,
  OAUTH_VERIFIER_COOKIE,
  OAUTH_VERIFIER_MAX_AGE_SECONDS,
  safeNextPath,
  SOCIAL_PROVIDERS,
  SOCIAL_PROVIDER_NAMES,
  type SocialProvider,
  type SupabaseSocialProvider,
} from "./oauth";

/**
 * Which social sign-ins this deployment offers, and the shared first leg of
 * the ones Supabase brokers.
 *
 * Separate from app/lib/oauth.ts so that module can stay a pure,
 * dependency-free helper: this one reaches for `next/server`, the Supabase
 * client and the LINE client.
 */

/**
 * Flags a provider cannot be used without.
 *
 * Google keeps its client id and secret in the Supabase dashboard, so a
 * working Supabase project is all this app needs for it. LINE is driven by
 * this app directly, so it needs its own channel credentials.
 */
function isProviderReady(provider: SocialProvider): boolean {
  if (provider === "line") return isLineLoginConfigured();

  return isSupabaseConfigured();
}

/**
 * Reads the operator's `SOCIAL_LOGIN_PROVIDERS` allow-list.
 *
 * Unset means "every provider this deployment can actually serve"; naming
 * providers narrows that, which is how a shop turns off, say, LINE without
 * removing any credentials. Unknown names are ignored rather than fatal -- a
 * typo in an environment variable should not take down the login page.
 */
function requestedProviders(): readonly SocialProvider[] {
  const configured = process.env.SOCIAL_LOGIN_PROVIDERS?.trim();

  if (!configured) return SOCIAL_PROVIDERS;

  const requested = new Set(
    configured
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );

  // Filtering SOCIAL_PROVIDERS (rather than mapping the input) keeps the
  // buttons in one fixed order, whatever order the variable lists them in.
  return SOCIAL_PROVIDERS.filter((provider) => requested.has(provider));
}

/**
 * The providers whose buttons should be drawn, in display order.
 *
 * Called from the server components behind /login and /register, so a
 * customer is never shown a button that cannot work -- and re-checked in the
 * sign-in routes, because a hidden button is a UI choice, not a boundary.
 */
export function enabledSocialProviders(): SocialProvider[] {
  return requestedProviders().filter(isProviderReady);
}

export function isSocialProviderEnabled(provider: SocialProvider) {
  return enabledSocialProviders().includes(provider);
}

/** Back to /login with a message the page shows above the password form. */
export function loginUrlWithError(request: NextRequest, message: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", message);
  return url;
}

/**
 * Step 1 of a Supabase-brokered sign-in (Google): send the browser to the
 * provider.
 *
 * The PKCE verifier minted here goes into an httpOnly cookie and is the only
 * thing that can redeem the authorization code the callback receives. The
 * provider is carried in the callback URL's query string, which Supabase
 * passes through untouched, so the callback can name the right service in any
 * message it has to show.
 */
export async function startSupabaseOAuth(
  request: NextRequest,
  provider: SupabaseSocialProvider
) {
  const name = SOCIAL_PROVIDER_NAMES[provider];

  if (!isSocialProviderEnabled(provider)) {
    return NextResponse.redirect(
      loginUrlWithError(
        request,
        `${name} sign-in is not set up on this store yet.`
      )
    );
  }

  // Where to land afterwards. Attacker-supplied values are dropped, so this
  // cannot be turned into an open redirect (see safeNextPath).
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const verifier = createCodeVerifier();
  const challenge = await createCodeChallenge(verifier);

  const callbackUrl = new URL("/api/auth/oauth/callback", appOrigin());
  callbackUrl.searchParams.set("next", next);
  callbackUrl.searchParams.set("provider", provider);

  const response = NextResponse.redirect(
    oauthAuthorizeUrl({
      provider,
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
