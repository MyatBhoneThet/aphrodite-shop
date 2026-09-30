// Shared by the admin login/logout route handlers, the server-side auth
// resolver (requireUserFromRequest), and proxy.ts -- kept dependency-free
// (no Node built-ins) so it's safe to import from the proxy (edge) bundle.

export const ADMIN_SESSION_COOKIE = "aphrodite_admin_session";

// Sign-in lasts 5 days, then the person is logged out automatically. The
// cookie carries the Supabase access token, so the Supabase project's JWT
// expiry must be set to the same 432000 seconds (Dashboard > Project Settings >
// JWT Keys / Auth); otherwise the token dies first and this cookie is moot.
export const ADMIN_SESSION_MAX_AGE_SECONDS = 5 * 24 * 60 * 60;

export function parseCookieHeader(header: string | null, name: string) {
  if (!header) return undefined;

  for (const part of header.split(";")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = part.slice(0, separatorIndex).trim();
    if (key !== name) continue;

    const value = part.slice(separatorIndex + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return undefined;
}
