import { AUTH_STORAGE_KEYS } from "./auth-storage";

// Sessions now live in httpOnly cookies set by the login routes; the browser
// sends them automatically on same-origin fetches, so new logins never touch
// localStorage. getAccessToken() only remains so sessions created BEFORE the
// cookie migration keep working until their token expires (~1h).
export function getAccessToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_STORAGE_KEYS.accessToken);
}

export function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function clearStoredAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEYS.accessToken);
  localStorage.removeItem(AUTH_STORAGE_KEYS.refreshToken);
  localStorage.removeItem(AUTH_STORAGE_KEYS.user);
}

// Clears both the localStorage remnants (legacy sessions) and the httpOnly
// session cookies (used by proxy.ts to gate /admin/* routes).
export async function adminLogout() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
  await fetch("/api/admin/logout", { method: "POST" }).catch(() => null);
  clearStoredAuth();
}
