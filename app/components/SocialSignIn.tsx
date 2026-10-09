"use client";

import type { ReactElement } from "react";
import { useLanguage } from "../lib/language";
import type { SocialProvider } from "../lib/oauth";

/**
 * The "Log in with ..." buttons, one per provider the shop has switched on.
 *
 * Deliberately plain links, not buttons with an onClick: every OAuth exchange
 * is server-side (see app/api/auth/oauth/*), so these need no JavaScript, work
 * before hydration, and add nothing for the Content-Security-Policy to allow.
 *
 * Each mark is drawn inline as SVG for the same reason -- no external image,
 * no extra host in `img-src`.
 *
 * Which providers arrive here is decided on the server by
 * enabledSocialProviders(), so a customer is never offered a button that
 * cannot work. The sign-in routes check again; this list is presentation.
 */

const baseButtonClass =
  "flex w-full items-center justify-center gap-3 rounded-full px-5 py-3.5 font-bold transition";

function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className="h-5 w-5">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

/**
 * LINE's speech bubble, in white on the brand green, which is how LINE's own
 * login button looks. Simplified to the bubble alone -- the wordmark is
 * carried by the button's label instead of being traced in path data.
 */
function LineMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M12 2.4c-5.35 0-9.7 3.53-9.7 7.87 0 3.89 3.45 7.15 8.11 7.77.32.07.75.21.86.48.1.25.06.63.03.88l-.14.83c-.04.25-.2.96.85.52 1.04-.44 5.6-3.3 7.64-5.65 1.4-1.54 2.05-3.1 2.05-4.83 0-4.34-4.35-7.87-9.7-7.87zM8.1 12.78h-1.9a.5.5 0 0 1-.5-.5V8.44a.5.5 0 0 1 1 0v3.34h1.4a.5.5 0 0 1 0 1zm2.1-.5a.5.5 0 0 1-1 0V8.44a.5.5 0 0 1 1 0v3.84zm4.55 0a.5.5 0 0 1-.9.3l-1.95-2.65v2.35a.5.5 0 0 1-1 0V8.44a.5.5 0 0 1 .9-.3l1.96 2.66V8.44a.5.5 0 0 1 1 0v3.84zm3.06-2.42a.5.5 0 0 1 0 1h-1.4v.92h1.4a.5.5 0 0 1 0 1h-1.9a.5.5 0 0 1-.5-.5V8.44a.5.5 0 0 1 .5-.5h1.9a.5.5 0 0 1 0 1h-1.4v.92h1.4z" />
    </svg>
  );
}

/**
 * Facebook's "f", drawn as the single outline Meta publishes: the disc and the
 * letter are one shape, so filling it white on the brand blue leaves the "f"
 * showing through in blue. That is Facebook's own inverted treatment, and it
 * needs no second colour.
 */
function FacebookMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

const PROVIDER_STYLES: Record<
  SocialProvider,
  { className: string; mark: () => ReactElement }
> = {
  google: {
    className:
      "border border-zinc-300 bg-white text-zinc-800 hover:border-zinc-400 hover:bg-zinc-50",
    mark: GoogleMark,
  },
  facebook: {
    // #1877F2 is Meta's brand blue for the login button.
    className: "bg-[#1877F2] text-white hover:bg-[#1465d8]",
    mark: FacebookMark,
  },
  line: {
    // #06C755 is LINE's brand green; darkened slightly on hover.
    className: "bg-[#06C755] text-white hover:bg-[#05b34c]",
    mark: LineMark,
  },
};

const PROVIDER_LABEL_KEYS = {
  google: "login.withGoogle",
  facebook: "login.withFacebook",
  line: "login.withLine",
} as const;

export function SocialSignInButton({
  provider,
  next,
}: {
  provider: SocialProvider;
  next?: string;
}) {
  const { t } = useLanguage();
  const { className, mark: Mark } = PROVIDER_STYLES[provider];
  const href = next
    ? `/api/auth/oauth/${provider}?next=${encodeURIComponent(next)}`
    : `/api/auth/oauth/${provider}`;

  return (
    <a href={href} className={`${baseButtonClass} ${className}`}>
      <Mark />
      {t(PROVIDER_LABEL_KEYS[provider])}
    </a>
  );
}

/**
 * Every enabled provider, stacked. Renders nothing at all -- not even the
 * divider -- when the shop has no social sign-in configured, so the email and
 * password form is simply the whole card.
 */
export default function SocialSignInButtons({
  providers,
  next,
}: {
  providers: SocialProvider[];
  next?: string;
}) {
  const { t } = useLanguage();

  if (providers.length === 0) return null;

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        {providers.map((provider) => (
          <SocialSignInButton key={provider} provider={provider} next={next} />
        ))}
      </div>
      <AuthDivider label={t("login.or")} />
    </div>
  );
}

/** "or" rule, shown between the social buttons and the email form. */
export function AuthDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4">
      <span className="h-px flex-1 bg-zinc-200" />
      <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
        {label}
      </span>
      <span className="h-px flex-1 bg-zinc-200" />
    </div>
  );
}
