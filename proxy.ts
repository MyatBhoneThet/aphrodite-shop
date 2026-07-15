import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE } from "./app/lib/admin-session";

// Next.js 16 renamed `middleware.ts` to `proxy.ts` (functionality unchanged).
//
// This is an *optimistic* check only -- it looks for the presence of the
// admin session cookie, not whether it's still a valid, unexpired Supabase
// token. The real (secure) check happens server-side in requireAdmin() /
// requireUserFromRequest() for every /api/admin/* call, which is the actual
// authorization boundary. This proxy check exists so an unauthenticated
// visitor is redirected before any admin HTML/JS ships at all, instead of
// relying solely on a client-side redirect after the page has loaded.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasAdminSession = request.cookies.has(ADMIN_SESSION_COOKIE);

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
