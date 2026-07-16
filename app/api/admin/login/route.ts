import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
} from "@/app/lib/admin-session";
import { handleRouteError } from "@/app/lib/errors";
import { checkRateLimit } from "@/app/lib/rate-limit";
import { getProfile, loginUser } from "@/app/lib/supabase";
import { loginInputSchema } from "@/app/lib/validation";

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(request, "admin-login");

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const parsed = loginInputSchema.safeParse(await request.json().catch(() => ({})));

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Enter a valid email and password." },
        { status: 400 }
      );
    }

    let session;

    try {
      session = await loginUser(parsed.data.email, parsed.data.password);
    } catch {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const profile = await getProfile(session.user.id, session.access_token);

    if (!profile || profile.role !== "admin") {
      // Valid Supabase credentials, but not an admin account -- do NOT set
      // the admin session cookie. They still have an ordinary Supabase
      // session (usable for the regular storefront), just not this one.
      return NextResponse.json(
        { error: "This account does not have admin access." },
        { status: 403 }
      );
    }

    // Tokens live only in httpOnly cookies -- never in the JSON body where
    // client JS could persist them to localStorage.
    const response = NextResponse.json({ ok: true, user: profile });

    response.cookies.set(ADMIN_SESSION_COOKIE, session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error) {
    return handleRouteError("admin.login", error);
  }
}
