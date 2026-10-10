import { forbidden, reauthRequired } from "./errors";
import type { CurrentUser } from "./supabase";

/**
 * Two-step login (an authenticator app) for admin and staff accounts.
 *
 * Supabase issues every access token with an "assurance level": aal1 after a
 * password or social sign-in, aal2 once a six-digit code has been confirmed.
 * The token also lists how and when each step happened (the `amr` claim),
 * which is how "confirmed in the last ten minutes" is checked without storing
 * anything.
 *
 * Rollout is per account: a back-office account that has set up an
 * authenticator is held at "customer" level until it confirms a code. Set
 * ADMIN_MFA_REQUIRED=all to require it of every admin and staff account.
 */

export const FRESH_WINDOW_SECONDS = 10 * 60;

export type AuthFactor = {
  id: string;
  status: string;
  factor_type: string;
  friendly_name?: string | null;
  created_at?: string | null;
};

export type MfaState = {
  /** The account's real role, even while it is held back at customer level. */
  realRole: string;
  enrolled: boolean;
  aal: "aal1" | "aal2";
  /** "verify": enter a code. "enroll": must set up an authenticator first. */
  pending: "verify" | "enroll" | null;
  /** A password/code was confirmed in the last ten minutes. */
  fresh: boolean;
  /** The session itself is under ten minutes old (used while setting up). */
  recentSignIn: boolean;
  factors: AuthFactor[];
};

type Claims = { aal?: string; iat?: number; amr?: { method?: string; timestamp?: number }[] };

/** Reads the token's claims. Only call this on a token Supabase has already accepted. */
export function decodeClaims(token: string): Claims {
  try {
    const payload = token.split(".")[1];
    if (!payload) return {};
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(json) as Claims;
  } catch {
    return {};
  }
}

export const isBackofficeRole = (role: string | null | undefined) => role === "admin" || role === "staff";

export function hasVerifiedTotp(factors: AuthFactor[]) {
  return factors.some((factor) => factor.factor_type === "totp" && factor.status === "verified");
}

export function computeMfaState(input: {
  role: string;
  factors: AuthFactor[];
  token: string;
  now?: number; // seconds
  env?: Record<string, string | undefined>;
}): MfaState {
  const now = input.now ?? Math.floor(Date.now() / 1000);
  const env = input.env ?? process.env;
  const claims = decodeClaims(input.token);
  const enrolled = hasVerifiedTotp(input.factors);
  const aal = claims.aal === "aal2" ? "aal2" : "aal1";

  if (!isBackofficeRole(input.role)) {
    return { realRole: input.role, enrolled, aal, pending: null, fresh: true, recentSignIn: true, factors: input.factors };
  }

  const required = enrolled || env.ADMIN_MFA_REQUIRED?.trim().toLowerCase() === "all";
  const pending = required && aal !== "aal2" ? (enrolled ? "verify" : "enroll") : null;

  const timestamps = (methods?: string[]) =>
    (claims.amr ?? [])
      .filter((entry) => typeof entry.timestamp === "number" && (!methods || methods.includes(entry.method ?? "")))
      .map((entry) => entry.timestamp as number);
  // An enrolled account must have confirmed a code recently; one without can
  // only prove freshness by a recent sign-in with its password.
  const latest = enrolled
    ? Math.max(0, ...timestamps(["totp"]))
    : Math.max(0, ...timestamps(), typeof claims.iat === "number" ? claims.iat : 0);
  const fresh = pending === null && latest > 0 && now - latest <= FRESH_WINDOW_SECONDS;
  const lastAny = Math.max(0, ...timestamps(), typeof claims.iat === "number" ? claims.iat : 0);
  const recentSignIn = lastAny > 0 && now - lastAny <= FRESH_WINDOW_SECONDS;

  return { realRole: input.role, enrolled, aal, pending, fresh, recentSignIn, factors: input.factors };
}

/**
 * Gate for the riskiest admin actions (deleting products, exports, changing
 * staff access). Fails closed: a user object with no two-step information is
 * treated as not freshly confirmed.
 */
export function requireFreshAuth(user: CurrentUser) {
  if (!user.mfa) throw reauthRequired();
  if (user.mfa.pending) throw forbidden();
  if (!user.mfa.fresh) {
    throw reauthRequired(
      user.mfa.enrolled
        ? "Enter a fresh code from your authenticator app to continue."
        : "Enter your password again to continue."
    );
  }
}
