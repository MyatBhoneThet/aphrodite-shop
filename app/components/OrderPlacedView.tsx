"use client";

import Link from "next/link";
import { useState } from "react";
import { authHeaders } from "../lib/client-auth";

const ratingWords = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

export default function OrderPlacedView({
  orderId,
  prepaid,
  title,
}: {
  orderId: string;
  prepaid: boolean;
  title: string;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const shown = hover || rating;

  async function submit() {
    if (rating < 1) { setError("Please tap a star rating first."); return; }
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ order_id: orderId, rating, note: note.trim() || null }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Could not send your feedback. Please try again.");
      }
      setSent(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send your feedback.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-red-50 via-white to-zinc-50 px-5 py-12 text-zinc-950">
      <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-red-200/40 blur-3xl" />
      <div className="relative w-full max-w-xl space-y-5">
        <section className="rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-xl shadow-red-100/40">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
            <svg viewBox="0 0 24 24" className="h-10 w-10 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </div>
          <h1 className="mt-5 text-3xl font-black">{title}</h1>
          <p className="mt-2 inline-block rounded-full bg-zinc-100 px-4 py-1.5 text-sm font-bold tracking-wide text-zinc-700">Order #{orderId.slice(0, 8).toUpperCase()}</p>
          <p className="mx-auto mt-4 max-w-md text-zinc-500">
            {prepaid
              ? "Thank you! We've received your order. Upload or confirm your payment slip from My orders so we can verify it and start shipping."
              : "Thank you! Your order is now pending COD verification. Please keep your phone available. The store may call before approving and shipping your order."}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href={`/orders/${orderId}`} className="rounded-full bg-red-600 px-6 py-3 font-semibold text-white shadow-md shadow-red-200 transition hover:bg-red-700">Track this order</Link>
            <Link href="/orders" className="rounded-full border border-zinc-300 px-6 py-3 font-semibold transition hover:border-red-500 hover:text-red-600">View my orders</Link>
            <Link href="/" className="rounded-full border border-zinc-300 px-6 py-3 font-semibold transition hover:border-red-500 hover:text-red-600">Continue shopping</Link>
          </div>
        </section>

        <section className="rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm">
          {sent ? (
            <div className="py-4 text-center">
              <p className="text-4xl" aria-hidden>💛</p>
              <h2 className="mt-3 text-xl font-black">Thank you for your feedback!</h2>
              <p className="mt-1 text-sm text-zinc-500">It helps us make Aphrodite better for everyone.</p>
            </div>
          ) : (
            <>
              <h2 className="text-center text-xl font-black">How was your shopping experience?</h2>
              <p className="mt-1 text-center text-sm text-zinc-500">Rate our website and tell us what we can improve.</p>
              <div className="mt-5 flex justify-center gap-1" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    role="radio"
                    aria-checked={rating === star}
                    aria-label={`${star} star${star === 1 ? "" : "s"}`}
                    onMouseEnter={() => setHover(star)}
                    onClick={() => { setRating(star); setError(""); }}
                    className="rounded-lg p-1 transition hover:scale-110 focus-visible:outline-2 focus-visible:outline-red-600"
                  >
                    <svg viewBox="0 0 24 24" className={`h-11 w-11 ${star <= shown ? "text-amber-400" : "text-zinc-200"}`} fill="currentColor" aria-hidden><path d="M12 2.5l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.52l-5.88 3.09 1.12-6.55L2.48 9.42l6.58-.96L12 2.5z" /></svg>
                  </button>
                ))}
              </div>
              <p className="mt-1 h-5 text-center text-sm font-bold text-amber-600">{ratingWords[shown]}</p>
              <label htmlFor="feedback-note" className="mt-4 block text-sm font-semibold">Review notes <span className="font-normal text-zinc-400">(optional)</span></label>
              <textarea
                id="feedback-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={1000}
                rows={4}
                placeholder="What did you like? What could be better?"
                className="mt-2 w-full resize-none rounded-2xl border border-zinc-300 p-4 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
              />
              {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-600">{error}</p>}
              <button type="button" onClick={() => void submit()} disabled={sending} className="mt-4 w-full rounded-full bg-zinc-900 px-6 py-3 font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-60">
                {sending ? "Sending..." : "Send feedback"}
              </button>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
