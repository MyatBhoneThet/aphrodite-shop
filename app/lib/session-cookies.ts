import type { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
} from "./admin-session";
import {
  USER_SESSION_COOKIE,
  USER_SESSION_MAX_AGE_SECONDS,
} from "./user-session";

/**
 * Writes the httpOnly session cookies for a freshly signed-in account.
 *
 * Shared by every route that can create a session (password login, Google
 * sign-in) so they cannot drift apart on the flags that matter: the access
 * token is httpOnly (never readable by client JS, so an XSS payload cannot
 * steal it), secure in production, and SameSite=Lax.
 *
 * Back-office users also get the admin-area cookie, exactly as
 * /api/admin/login does, so
 * signing in once is enough to reach /admin. The role comes from the
 * profiles table server-side -- never from the request.
 */
export function setSessionCookies(
  response: NextResponse,
  accessToken: string,
  { isBackoffice }: { isBackoffice: boolean }
) {
  const shared = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };

  response.cookies.set(USER_SESSION_COOKIE, accessToken, {
    ...shared,
    maxAge: USER_SESSION_MAX_AGE_SECONDS,
  });

  if (isBackoffice) {
    response.cookies.set(ADMIN_SESSION_COOKIE, accessToken, {
      ...shared,
      maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    });
  }

  return response;
}
