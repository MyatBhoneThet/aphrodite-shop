import { NextResponse, type NextRequest } from "next/server";
import { authenticate } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { hasVerifiedTotp } from "@/app/lib/mfa";
import { requireAdmin, selectAuthFactorsService, selectBackofficeProfiles } from "@/app/lib/supabase";

/** Who has back-office access, and which of them have two-step login. Admin only. */
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    requireAdmin(user);
    const profiles = await selectBackofficeProfiles();
    const accounts = await Promise.all(
      profiles.map(async (profile) => ({
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role,
        created_at: profile.created_at,
        twoStep: await selectAuthFactorsService(profile.id).then(hasVerifiedTotp).catch(() => null),
      }))
    );
    return NextResponse.json(
      {
        accounts,
        requiredForAll: process.env.ADMIN_MFA_REQUIRED?.trim().toLowerCase() === "all",
        sessionHours: 12,
        alertsConfigured: Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD),
        extraAlertRecipients: (process.env.ADMIN_ALERT_EMAIL ?? "").split(",").map((entry) => entry.trim()).filter(Boolean).length,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    return handleRouteError("admin.security", error);
  }
}
