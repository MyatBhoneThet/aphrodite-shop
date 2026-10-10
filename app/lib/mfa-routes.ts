import type { NextRequest } from "next/server";
import { badRequest, forbidden, unauthorized } from "./errors";
import { isBackofficeRole } from "./mfa";
import { checkRateLimit } from "./rate-limit";
import { requireUserFromRequest, type CurrentUser } from "./supabase";

/**
 * Shared start for the two-step routes. These must work for an account that is
 * being held at customer level (that is the whole point of them), so they use
 * mfa.realRole rather than user.role to decide who may continue.
 */
export async function authenticateBackoffice(request: NextRequest, options: { limit?: boolean } = {}) {
  if (options.limit) {
    const limited = checkRateLimit(request, "mfa");
    if (!limited.allowed) throw Object.assign(badRequest("Too many attempts. Please wait a minute and try again."), { status: 429 });
  }
  const user = await requireUserFromRequest(request);
  if (!user.mfa) throw unauthorized();
  if (!isBackofficeRole(user.mfa.realRole)) throw forbidden("Two-step login is for admin and staff accounts.");
  return user as CurrentUser & { mfa: NonNullable<CurrentUser["mfa"]> };
}

/** A six-digit code as typed: spaces and dashes allowed. */
export function parseCode(value: unknown) {
  const code = typeof value === "string" ? value.replace(/[\s-]/g, "") : "";
  if (!/^\d{6}$/.test(code)) throw badRequest("Enter the 6-digit code from your authenticator app.");
  return code;
}
