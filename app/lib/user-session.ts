// Ordinary-customer session cookie. Mirrors app/lib/admin-session.ts: the
// login route stores the Supabase access token in an httpOnly cookie so the
// browser never has to persist tokens in localStorage (XSS-readable).
// Kept dependency-free so it is safe to import from the proxy (edge) bundle.

export const USER_SESSION_COOKIE = "aphrodite_session";

// Supabase access tokens are short-lived (~1hr); the cookie must not
// outlive the token it carries.
export const USER_SESSION_MAX_AGE_SECONDS = 60 * 60;
