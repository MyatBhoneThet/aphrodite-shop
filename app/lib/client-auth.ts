import { AUTH_STORAGE_KEYS } from "./auth-storage";

export function getAccessToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_STORAGE_KEYS.accessToken);
}

export function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function storeAuth(session: {
  access_token?: string;
  refresh_token?: string;
  user: unknown;
}) {
  localStorage.setItem(AUTH_STORAGE_KEYS.user, JSON.stringify(session.user));

  if (session.access_token) {
    localStorage.setItem(AUTH_STORAGE_KEYS.accessToken, session.access_token);
  }

  if (session.refresh_token) {
    localStorage.setItem(AUTH_STORAGE_KEYS.refreshToken, session.refresh_token);
  }
}

export function clearStoredAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEYS.accessToken);
  localStorage.removeItem(AUTH_STORAGE_KEYS.refreshToken);
  localStorage.removeItem(AUTH_STORAGE_KEYS.user);
}

// Clears both the localStorage session (used by client-side fetches) and the
// httpOnly admin session cookie (used by proxy.ts to gate /admin/* routes).
export async function adminLogout() {
  await fetch("/api/admin/logout", { method: "POST" }).catch(() => null);
  clearStoredAuth();
}
