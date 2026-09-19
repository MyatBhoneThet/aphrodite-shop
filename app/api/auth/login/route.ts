import { NextResponse, type NextRequest } from "next/server";
import { getProfile, loginUser } from "@/app/lib/supabase";
import { checkRateLimit } from "@/app/lib/rate-limit";
import { setSessionCookies } from "@/app/lib/session-cookies";
import { loginInputSchema } from "@/app/lib/validation";
import { readJsonBody } from "@/app/lib/request";

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(request, "login");

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const parsed = loginInputSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Enter a valid email and password." },
        { status: 400 }
      );
    }

    const session = await loginUser(parsed.data.email, parsed.data.password);
    const profile = await getProfile(session.user.id, session.access_token);

    // The access token travels ONLY in an httpOnly cookie: it is never part
    // of the JSON body, so client JS (and any XSS payload) cannot read it.
    // Admins get the admin session cookie from the normal login too, so
    // logging in at /login and then visiting /admin works without a second
    // sign-in at /admin/login. The role comes from the profiles table
    // (server-side), never from the request.
    return setSessionCookies(
      NextResponse.json({ profile, user: profile }),
      session.access_token,
      { isAdmin: profile?.role === "admin" }
    );
  } catch (error) {
    console.error("[auth.login] failed", error);

    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 }
    );
  }
}
