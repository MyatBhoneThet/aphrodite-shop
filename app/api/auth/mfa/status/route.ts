import { NextResponse, type NextRequest } from "next/server";
import { handleRouteError } from "@/app/lib/errors";
import { authenticateBackoffice } from "@/app/lib/mfa-routes";

export async function GET(request: NextRequest) {
  try {
    const { mfa } = await authenticateBackoffice(request);
    return NextResponse.json(
      {
        enrolled: mfa.enrolled,
        pending: mfa.pending,
        aal: mfa.aal,
        fresh: mfa.fresh,
        requiredForAll: process.env.ADMIN_MFA_REQUIRED?.trim().toLowerCase() === "all",
        factors: mfa.factors
          .filter((factor) => factor.factor_type === "totp")
          .map(({ id, status, friendly_name, created_at }) => ({ id, status, friendly_name: friendly_name ?? null, created_at: created_at ?? null })),
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    return handleRouteError("auth.mfa.status", error);
  }
}
