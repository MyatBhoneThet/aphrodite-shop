// Ordinary-customer session cookie. Mirrors app/lib/admin-session.ts: the
// login route stores the Supabase access token in an httpOnly cookie so the
// browser never has to persist tokens in localStorage (XSS-readable).
// Kept dependency-free so it is safe to import from the proxy (edge) bundle.

export const USER_SESSION_COOKIE = "aphrodite_session";

// Sign-in lasts 5 days, then the person is logged out automatically. The
// cookie carries the Supabase access token, so the Supabase project's JWT
// expiry must be set to the same 432000 seconds (Dashboard > Project Settings >
// JWT Keys / Auth); otherwise the token dies first and this cookie is moot.
export const USER_SESSION_MAX_AGE_SECONDS = 5 * 24 * 60 * 60;
