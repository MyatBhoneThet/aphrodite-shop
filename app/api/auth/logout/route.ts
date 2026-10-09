import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/app/lib/admin-session";
import { USER_SESSION_COOKIE } from "@/app/lib/user-session";

export async function POST() {
  const response = NextResponse.json({ ok: true });

  // Logging out of the storefront ends the whole browser session: clear the
  // ordinary session cookie and, if this account also had an admin session,
  // that one too (otherwise /api/auth/me would keep resolving the user).
  response.cookies.delete(USER_SESSION_COOKIE);
  response.cookies.delete(ADMIN_SESSION_COOKIE);

  return response;
}
