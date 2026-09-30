// Shared contact footer for every Aphrodite email.
//
// Kept in one place so the order receipt and any future email stay identical.
// The same markup is mirrored in docs/email-templates/ for the Supabase Auth
// verification email, which is rendered by Supabase's dashboard template and
// therefore cannot import from this file.
//
// Email clients (Outlook especially) ignore <style> blocks and most modern CSS,
// so everything here is inline styles on tables/divs only. Restrained greys and
// one dark heading -- no colour blocks.

// Contact details come from lib/contact-info.ts so the website footer and this
// email footer can never disagree. Re-exported for existing importers.
export {
  APHRODITE_SOCIALS,
  APHRODITE_BRANCHES,
  APHRODITE_HOURS,
} from "./contact-info";

import {
  APHRODITE_BRANCHES,
  APHRODITE_HOURS,
  APHRODITE_SOCIALS,
} from "./contact-info";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/** Contact footer as an email-safe HTML string. */
export function emailFooterHtml() {
  const socials = APHRODITE_SOCIALS.map(
    (social) =>
      `<a href="${escapeHtml(social.url)}" style="color:#18181b;text-decoration:underline;font-weight:700;padding:0 10px">${escapeHtml(social.label)}</a>`
  ).join('<span style="color:#d4d4d8">|</span>');

  const branches = APHRODITE_BRANCHES.map(
    (branch) => `
        <td style="vertical-align:top;padding:0 12px 16px 0;font-size:13px;line-height:21px;color:#3f3f46">
          <div style="font-weight:700;color:#18181b">${escapeHtml(branch.name)}</div>
          <div style="margin-top:4px">${branch.phones
            .map(
              (phone) =>
                `<a href="tel:${escapeHtml(phone.replaceAll(" ", ""))}" style="color:#3f3f46;text-decoration:none">${escapeHtml(phone)}</a>`
            )
            .join(" &nbsp;·&nbsp; ")}</div>
          <div style="margin-top:4px;color:#52525b">${escapeHtml(branch.address)}</div>
        </td>`
  ).join("");

  return `
  <div style="border-top:1px solid #e4e4e7;margin-top:28px;padding:22px 24px 26px">
    <div style="text-align:center;padding-bottom:16px">${socials}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">
      <tr>${branches}</tr>
    </table>
    <div style="font-size:13px;color:#52525b">${escapeHtml(APHRODITE_HOURS)}</div>
    <div style="margin-top:14px;font-size:11px;line-height:18px;color:#a1a1aa">
      You received this email because you have an account with Aphrodite Myanmar.
    </div>
  </div>`;
}
