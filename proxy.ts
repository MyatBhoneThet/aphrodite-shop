import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE } from "./app/lib/admin-session";
import { USER_SESSION_COOKIE } from "./app/lib/user-session";

// Next.js 16 renamed `middleware.ts` to `proxy.ts` (functionality unchanged).
//
// This is an *optimistic* check only -- it looks for the presence of a
// session cookie, not whether it's still a valid, unexpired Supabase token
// or whether the account is actually an admin. The real (secure) check
// happens server-side in requireAdmin() / requireUserFromRequest() for every
// /api/admin/* call, which is the actual authorization boundary; the admin
// pages additionally verify the role client-side and show a lock screen to
// non-admins. This proxy check exists so a logged-out visitor is redirected
// before any admin HTML/JS ships at all.
//
// The ordinary session cookie is accepted here too: an admin who signed in
// through the normal /login gets both cookies now, but sessions created
// before that change only carry the user cookie -- without this, such an
// admin would bounce forever between /admin/login (which sees an admin via
// /api/auth/me) and this redirect.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasAdminSession =
    request.cookies.has(ADMIN_SESSION_COOKIE) ||
    request.cookies.has(USER_SESSION_COOKIE);

  if (pathname === "/admin/login") {
    // Always leave the login page reachable. Cookie presence is only an
    // optimistic signal: an expired or otherwise invalid token must not trap
    // the user in a login -> dashboard -> login redirect loop. The login page
    // verifies a valid session through /api/auth/me and redirects after that.
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin") && !hasAdminSession) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
