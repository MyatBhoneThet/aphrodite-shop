/**
 * PKCE plumbing for "Continue with Google".
 *
 * The whole OAuth exchange happens on the server: the browser is only ever
 * redirected. Supabase hands back a short-lived *authorization code*, which
 * this app swaps for an access token server-side and stores in the same
 * httpOnly cookie the password login uses. That is why PKCE is used instead
 * of Supabase's default implicit flow -- implicit returns the access token in
 * the URL fragment, where client JS (and any XSS payload) can read it.
 *
 * The code verifier is the secret half of the exchange. It is generated here,
 * kept in its own httpOnly cookie for the few seconds the user spends on
 * Google, and required to redeem the code. That also makes the callback
 * CSRF-safe: a code injected by somebody else cannot be redeemed without the
 * verifier this browser holds.
 *
 * Web Crypto only (no node:crypto), so this stays usable from any runtime.
 */

export const OAUTH_VERIFIER_COOKIE = "aphrodite_oauth_verifier";

/** The user only needs long enough to pick a Google account. */
export const OAUTH_VERIFIER_MAX_AGE_SECONDS = 60 * 10;

/** Where to send the browser after a successful sign-in, when none is given. */
export const OAUTH_DEFAULT_NEXT_PATH = "/delivery-area";

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

/** A fresh PKCE code verifier (43 characters, the RFC 7636 minimum). */
export function createCodeVerifier() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

/** The S256 challenge Supabase stores against the authorization code. */
export async function createCodeChallenge(verifier: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier)
  );

  return base64Url(new Uint8Array(digest));
}

/**
 * Narrows a `?next=` value to a path on this site.
 *
 * Without this, `/api/auth/oauth/google?next=https://evil.example` would turn
 * the sign-in button into an open redirect -- a phishing page that genuinely
 * starts at the shop's own domain. Anything that is not a single-slash
 * relative path (including "//evil.example", "/\evil.example", and values
 * carrying control characters) falls back to the default.
 */
export function safeNextPath(
  value: string | null | undefined,
  fallback: string = OAUTH_DEFAULT_NEXT_PATH
) {
  if (!value || !value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;

  // Control characters (a newline especially) could split a Location header.
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return fallback;
  }

  return value;
}

/**
 * The site's own origin, used to build the callback URL Supabase redirects
 * back to. It must match an entry in the Supabase project's redirect
 * allow-list, so it is taken from configuration rather than from the incoming
 * request (a forged Host header must not be able to move the callback).
 */
export function appOrigin(env: NodeJS.ProcessEnv = process.env) {
  return (
    env.APP_URL ||
    env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}
