"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import AuthShell, {
  authButtonClass,
  authFieldClass,
  authLabelClass,
  glassCardClass,
} from "../components/AuthShell";
import { useLanguage } from "../lib/language";
import { formatDateTime } from "../lib/format";
import { orderTracking, trackingLabels, trackingSteps } from "../lib/order-tracking";
import type { GuestTrackingView } from "../lib/guest-tracking";

/**
 * Signed-out delivery lookup.
 *
 * `?order=` prefills the code from the confirmation email's button, so the
 * customer only types their phone number. The code is never enough on its own
 * -- that is what keeps a forwarded email from becoming a tracking link
 * anybody can follow.
 */
export default function TrackForm() {
  const { language, t } = useLanguage();
  const searchParams = useSearchParams();
  const [code, setCode] = useState(searchParams.get("order") ?? "");
  const [phone, setPhone] = useState("");
  const [tracking, setTracking] = useState<GuestTrackingView | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const en = language === "en";

  async function handleLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setTracking(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), phone: phone.trim() }),
      });

      const data = (await response.json().catch(() => ({
        error: "Invalid server response.",
      }))) as { tracking?: GuestTrackingView; error?: string };

      if (!response.ok || !data.tracking) {
        throw new Error(data.error ?? "Could not find that order.");
      }

      setTracking(data.tracking);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not find that order.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      title={en ? "Track your delivery" : "ပို့ဆောင်မှု စစ်ဆေးရန်"}
      subtitle={
        en
          ? "Enter the order code from your confirmation email and the phone number for the delivery. No account needed."
          : "အတည်ပြုအီးမေးလ်ပါ အော်ဒါကုဒ်နှင့် ပို့ဆောင်ရန် ဖုန်းနံပါတ်ကို ထည့်ပါ။ အကောင့် မလိုအပ်ပါ။"
      }
      aside={
        tracking ? <TrackingResult tracking={tracking} en={en} /> : undefined
      }
    >
      <form onSubmit={handleLookup} className="space-y-5">
        <div>
          <label htmlFor="track-code" className={authLabelClass}>
            {en ? "Order code" : "အော်ဒါကုဒ်"}
          </label>
          <input
            id="track-code"
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="cbf22014"
            autoComplete="off"
            spellCheck={false}
            className={`${authFieldClass} font-mono`}
          />
          <p className="mt-2 text-xs text-zinc-500">
            {en
              ? "The code shown in your order email, with or without the # sign."
              : "အော်ဒါအီးမေးလ်တွင် ဖော်ပြထားသော ကုဒ် (# ပါသည်ဖြစ်စေ မပါသည်ဖြစ်စေ)။"}
          </p>
        </div>

        <div>
          <label htmlFor="track-phone" className={authLabelClass}>
            {en ? "Delivery phone number" : "ပို့ဆောင်ရန် ဖုန်းနံပါတ်"}
          </label>
          <input
            id="track-phone"
            required
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="09..."
            autoComplete="tel"
            className={authFieldClass}
          />
        </div>

        <button type="submit" disabled={isSubmitting} className={authButtonClass}>
          {isSubmitting
            ? en
              ? "Looking up..."
              : "ရှာဖွေနေသည်..."
            : en
              ? "Check my delivery"
              : "ပို့ဆောင်မှု စစ်ရန်"}
        </button>

        {error && (
          <p
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"
          >
            {error}
          </p>
        )}
      </form>

      {/* The result also renders here on narrow screens, where `aside` is
          hidden; the wide layout shows it beside the form instead. */}
      {tracking && (
        <div className="mt-7 lg:hidden">
          <TrackingResult tracking={tracking} en={en} />
        </div>
      )}

      <div className="mt-7 border-t border-zinc-200 pt-6 text-center text-sm text-zinc-600">
        {en ? "Have an account?" : "အကောင့်ရှိပါသလား?"}{" "}
        <Link
          href="/login"
          className="font-semibold text-red-600 underline underline-offset-4 hover:text-red-700"
        >
          {t("login.submit")}
        </Link>{" "}
        {en ? "to see every order." : "— အော်ဒါအားလုံး ကြည့်ရန်။"}
      </div>
    </AuthShell>
  );
}

function TrackingResult({
  tracking,
  en,
}: {
  tracking: GuestTrackingView;
  en: boolean;
}) {
  const progress = orderTracking({
    status: tracking.status,
    delivery_events: tracking.events.map((event) => ({
      stage: String(event.stage),
      happened_at: event.happened_at,
    })),
  });

  return (
    <div className={`${glassCardClass} sm:p-8`} role="status">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-red-600">
        {en ? "Order" : "အော်ဒါ"} #{tracking.code}
      </p>

      <h2 className="mt-3 text-2xl font-bold leading-tight">
        {progress.stage ? trackingLabels[progress.stage] : progress.label}
      </h2>

      {tracking.statusDetail && (
        <p className="mt-2 text-sm text-zinc-600">{tracking.statusDetail}</p>
      )}

      {/* Progress rail */}
      {progress.step >= 0 && (
        <ol className="mt-6 space-y-2">
          {trackingSteps.map((step, index) => {
            const done = index <= progress.step;
            return (
              <li key={step} className="flex items-center gap-3 text-sm">
                <span
                  aria-hidden
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                    done ? "bg-red-600" : "bg-zinc-300"
                  }`}
                />
                <span className={done ? "font-semibold text-zinc-900" : "text-zinc-500"}>
                  {trackingLabels[step]}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <dl className="mt-6 space-y-3 border-t border-zinc-200 pt-5 text-sm">
        <Row label={en ? "For" : "လက်ခံသူ"} value={tracking.recipientName} />
        <Row label={en ? "Destination" : "ပို့ဆောင်မည့်နေရာ"} value={tracking.destination} />
        <Row
          label={en ? "Items" : "ပစ္စည်းအရေအတွက်"}
          value={tracking.itemCount ? String(tracking.itemCount) : null}
        />
        <Row label={en ? "Courier" : "ပို့ဆောင်သူ"} value={tracking.courier} />
        <Row label={en ? "Tracking number" : "Tracking နံပါတ်"} value={tracking.trackingNumber} />
        <Row
          label={en ? "Estimated delivery" : "ခန့်မှန်းရောက်ရှိချိန်"}
          value={
            tracking.estimatedDeliveryAt
              ? formatDateTime(tracking.estimatedDeliveryAt)
              : null
          }
        />
        <Row
          label={en ? "Delivered" : "ရောက်ရှိပြီး"}
          value={tracking.deliveredAt ? formatDateTime(tracking.deliveredAt) : null}
        />
      </dl>

      {tracking.events.length > 0 && (
        <div className="mt-6 border-t border-zinc-200 pt-5">
          <h3 className="text-sm font-bold text-zinc-900">
            {en ? "History" : "မှတ်တမ်း"}
          </h3>
          <ol className="mt-3 space-y-3">
            {tracking.events.map((event) => (
              <li key={`${event.stage}-${event.happened_at}`} className="text-sm">
                <p className="font-semibold text-zinc-900">{event.title}</p>
                <p className="text-xs text-zinc-500">
                  {formatDateTime(event.happened_at)}
                  {event.location ? ` · ${event.location}` : ""}
                </p>
                {event.description && (
                  <p className="mt-1 text-zinc-600">{event.description}</p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;

  return (
    <div className="flex justify-between gap-4">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-right font-semibold text-zinc-900">{value}</dd>
    </div>
  );
}
