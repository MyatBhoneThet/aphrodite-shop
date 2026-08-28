import { NextResponse, type NextRequest } from "next/server";
import { registerUser } from "@/app/lib/supabase";
import { checkRateLimit } from "@/app/lib/rate-limit";
import { firstIssueMessage, registerInputSchema } from "@/app/lib/validation";
import { readJsonBody } from "@/app/lib/request";

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(request, "register");

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many registration attempts. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const parsed = registerInputSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      return NextResponse.json(
        { error: firstIssueMessage(parsed.error) },
        { status: 400 }
      );
    }

    // Role is never accepted from the client: self-registration always
    // creates a "normal" account. Wholesale/admin roles are granted by an
    // admin afterwards (see ADMIN_SETUP.md), never chosen at signup.
    const result = await registerUser({
      email: parsed.data.email,
      password: parsed.data.password,
      fullName: parsed.data.full_name,
    });
    const profile = {
      id: result.user.id,
      email: result.user.email ?? parsed.data.email,
      full_name: parsed.data.full_name ?? null,
      role: "normal" as const,
      wholesale_status: "not_applied" as const,
      price_list_id: null,
      phone: null,
    };

    return NextResponse.json(
      {
        profile,
        user: profile,
        requiresEmailVerification: result.requiresEmailVerification,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[auth.register] failed", error);

    return NextResponse.json(
      { error: "Unable to create account. Check your details and try again." },
      { status: 400 }
    );
  }
}
