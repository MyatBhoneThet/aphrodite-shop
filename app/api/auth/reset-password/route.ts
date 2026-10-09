import { NextResponse, type NextRequest } from "next/server";
import { updateUserPassword, verifyRecoveryToken } from "@/app/lib/supabase";
import { checkRateLimit } from "@/app/lib/rate-limit";
import { readJsonBody } from "@/app/lib/request";
import { firstIssueMessage, passwordResetSchema } from "@/app/lib/validation";

/**
 * "Forgot password?" -- step 2: redeem the emailed token and set a new
 * password.
 *
 * Redeeming the token yields a short-lived Supabase session. That session is
 * used once, here, to write the new password and is then dropped: no cookie is
 * set, so the customer signs in again with the password they just chose. That
 * keeps a leaked reset link from being usable as a standing login, and proves
 * the new password works.
 */
export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(request, "reset-password");

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429 }
    );
  }

  const parsed = passwordResetSchema.safeParse(await readJsonBody(request));

  if (!parsed.success) {
    return NextResponse.json(
      { error: firstIssueMessage(parsed.error) },
      { status: 400 }
    );
  }

  let accessToken: string;

  try {
    const session = await verifyRecoveryToken(parsed.data.token);
    accessToken = session.access_token;
  } catch (error) {
    console.warn("[auth.reset-password] token rejected", error);

    return NextResponse.json(
      {
        error:
          "This reset link has expired or has already been used. Request a new one.",
      },
      { status: 400 }
    );
  }

  try {
    await updateUserPassword(accessToken, parsed.data.password);
  } catch (error) {
    console.error("[auth.reset-password] update failed", error);

    // Supabase refuses a password identical to the current one, and enforces
    // its own strength rules; neither is worth echoing verbatim.
    return NextResponse.json(
      {
        error:
          "Could not set that password. Choose a different one and try again.",
      },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
