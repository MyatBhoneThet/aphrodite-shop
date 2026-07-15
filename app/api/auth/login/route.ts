import { NextResponse, type NextRequest } from "next/server";
import { getProfile, loginUser } from "@/app/lib/supabase";
import { checkRateLimit } from "@/app/lib/rate-limit";
import { loginInputSchema } from "@/app/lib/validation";

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(request, "login");

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

    const session = await loginUser(parsed.data.email, parsed.data.password);
    const profile = await getProfile(session.user.id, session.access_token);

    return NextResponse.json({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      profile,
      user: profile,
    });
  } catch (error) {
    console.error("[auth.login] failed", error);

    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 }
    );
  }
}
