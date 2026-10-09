import Link from "next/link";
import type { ReactNode } from "react";
import BrandLogo from "./BrandLogo";

/**
 * The liquid backdrop on its own: a white base with soft red and rose blobs.
 *
 * Deliberately in the shop's red-and-white palette so the auth pages and the
 * account settings match the main store, instead of standing out as a dark
 * island. The blobs are plain CSS gradients (no images, no JS), so the page
 * stays fast and the site's Content-Security-Policy is untouched.
 *
 * Exported so every "liquid glass" page shares one definition rather than
 * copying the blob markup around. The parent must be `relative` -- this fills
 * it absolutely.
 */
export function LiquidBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 bg-white">
      <div className="absolute -left-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-red-500/25 blur-[120px]" />
      <div className="absolute -bottom-52 -right-24 h-[34rem] w-[34rem] rounded-full bg-rose-400/25 blur-[130px]" />
      <div className="absolute left-1/2 top-1/3 h-80 w-80 -translate-x-1/2 rounded-full bg-red-300/25 blur-[110px]" />
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(24,24,27,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(24,24,27,.6) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(ellipse at center, black 20%, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, black 20%, transparent 70%)",
        }}
      />
    </div>
  );
}

export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
  aside,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-white text-zinc-950">
      <LiquidBackdrop />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center gap-10 px-5 py-12 lg:flex-row lg:items-center lg:gap-16">
        <div className="w-full max-w-md">
          <Link
            href="/"
            aria-label="Aphrodite Myanmar home"
            className="mb-8 inline-flex items-center gap-3 rounded-2xl px-1 py-1 transition hover:opacity-90"
          >
            {/* The standard dark logo, same as the store header. The white
                variant belongs to the old dark theme and would be invisible
                on this light background. */}
            <BrandLogo />
          </Link>

          {/* Frosted card */}
          <div className={`${glassCardClass} sm:p-9`}>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600">
              {subtitle}
            </p>

            <div className="mt-7">{children}</div>
          </div>

          {footer && <div className="mt-6 text-sm text-zinc-600">{footer}</div>}
        </div>

        {aside && (
          <aside className="hidden w-full max-w-md lg:block">{aside}</aside>
        )}
      </div>
    </main>
  );
}

/** Shared frosted panel, so every liquid card looks identical. */
export const glassCardClass =
  "rounded-3xl border border-zinc-200/80 bg-white/70 p-5 sm:p-7 shadow-[0_8px_40px_rgba(24,24,27,0.08)] backdrop-blur-2xl";

/** Shared input styling so every auth field looks identical. Focus ring
 *  matches the store's search box. */
export const authFieldClass =
  "w-full rounded-2xl border border-zinc-300 bg-white/80 px-4 py-3.5 text-zinc-950 placeholder:text-zinc-400 outline-none backdrop-blur transition focus:border-red-500 focus:ring-4 focus:ring-red-50";

export const authLabelClass = "mb-2 block text-sm font-semibold text-zinc-800";

export const authButtonClass =
  "w-full rounded-full bg-red-600 px-5 py-3.5 font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500";
