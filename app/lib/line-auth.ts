/**
 * "Log in with your LINE account", driven by this app rather than by Supabase.
 *
 * Supabase's GoTrue has no LINE provider, so unlike Google the whole
 * OAuth 2.1 / OpenID Connect exchange with LINE happens here, and only once
 * LINE has vouched for the customer's address does the app mint a Supabase
 * session for it (see createSessionForVerifiedEmail in app/lib/supabase.ts).
 *
 * Three things keep that safe, and all three are checked before any session
 * exists:
 *
 *  - `state`, compared against an httpOnly cookie, so a code from somebody
 *    else's browser cannot be planted in this one (CSRF).
 *  - PKCE, so the authorization code is worthless without the verifier this
 *    browser holds -- LINE Login v2.1 supports S256 alongside the channel
 *    secret.
 *  - `nonce`, echoed inside the id_token and re-checked by LINE's own verify
 *    endpoint, so an id_token captured from an earlier sign-in cannot be
 *    replayed into this one.
 *
 * The id_token is deliberately verified by calling LINE
 * (`/oauth2/v2.1/verify`) instead of parsing the JWT here: LINE checks the
 * signature, issuer, audience, expiry and nonce in one request, so this app
 * never has to fetch or cache LINE's signing keys.
 */

const LINE_AUTHORIZE_URL = "https://access.line.me/oauth2/v2.1/authorize";
const LINE_TOKEN_URL = "https://api.line.me/oauth2/v2.1/token";
const LINE_VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";

/**
 * `email` needs the one-off "Email address permission" granted to the channel
 * in the LINE Developers console. Without an address there is no account to
 * sign in to, so the callback stops and says so rather than inventing one.
 */
const LINE_SCOPE = "openid profile email";

/** LINE, like every other upstream here, must not be able to hang a request. */
const LINE_TIMEOUT_MS = 10_000;

export type LineProfileClaims = {
  /** LINE's stable per-channel user id. */
  sub: string;
  email: string | null;
  name: string | null;
};

type LineTokenResponse = {
  access_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

type LineVerifyResponse = {
  sub?: string;
  email?: string;
  name?: string;
  error?: string;
  error_description?: string;
};

export function isLineLoginConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.LINE_LOGIN_CHANNEL_ID && env.LINE_LOGIN_CHANNEL_SECRET);
}

function requireLineConfig(env: NodeJS.ProcessEnv = process.env) {
  const channelId = env.LINE_LOGIN_CHANNEL_ID;
  const channelSecret = env.LINE_LOGIN_CHANNEL_SECRET;

  if (!channelId || !channelSecret) {
    throw new Error("LINE login is not configured.");
  }

  return { channelId, channelSecret };
}

/**
 * The one callback address LINE is allowed to return to.
 *
 * LINE matches this against the channel's registered Callback URL character
 * for character, so it carries no query string -- everything the callback
 * needs to remember (destination, state, nonce, verifier) rides in the
 * httpOnly cookie instead.
 */
export function lineCallbackUrl(origin: string) {
  return `${origin}/api/auth/oauth/line/callback`;
}

export function lineAuthorizeUrl({
  redirectUri,
  state,
  nonce,
  codeChallenge,
  env = process.env,
}: {
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
  env?: NodeJS.ProcessEnv;
}) {
  const { channelId } = requireLineConfig(env);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: channelId,
    redirect_uri: redirectUri,
    state,
    scope: LINE_SCOPE,
    nonce,
    code_challenge: codeChallenge,
    // LINE spells the method in upper case, unlike GoTrue's "s256".
    code_challenge_method: "S256",
  });

  return `${LINE_AUTHORIZE_URL}?${params.toString()}`;
}

async function linePost(url: string, body: URLSearchParams) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(LINE_TIMEOUT_MS),
  });

  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    error_description?: string;
  };

  if (!response.ok || data.error) {
    // LINE's own wording is for developers, not customers: it is logged by the
    // caller and never shown in the page.
    throw new Error(
      data.error_description || data.error || `LINE request failed: ${response.status}`
    );
  }

  return data;
}

/** Swaps the authorization code for LINE's tokens, using PKCE + the secret. */
async function exchangeLineCode({
  code,
  redirectUri,
  codeVerifier,
  env = process.env,
}: {
  code: string;
  redirectUri: string;
  codeVerifier: string;
  env?: NodeJS.ProcessEnv;
}) {
  const { channelId, channelSecret } = requireLineConfig(env);

  const data = (await linePost(
    LINE_TOKEN_URL,
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: channelId,
      client_secret: channelSecret,
      code_verifier: codeVerifier,
    })
  )) as LineTokenResponse;

  if (!data.id_token) {
    throw new Error("LINE did not return an id_token.");
  }

  return data.id_token;
}

/**
 * Hands the id_token back to LINE for verification.
 *
 * Passing `nonce` matters: it makes LINE reject a token minted for a
 * different sign-in attempt, and passing `client_id` makes it reject one
 * minted for a different channel.
 */
async function verifyLineIdToken({
  idToken,
  nonce,
  env = process.env,
}: {
  idToken: string;
  nonce: string;
  env?: NodeJS.ProcessEnv;
}): Promise<LineProfileClaims> {
  const { channelId } = requireLineConfig(env);

  const data = (await linePost(
    LINE_VERIFY_URL,
    new URLSearchParams({
      id_token: idToken,
      client_id: channelId,
      nonce,
    })
  )) as LineVerifyResponse;

  if (!data.sub) {
    throw new Error("LINE did not return a verified user.");
  }

  return {
    sub: data.sub,
    // GoTrue stores addresses folded to lower case; matching that here keeps
    // "Name@line.me" and "name@line.me" from becoming two accounts.
    email: data.email?.trim().toLowerCase() || null,
    name: data.name?.trim() || null,
  };
}

/**
 * The full code-for-identity exchange: one call for the callback route.
 *
 * Returns only what the app needs to create or find an account. The LINE
 * access token is deliberately dropped on the floor -- the shop has no use
 * for LINE's own APIs, and not keeping it is one less credential to protect.
 */
export async function resolveLineIdentity({
  code,
  redirectUri,
  codeVerifier,
  nonce,
  env = process.env,
}: {
  code: string;
  redirectUri: string;
  codeVerifier: string;
  nonce: string;
  env?: NodeJS.ProcessEnv;
}) {
  const idToken = await exchangeLineCode({ code, redirectUri, codeVerifier, env });

  return verifyLineIdToken({ idToken, nonce, env });
}
