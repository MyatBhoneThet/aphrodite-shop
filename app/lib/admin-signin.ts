import { after, type NextRequest } from "next/server";
import { computeMfaState, isBackofficeRole } from "./mfa";
import { sendMail } from "./mailer";
import { clientIp } from "./rate-limit";
import { formatYangon } from "./report-range";
import { getAuthUser, type Profile } from "./supabase";

/** "Chrome on macOS" from a user-agent string. Good enough for an alert email. */
export function describeDevice(userAgent: string | null | undefined) {
  const ua = userAgent ?? "";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox"
    : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Unknown browser";
  const system = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows"
    : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "unknown device";
  return `${browser} on ${system}`;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function signInAlertEmail(details: { name: string; email: string; role: string; ip: string; device: string; when: string; method: string }) {
  const lines = [
    ["Account", `${details.name} (${details.email})`],
    ["Role", details.role],
    ["When", `${details.when} (Yangon time)`],
    ["Signed in with", details.method],
    ["Device", details.device],
    ["Network address", details.ip],
  ];
  const text = [
    "Someone just signed in to the Aphrodite admin area.",
    "",
    ...lines.map(([label, value]) => `${label}: ${value}`),
    "",
    "If this was you, no action is needed.",
    "If it was not: change that account's password now, and in Admin > Security remove and re-add the authenticator.",
  ].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;color:#18181b;max-width:520px">
<h2 style="margin:0 0 12px">New admin sign-in</h2>
<p>Someone just signed in to the Aphrodite admin area.</p>
<table style="border-collapse:collapse;font-size:14px">${lines
    .map(([label, value]) => `<tr><td style="padding:4px 12px 4px 0;color:#71717a">${escapeHtml(label)}</td><td style="padding:4px 0;font-weight:600">${escapeHtml(value)}</td></tr>`)
    .join("")}</table>
<p style="margin-top:16px">If this was you, no action is needed.</p>
<p><strong>If it was not you:</strong> change that account's password now, and in Admin &rsaquo; Security remove and re-add the authenticator.</p>
</div>`;
  return { subject: `New admin sign-in: ${details.name}`, html, text };
}

/** The account itself, plus anyone listed in ADMIN_ALERT_EMAIL (comma separated). */
export function alertRecipients(accountEmail: string, env: Record<string, string | undefined> = process.env) {
  const extra = (env.ADMIN_ALERT_EMAIL ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
  return [...new Set([accountEmail, ...extra].map((entry) => entry.toLowerCase()))].filter(Boolean);
}

async function sendAlert(request: NextRequest, profile: Pick<Profile, "email" | "full_name" | "role">, method: string) {
  try {
    const content = signInAlertEmail({
      name: profile.full_name?.trim() || profile.email,
      email: profile.email,
      role: profile.role === "admin" ? "Administrator" : "Staff",
      ip: clientIp(request),
      device: describeDevice(request.headers.get("user-agent")),
      when: formatYangon(new Date().toISOString()),
      method,
    });
    await Promise.all(alertRecipients(profile.email).map((to) => sendMail(to, content)));
  } catch (error) {
    // An alert is a courtesy; it must never get in the way of signing in.
    console.error("[admin.signin-alert] failed", error instanceof Error ? error.message : error);
  }
}

/** Emails the alert after the response has gone out. Safe to call anywhere; never throws. */
export function scheduleSignInAlert(request: NextRequest, profile: Pick<Profile, "email" | "full_name" | "role">, method: string) {
  if (!isBackofficeRole(profile.role)) return;
  try {
    after(() => sendAlert(request, profile, method));
  } catch {
    void sendAlert(request, profile, method); // outside a request (tests, scripts)
  }
}

/**
 * Call right after a session is created. A back-office account that still has
 * to enter its authenticator code is NOT announced yet (the alert goes out
 * when the code is confirmed); anyone else with back-office access is.
 * Returns what the browser should do next.
 */
export async function registerSignIn(
  request: NextRequest,
  input: { accessToken: string; profile: Pick<Profile, "email" | "full_name" | "role"> | null; method: string }
): Promise<{ mfaPending: "verify" | "enroll" | null }> {
  const { profile } = input;
  if (!profile || !isBackofficeRole(profile.role)) return { mfaPending: null };
  try {
    const { factors } = await getAuthUser(input.accessToken);
    const mfa = computeMfaState({ role: profile.role, factors, token: input.accessToken });
    if (mfa.pending) return { mfaPending: mfa.pending };
  } catch (error) {
    console.error("[admin.signin] could not read two-step state", error instanceof Error ? error.message : error);
  }
  scheduleSignInAlert(request, profile, input.method);
  return { mfaPending: null };
}
