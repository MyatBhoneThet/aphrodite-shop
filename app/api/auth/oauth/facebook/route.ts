import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@/app/lib/rate-limit";
import { loginUrlWithError, startSupabaseOAuth } from "@/app/lib/social-login";

/**
 * Step 1 of "Log in with your Facebook account".
 *
 * Identical in shape to the Google route: Supabase brokers Facebook too, so
 * the only difference is the provider name it passes along. The App ID and
 * secret live in the Supabase dashboard, not in this app's environment, and
 * the reply comes back to the shared /api/auth/oauth/callback.
 *
 * Worth knowing: Facebook only returns an email address for accounts that
 * have a confirmed one. An account created with a phone number alone arrives
 * without one, leaving Supabase nothing to key the profile on -- the customer
 * sees the sign-in fail and has to use another method.
 */
export async function GET(request: NextRequest) {
  const rateLimit = checkRateLimit(request, "oauth");

  if (!rateLimit.allowed) {
    return NextResponse.redirect(
      loginUrlWithError(
        request,
        "Too many sign-in attempts. Please try again in a minute."
      )
    );
  }

  return startSupabaseOAuth(request, "facebook");
}
