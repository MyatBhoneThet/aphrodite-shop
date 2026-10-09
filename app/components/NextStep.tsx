"use client";

import { formatCurrency } from "../lib/format";
import { useLanguage } from "../lib/language";
import { orderNextStep, type NextStepOrder } from "../lib/next-step";

/**
 * "What happens next?" — one instruction per order, in the reader's language.
 *
 * The wording is derived (see next-step.ts), never stored, so this cannot drift
 * out of step with the order it describes.
 */

const toneStyles = {
  action: "border-amber-300 bg-amber-50 text-amber-950",
  waiting: "border-blue-200 bg-blue-50 text-blue-950",
  done: "border-emerald-200 bg-emerald-50 text-emerald-950",
  stopped: "border-zinc-200 bg-zinc-100 text-zinc-700",
} as const;

export default function NextStep({
  order,
  note,
}: {
  order: NextStepOrder;
  /** The admin's own words, when they asked for something to be corrected. */
  note?: string | null;
}) {
  const { t } = useLanguage();
  const step = orderNextStep(order);

  return (
    <section
      aria-label={t("next.heading")}
      className={`mb-5 rounded-2xl border p-4 ${toneStyles[step.tone]}`}
    >
      <p className="text-xs font-bold uppercase tracking-wider opacity-70">{t("next.heading")}</p>
      <p className="mt-1 text-lg font-black" role="status">
        {t(`next.${step.key}`)}
      </p>
      <p className="mt-1 text-sm">{t(`next.${step.key}.detail`)}</p>
      {step.amount !== null && step.amount > 0 && (
        <p className="mt-3 rounded-xl bg-white/70 px-4 py-3 text-xl font-black tabular-nums">
          {formatCurrency(step.amount)}
        </p>
      )}
      {note && <p className="mt-3 rounded-xl bg-white/70 p-3 text-sm font-semibold">{note}</p>}
    </section>
  );
}
