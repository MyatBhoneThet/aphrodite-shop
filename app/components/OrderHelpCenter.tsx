"use client";

import Link from "next/link";
import { useState } from "react";
import { authHeaders } from "../lib/client-auth";
import { useLanguage } from "../lib/language";
import { canCancelInstantly, HELP_TOPIC, helpChoices, returnWindow, returnWindowText, type HelpChoice, type HelpChoiceId, type HelpOrder } from "../lib/order-help";

type Props = {
  order: HelpOrder & { id: string };
  /** Opens the return form for this order. */
  onStartReturn: () => void;
  /** Cancels (at once, or as a request). Resolves to the message to show the customer. */
  onCancel: (reason: string) => Promise<string>;
};

/**
 * One front door for "I have a problem with this order". The customer says
 * what happened in plain words and lands in the right place: cancelling,
 * returning an item, or a help case with the order already attached.
 */
export default function OrderHelpCenter({ order, onStartReturn, onCancel }: Props) {
  const { text } = useLanguage();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<HelpChoiceId | null>(null);
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const choices = helpChoices(order);
  const returns = returnWindow(order);

  function close() {
    setOpen(false); setChoice(null); setSummary(""); setError(""); setDone("");
  }

  function pick(next: HelpChoice) {
    if (!next.enabled) return;
    setError("");
    if (next.id === "return") { onStartReturn(); close(); return; }
    setChoice(next.id);
  }

  async function submitCase(topic: "delivery" | "payment" | "warranty") {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/orders/${order.id}/help`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ topic, summary: summary.trim() }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "We could not send this. Please try again.");
      setDone(text("Thank you. Your case is open and the shop can already see your order, payment and delivery details. We will reply in your messages."));
      setChoice(null); setSummary("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not send this. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submitCancel() {
    setBusy(true); setError("");
    try {
      setDone(await onCancel(summary.trim()));
      setChoice(null); setSummary("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not cancel this order. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setOpen(true)} className="rounded-full bg-zinc-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-zinc-700">
          {text("Get help with this order")}
        </button>
        {returns.open && <span className="text-xs font-semibold text-orange-700">{returnWindowText(returns)}</span>}
      </div>
    );
  }

  const topic = choice && choice !== "cancel" && choice !== "return" ? HELP_TOPIC[choice] : null;
  const selected = choices.find((entry) => entry.id === choice) ?? null;

  return (
    <div className="mt-4 w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-black">{text("What do you need help with?")}</h3>
          <p className="mt-1 text-xs leading-5 text-zinc-600">{text("Pick the closest match. We already have your order details, so you only need to tell us what happened once.")}</p>
        </div>
        <button type="button" onClick={close} className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold">{text("Close")}</button>
      </div>

      {returns.open && <p className="mt-3 rounded-xl bg-orange-50 p-3 text-xs font-semibold text-orange-800">{returnWindowText(returns)}</p>}
      {done && <p role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-800">{done}</p>}

      {!done && !choice && (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {choices.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                disabled={!entry.enabled}
                onClick={() => pick(entry)}
                className="h-full w-full rounded-xl border bg-white p-4 text-left transition hover:border-red-400 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-zinc-200"
              >
                <span className="block text-sm font-bold">{text(entry.title)}</span>
                <span className="mt-1 block text-xs leading-5 text-zinc-600">{text(entry.enabled ? entry.detail : entry.unavailable ?? entry.detail)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!done && choice === "cancel" && (
        <div className="mt-4">
          <p className="rounded-xl bg-white p-3 text-sm">{text(selected?.detail ?? "")}{canCancelInstantly(order) ? "" : ` ${text("If you paid already, the shop will arrange your refund.")}`}</p>
          <label className="mt-3 block text-sm font-semibold">
            {text("Why are you cancelling?")}
            <textarea rows={2} maxLength={500} value={summary} onChange={(event) => setSummary(event.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3 text-sm font-normal outline-none focus:border-red-500" />
          </label>
          {error && <p role="alert" className="mt-2 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={busy || summary.trim().length < 3} onClick={() => void submitCancel()} className="rounded-full bg-red-600 px-6 py-2.5 text-sm font-bold text-white disabled:bg-zinc-400">
              {busy ? text("Please wait…") : canCancelInstantly(order) ? text("Cancel my order now") : text("Send cancellation request")}
            </button>
            <button type="button" onClick={() => { setChoice(null); setError(""); }} className="rounded-full border bg-white px-5 py-2.5 text-sm font-semibold">{text("Back")}</button>
          </div>
        </div>
      )}

      {!done && topic && (
        <div className="mt-4">
          <p className="text-sm font-bold">{text(selected?.title ?? "")}</p>
          <label className="mt-2 block text-sm font-semibold">
            {text("Tell us what happened")}
            <textarea rows={3} maxLength={1000} value={summary} onChange={(event) => setSummary(event.target.value)} placeholder={text("For example: what you expected, what you see, and when it started.")} className="mt-2 w-full rounded-xl border px-4 py-3 text-sm font-normal outline-none focus:border-red-500" />
          </label>
          {error && <p role="alert" className="mt-2 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={busy || summary.trim().length < 5} onClick={() => void submitCase(topic)} className="rounded-full bg-red-600 px-6 py-2.5 text-sm font-bold text-white disabled:bg-zinc-400">{busy ? text("Sending…") : text("Send to support")}</button>
            <button type="button" onClick={() => { setChoice(null); setError(""); }} className="rounded-full border bg-white px-5 py-2.5 text-sm font-semibold">{text("Back")}</button>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3 text-xs">
        <button type="button" onClick={() => { openChat(); close(); }} className="font-semibold text-red-600 hover:underline">{text("Chat with us now")}</button>
        <Link href="/returns" className="font-semibold text-red-600 hover:underline">{text("Return & refund policy")}</Link>
      </div>
    </div>
  );
}

function openChat() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("aphrodite:open-chat"));
}
