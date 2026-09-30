import { NextResponse, type NextRequest } from "next/server";
import {
  generatePasswordRecoveryToken,
  isSupabaseConfigured,
  requestPasswordRecoveryEmail,
} from "@/app/lib/supabase";
import { mailTransportConfig } from "@/app/lib/mailer";
import { sendPasswordResetEmail } from "@/app/lib/password-reset-email";
import { checkRateLimit } from "@/app/lib/rate-limit";
import { readJsonBody } from "@/app/lib/request";
import { isUnreachableFromEmail, publicSiteUrl } from "@/app/lib/mailer";
import { forgotPasswordSchema } from "@/app/lib/validation";

/**
 * "Forgot password?" -- step 1: email a one-time reset link.
 *
 * The answer is always the same whether or not the address has an account.
 * Saying "no such user" here would turn this endpoint into a way to test which
 * email addresses have registered with the shop, so every branch below ends in
 * the same generic 200.
 */
const GENERIC_ANSWER = {
  ok: true,
  message:
    "If that email address has an account, a reset link is on its way. Check your inbox and spam folder.",
};

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(request, "forgot-password");

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many reset requests. Please try again later." },
      { status: 429 }
    );
  }

  const parsed = forgotPasswordSchema.safeParse(await readJsonBody(request));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 }
    );
  }

  const email = parsed.data.email;
  // publicSiteUrl, not appOrigin: this link is opened from an inbox, so it
  // has to be the live site even when the server sending it is a laptop.
  const base = publicSiteUrl();

  if (isUnreachableFromEmail(base)) {
    console.warn(
      "[auth.forgot-password] reset link points at a local address; set PUBLIC_SITE_URL",
      { base }
    );
  }

  const resetPageUrl = `${base}/reset-password`;

  if (!isSupabaseConfigured()) {
    console.error("[auth.forgot-password] Supabase is not configured");
    return NextResponse.json(GENERIC_ANSWER);
  }

  try {
    if (mailTransportConfig()) {
      // Preferred path: mint the token with the admin API and send a branded
      // email from the shop's own account.
      const token = await generatePasswordRecoveryToken(email);

      if (token) {
        const url = new URL(resetPageUrl);
        url.searchParams.set("token", token);
        const result = await sendPasswordResetEmail(email, url.toString());

        if (result.status === "failed") {
          console.error("[auth.forgot-password] mail failed", result.error);
        }
      }
    } else {
      // No outgoing mail of our own: let Supabase send it. Its dashboard
      // template must be docs/email-templates/supabase-reset-password.html so
      // the link lands on the same /reset-password page.
      await requestPasswordRecoveryEmail(email, resetPageUrl);
    }
  } catch (error) {
    // Includes "no user with that email", which must stay invisible to the
    // caller. Logged so an operator can still see genuine failures.
    console.warn("[auth.forgot-password] could not send reset link", error);
  }

  return NextResponse.json(GENERIC_ANSWER);
}
