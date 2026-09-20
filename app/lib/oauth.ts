/**
 * PKCE plumbing shared by every social sign-in: Google, Facebook and LINE.
 *
 * The whole OAuth exchange happens on the server: the browser is only ever
 * redirected. The provider hands back a short-lived *authorization code*,
 * which this app swaps for an access token server-side and stores in the same
 * httpOnly cookie the password login uses. That is why PKCE is used instead
 * of Supabase's default implicit flow -- implicit returns the access token in
 * the URL fragment, where client JS (and any XSS payload) can read it.
 *
 * The code verifier is the secret half of the exchange. It is generated here,
 * kept in its own httpOnly cookie for the few seconds the user spends at the
 * provider, and required to redeem the code. That also makes the callback
 * CSRF-safe: a code injected by somebody else cannot be redeemed without the
 * verifier this browser holds.
 *
 * Web Crypto only (no node:crypto), so this stays usable from any runtime.
 *
 * Kept free of `next/server` and of Supabase imports on purpose: the sign-in
 * routes, the server components that decide which buttons to draw, and the
 * unit tests all pull from here, so it must stay cheap and side-effect free.
 * The parts that need a request or a Supabase call live in
 * app/lib/social-login.ts.
 */

/** Every provider the shop can offer, in the order the buttons appear. */
export const SOCIAL_PROVIDERS = ["google", "facebook", "line"] as const;

export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

/**
 * The providers Supabase itself brokers. Their credentials live in the
 * Supabase dashboard, so this app needs no keys for them -- unlike LINE,
 * which Supabase has no provider for and which this app therefore drives
 * itself (app/lib/line-auth.ts).
 *
 */
export const SUPABASE_SOCIAL_PROVIDERS = ["google", "facebook"] as const;

export type SupabaseSocialProvider = (typeof SUPABASE_SOCIAL_PROVIDERS)[number];

export function isSupabaseSocialProvider(
  value: string
): value is SupabaseSocialProvider {
  return (SUPABASE_SOCIAL_PROVIDERS as readonly string[]).includes(value);
}

/** Provider name as it should read in a message shown to a customer. */
export const SOCIAL_PROVIDER_NAMES: Record<SocialProvider, string> = {
  google: "Google",
  facebook: "Facebook",
  line: "LINE",
};

export const OAUTH_VERIFIER_COOKIE = "aphrodite_oauth_verifier";

/**
 * LINE's leg of the journey carries more than a verifier: it also needs the
 * CSRF `state`, the id_token `nonce`, and the post-login destination, because
 * LINE matches the registered callback URL exactly and will not carry a
 * `?next=` of ours through the round trip.
 */
export const LINE_OAUTH_COOKIE = "aphrodite_line_oauth";

/** The user only needs long enough to pick an account at the provider. */
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

/**
 * An unguessable one-off value, used for LINE's `state` (CSRF) and `nonce`
 * (id_token replay). Same generator as the PKCE verifier -- 256 bits of
 * `crypto.getRandomValues` -- under a name that says what it is for.
 */
export const createRandomToken = createCodeVerifier;

/**
 * Constant-time string comparison, for checking a value the browser sent back
 * against the one we stored. `===` leaks how much of the prefix matched
 * through its timing, which is exactly the signal needed to guess a `state`
 * byte by byte.
 */
export function timingSafeEquals(a: string, b: string) {
  if (a.length !== b.length) return false;

  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return mismatch === 0;
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
