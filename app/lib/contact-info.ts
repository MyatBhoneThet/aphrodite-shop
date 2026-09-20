// Single source of truth for Aphrodite's public contact details.
//
// Used by BOTH the website footer (app/components/SiteContact.tsx) and the
// email footer (app/lib/email-footer.ts), so a phone number or address only
// ever has to change in one place.
//
// The one copy this cannot reach is the Supabase Auth verification email,
// which Supabase renders on its own servers from a dashboard template --
// see docs/email-templates/supabase-confirm-signup.html.

export const APHRODITE_SOCIALS = [
  { label: "Facebook", url: "https://www.facebook.com/Aphroditemyanamr/" },
  { label: "Instagram", url: "https://www.instagram.com/aph.roditemyanmar/" },
  { label: "TikTok", url: "https://www.tiktok.com/@aphrodite.myanmar4" },
] as const;

export const APHRODITE_BRANCHES = [
  {
    name: "Aphrodite Myanmar",
    phones: ["09420082522", "09759732167"],
    address:
      "အမှတ် (၉) ၊ ရွှေတောင်တန်းလမ်း၊ ကမ်းနားလမ်းဘလောက်၊ လမ်းမတော်မြို့နယ်၊ ရန်ကုန်မြို့။",
  },
  {
    name: "Aphrodite Thailand",
    phones: ["081 301 7787", "081 637 2019"],
    address: "9/64 Nalin Avenue 2, Ramkhamhaeng 144",
  },
] as const;

export const APHRODITE_HOURS = "Operation hours 10 AM to 6 PM";

/** Digits only, for tel: links. */
export function telHref(phone: string) {
  return `tel:${phone.replaceAll(/[^0-9+]/g, "")}`;
}
