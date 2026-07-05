export function getAccessToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("aphrodite_access_token");
}

export function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function clearStoredAuth() {
  localStorage.removeItem("aphrodite_access_token");
  localStorage.removeItem("aphrodite_refresh_token");
  localStorage.removeItem("aphrodite_user");
}
