import { NextResponse, type NextRequest } from "next/server";
import { recordAdminAction } from "@/app/lib/admin-audit";
import { conflict, handleRouteError, notFound } from "@/app/lib/errors";
import { requireFreshAuth } from "@/app/lib/mfa";
import { authenticateBackoffice } from "@/app/lib/mfa-routes";
import { mfaUnenroll } from "@/app/lib/supabase";

/** Removes an authenticator (a lost phone, a new phone). Needs a fresh code. */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await authenticateBackoffice(request, { limit: true });
    const { id } = await context.params;
    const factor = user.mfa.factors.find((entry) => entry.id === id && entry.factor_type === "totp");
    if (!factor) throw notFound("Authenticator not found.");

    requireFreshAuth(user);
    const others = user.mfa.factors.filter((entry) => entry.id !== id && entry.status === "verified" && entry.factor_type === "totp");
    if (factor.status === "verified" && others.length === 0 && process.env.ADMIN_MFA_REQUIRED?.trim().toLowerCase() === "all") {
      throw conflict("Two-step login is compulsory for all admin accounts. Add the new authenticator first, then remove the old one.");
    }

    await mfaUnenroll(user.accessToken, id);
    await recordAdminAction({ actorId: user.id, action: "auth.mfa.removed", targetType: "profile", targetId: user.id, previous: { factor: id, status: factor.status } });
    return NextResponse.json({ removed: true });
  } catch (error) {
    return handleRouteError("auth.mfa.remove", error);
  }
}
