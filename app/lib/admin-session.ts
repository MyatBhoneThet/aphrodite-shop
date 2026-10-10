// Shared by the admin login/logout route handlers, the server-side auth
// resolver (requireUserFromRequest), and proxy.ts -- kept dependency-free
// (no Node built-ins) so it's safe to import from the proxy (edge) bundle.

export const ADMIN_SESSION_COOKIE = "aphrodite_admin_session";

// Admin and staff sign-ins last 12 hours, much shorter than the 5 days
// customers get: a stolen back-office session is the costly kind. The cookie
// carries the Supabase access token, so the project's JWT expiry (Dashboard >
// Authentication > Sessions) has to be at least this long for the full 12 hours.
export const ADMIN_SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

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
