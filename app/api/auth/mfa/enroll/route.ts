import { NextResponse, type NextRequest } from "next/server";
import { forbidden, handleRouteError, reauthRequired, serviceUnavailable } from "@/app/lib/errors";
import { requireFreshAuth } from "@/app/lib/mfa";
import { authenticateBackoffice } from "@/app/lib/mfa-routes";
import { formatYangon } from "@/app/lib/report-range";
import { mfaEnrollTotp, mfaUnenroll } from "@/app/lib/supabase";

/** Starts adding an authenticator: returns the QR code and the typed-in secret. */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateBackoffice(request, { limit: true });
    const { mfa } = user;

    if (mfa.pending === "verify") throw forbidden("Enter a code from your current authenticator first.");
    // Anyone who steals a session must not be able to attach their own
    // authenticator and lock the real owner out: setting one up needs a
    // fresh confirmation (a code, or the password when there is no
    // authenticator yet). While two-step is being made compulsory, a brand
    // new sign-in counts.
    if (mfa.pending === "enroll") {
      if (!mfa.recentSignIn) throw reauthRequired("Sign in again to set up your authenticator.");
    } else {
      requireFreshAuth(user);
    }

    // Clear half-finished attempts so scanning twice never leaves clutter.
    for (const factor of mfa.factors.filter((entry) => entry.factor_type === "totp" && entry.status !== "verified")) {
      await mfaUnenroll(user.accessToken, factor.id).catch(() => undefined);
    }

    try {
      const enrollment = await mfaEnrollTotp(user.accessToken, `Authenticator ${formatYangon(new Date().toISOString())}`);
      return NextResponse.json({ factor_id: enrollment.id, qr_code: enrollment.qr_code, secret: enrollment.secret }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      console.error("[auth.mfa.enroll] failed", error instanceof Error ? error.message : error);
      throw serviceUnavailable(
        "Could not start two-step setup. In the Supabase dashboard, open Authentication, then Multi-Factor, and make sure the authenticator app (TOTP) option is turned on."
      );
    }
  } catch (error) {
    return handleRouteError("auth.mfa.enroll", error);
  }
}
