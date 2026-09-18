"use client";

import { useState } from "react";
import { authHeaders } from "../lib/client-auth";
import { useLanguage } from "../lib/language";

type Topic = "payment" | "delivery" | "faulty_item" | "cancel_order" | "warranty";

const TOPICS: Topic[] = [
  "payment",
  "delivery",
  "faulty_item",
  "cancel_order",
  "warranty",
];

/**
 * One button per order. The customer picks the topic and says what happened
 * once; the server attaches the order, its payment history, its delivery
 * updates and the existing chat, so nothing has to be explained twice.
 */
export default function OrderHelpButton({ orderId }: { orderId: string }) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [topic, setTopic] = useState<Topic>("delivery");
  const [summary, setSummary] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit() {
    if (summary.trim().length < 5 || isSending) return;

    setIsSending(true);
    setError("");

    try {
      const response = await fetch(`/api/orders/${orderId}/help`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ topic, summary: summary.trim() }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Unable to open your case.");

      setSent(true);
      setSummary("");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to open your case."
      );
    } finally {
      setIsSending(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-full bg-zinc-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-zinc-700"
      >
        {t("help.button")}
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-black">{t("help.title")}</h3>
          <p className="mt-1 text-xs leading-5 text-zinc-600">{t("help.intro")}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsOpen(false);
            setSent(false);
            setError("");
          }}
          className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold"
        >
          {t("common.close")}
        </button>
      </div>

      {sent ? (
        <p role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-800">
          {t("help.sent")}
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {TOPICS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTopic(value)}
                aria-pressed={topic === value}
                className={`rounded-full px-4 py-2 text-xs font-bold ${
                  topic === value
                    ? "bg-red-600 text-white"
                    : "border bg-white hover:border-red-400"
                }`}
              >
                {t(`help.topic.${value}`)}
              </button>
            ))}
          </div>

          <label className="mt-4 block text-sm font-semibold">
            {t("help.summary")}
            <textarea
              rows={3}
              maxLength={1000}
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder={t("help.summaryPlaceholder")}
              className="mt-2 w-full rounded-xl border px-4 py-3 text-sm font-normal outline-none focus:border-red-500"
            />
          </label>

          {error && (
            <p role="alert" className="mt-2 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={isSending || summary.trim().length < 5}
            className="mt-4 rounded-full bg-red-600 px-6 py-2.5 text-sm font-bold text-white disabled:bg-zinc-400"
          >
            {isSending ? t("help.sending") : t("help.submit")}
          </button>
        </>
      )}
    </div>
  );
}
