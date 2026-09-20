"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { useLanguage } from "../lib/language";

/**
 * A bank / wallet logo that degrades to a lettered badge instead of the
 * browser's broken-image icon when the file has not been added to
 * `public/payments/` yet.
 *
 * Plain <img> on purpose: next/image cannot report a load failure back to us
 * the way a native onError can, and these are small fixed-size marks that gain
 * nothing from the optimizer.
 */
export function PaymentLogo({
  src,
  alt,
  initials,
}: {
  src: string;
  alt: string;
  initials: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        aria-hidden="true"
        className="flex h-10 w-16 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-xs font-black text-white"
      >
        {initials}
      </span>
    );
  }

  // Height is fixed and width is left free (capped), so a wide bank logo and a
  // square wallet mark each sit at their own natural proportions. A fixed
  // square box shrank the 2.7:1 bank logos to about 12px tall.
  return (
    <img
      src={src}
      alt={alt}
      width={112}
      height={40}
      className="h-10 w-auto max-w-[7rem] shrink-0 object-contain"
      onError={() => setFailed(true)}
    />
  );
}

/**
 * The MMQR code. If the image is missing the customer is told plainly rather
 * than being shown a broken picture they might mistake for a scannable code —
 * scanning nothing is better than scanning the wrong thing.
 */
export function PaymentQr({ src, alt }: { src: string; alt: string }) {
  const { t } = useLanguage();
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className="mt-2 block rounded-xl border border-dashed border-amber-400 bg-amber-50 p-4 text-xs font-semibold text-amber-900">
        {t("payment.qrMissing")}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      width={220}
      height={220}
      className="mt-2 h-auto w-48"
      onError={() => setFailed(true)}
    />
  );
}
