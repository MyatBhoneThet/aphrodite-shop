import { NextResponse, type NextRequest } from "next/server";
import { getProfile, registerUser } from "@/app/lib/supabase";
import { checkRateLimit } from "@/app/lib/rate-limit";
import { firstIssueMessage, registerInputSchema } from "@/app/lib/validation";

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(request, "register");

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many registration attempts. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const parsed = registerInputSchema.safeParse(
      await request.json().catch(() => ({}))
    );

    if (!parsed.success) {
      return NextResponse.json(
        { error: firstIssueMessage(parsed.error) },
        { status: 400 }
      );
    }

    // Role is never accepted from the client: self-registration always
    // creates a "normal" account. Wholesale/admin roles are granted by an
    // admin afterwards (see ADMIN_SETUP.md), never chosen at signup.
    const user = await registerUser({
      email: parsed.data.email,
      password: parsed.data.password,
      fullName: parsed.data.full_name,
      role: "normal",
    });
    const profile = await getProfile(user.id);

    return NextResponse.json({ profile, user: profile }, { status: 201 });
  } catch (error) {
    console.error("[auth.register] failed", error);

    return NextResponse.json(
      { error: "Unable to create account. Check your details and try again." },
      { status: 400 }
    );
  }
}
