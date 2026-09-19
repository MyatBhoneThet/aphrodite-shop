import { emailFooterHtml } from "./email-footer";
import { sendMail, type MailContent, type MailResult } from "./mailer";

/**
 * The "reset your password" email.
 *
 * Sent from the shop's own Gmail account (see lib/mailer.ts) rather than by
 * Supabase, so it is branded like the order receipts and is not subject to
 * Supabase's built-in mail rate limit. The Supabase-rendered version of the
 * same message lives in docs/email-templates/supabase-reset-password.html and
 * is only used when this shop has no outgoing mail configured.
 *
 * Email clients (Outlook especially) ignore <style> blocks, so every rule is
 * inline.
 */

/** How long a reset link stays usable, for the copy below. */
export const RESET_LINK_LIFETIME_TEXT = "1 hour";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function passwordResetEmailContent(resetUrl: string): MailContent {
  const safeUrl = escapeHtml(resetUrl);

  const html = `<div style="margin:0;padding:24px 12px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
  <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;width:100%;border-collapse:collapse;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7">
    <tr>
      <td style="background:#18181b;padding:26px 24px">
        <div style="font-size:22px;font-weight:800;letter-spacing:1px;color:#ffffff">APHRODITE MYANMAR</div>
        <div style="margin-top:6px;font-size:13px;color:#d4d4d8">Laptops, accessories and PC parts</div>
      </td>
    </tr>

    <tr>
      <td style="padding:30px 24px 8px">
        <h1 style="margin:0 0 14px;font-size:22px;font-weight:800;color:#18181b">Reset your password</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#3f3f46">
          We received a request to reset the password for your Aphrodite Myanmar
          account. Choose a new password using the button below.
        </p>

        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0">
          <tr>
            <td style="border-radius:999px;background:#18181b">
              <a href="${safeUrl}"
                 style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px">
                Choose a new password
              </a>
            </td>
          </tr>
        </table>

        <p style="margin:0 0 8px;font-size:13px;line-height:21px;color:#52525b">
          If the button does not work, copy this link into your browser:
        </p>
        <p style="margin:0 0 20px;font-size:12px;line-height:20px;word-break:break-all">
          <a href="${safeUrl}" style="color:#3f3f46">${safeUrl}</a>
        </p>

        <p style="margin:0 0 8px;font-size:13px;line-height:21px;color:#52525b">
          This link can be used once and expires in about ${RESET_LINK_LIFETIME_TEXT}.
        </p>
        <p style="margin:0;font-size:13px;line-height:21px;color:#52525b">
          If you did not ask to reset your password, you can ignore this email —
          your current password keeps working and nothing changes. Never share
          this link with anyone, including staff.
        </p>
      </td>
    </tr>

    <tr>
      <td style="padding:8px 24px 28px">
        ${emailFooterHtml()}
      </td>
    </tr>
  </table>
</div>`;

  const text = [
    "APHRODITE MYANMAR",
    "",
    "Reset your password",
    "",
    "We received a request to reset the password for your Aphrodite Myanmar account.",
    "Open this link to choose a new one:",
    resetUrl,
    "",
    `The link can be used once and expires in about ${RESET_LINK_LIFETIME_TEXT}.`,
    "",
    "If you did not ask to reset your password, ignore this email — your current",
    "password keeps working. Never share this link with anyone, including staff.",
  ].join("\n");

  return {
    subject: "Reset your Aphrodite Myanmar password",
    html,
    text,
  };
}

/** Sends the reset link. Never throws. */
export function sendPasswordResetEmail(
  recipient: string,
  resetUrl: string
): Promise<MailResult> {
  return sendMail(recipient, passwordResetEmailContent(resetUrl), {
    // Every request must deliver: two resets minutes apart are two different
    // links, and Resend would drop the second under a shared key.
    idempotencyKey: `password-reset-${crypto.randomUUID()}`,
  });
}
