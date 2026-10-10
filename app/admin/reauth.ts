/**
 * "Confirm it's you" for risky admin actions.
 *
 * The server answers a risky request with 403 + code "reauth_required" when
 * the last password/code is older than ten minutes. fetchWithReauth catches
 * that, asks the admin through the dialog mounted on the admin page, and then
 * repeats the original request once.
 */
type Opener = () => Promise<boolean>;

let opener: Opener | null = null;

export function registerReauthOpener(next: Opener | null) {
  opener = next;
}

export async function fetchWithReauth(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  if (response.status !== 403 || !opener) return response;
  const body = (await response.clone().json().catch(() => null)) as { code?: string } | null;
  if (body?.code !== "reauth_required") return response;
  return (await opener()) ? fetch(input, init) : response;
}
