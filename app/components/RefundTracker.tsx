"use client";

import { formatCurrency, formatDateTime } from "../lib/format";
import { useLanguage } from "../lib/language";
import { refundSteps, refundTracking, type TrackableRefund } from "../lib/refund-tracking";

type TrackedRefund = TrackableRefund & {
  refund_amount?: number | null;
  refund_reference?: string | null;
};

/**
 * The same five steps for the customer and the administrator, read from one
 * shared helper so the two views can never disagree.
 */
export default function RefundTracker({ request }: { request: TrackedRefund }) {
  const { t } = useLanguage();
  const tracking = refundTracking(request);

  return (
    <section
      aria-label="Refund progress"
      className="mt-3 rounded-2xl border border-zinc-200 bg-white p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
          {t("refund.title")}
        </p>
        {typeof request.refund_amount === "number" && request.refund_amount > 0 && (
          <p className="text-sm font-black">
            {t("refund.amount")}: {formatCurrency(request.refund_amount)}
          </p>
        )}
      </div>

      <p className="mt-1 text-lg font-bold" role="status">
        {tracking.stage ? t(`refund.step.${tracking.stage}`) : tracking.label}
      </p>

      {tracking.stopped ? (
        <p className="mt-2 rounded-xl bg-zinc-100 p-3 text-xs text-zinc-700">
          {t("refund.stopped")}
        </p>
      ) : (
        <>
          <ol
            className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5"
            aria-label="Refund progress"
          >
            {refundSteps.map((step, index) => (
              <li
                key={step}
                aria-current={index === tracking.step ? "step" : undefined}
                className={`border-t-4 pt-2 text-xs ${
                  index <= tracking.step
                    ? "border-emerald-600 font-semibold text-emerald-800"
                    : "border-zinc-200 text-zinc-500"
                }`}
              >
                {t(`refund.step.${step}`)}
                {index === tracking.step && <span className="sr-only"> (current stage)</span>}
              </li>
            ))}
          </ol>

          <div className="mt-3 space-y-1 text-xs">
            {request.refund_sent_at ? (
              <p className="font-semibold text-emerald-800">
                {t("refund.sentOn", { date: formatDateTime(request.refund_sent_at) })}
                {request.refund_reference && ` · ${t("refund.reference")}: ${request.refund_reference}`}
              </p>
            ) : tracking.expectedAt ? (
              <p className={tracking.isLate ? "font-semibold text-amber-800" : "text-zinc-600"}>
                {t("refund.expected", { date: formatDateTime(tracking.expectedAt) })}
              </p>
            ) : (
              <p className="text-zinc-600">{t("refund.noEstimate")}</p>
            )}

            {tracking.isLate && (
              <p className="font-semibold text-amber-800">{t("refund.delayed")}</p>
            )}

            {tracking.delayReason && (
              <p className="rounded-xl bg-amber-50 p-3 text-amber-900">
                {tracking.delayReason}
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
