import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@/app/lib/rate-limit";
import { loginUrlWithError, startSupabaseOAuth } from "@/app/lib/social-login";

/**
 * Step 1 of "Log in with your Google account": send the browser to Google
 * via Supabase.
 *
 * A GET so the sign-in control can be a plain link -- no form, no JavaScript,
 * and nothing for the Content-Security-Policy to allow. Everything else is
 * shared with the other Supabase-brokered providers; see startSupabaseOAuth.
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

  return startSupabaseOAuth(request, "google");
}
