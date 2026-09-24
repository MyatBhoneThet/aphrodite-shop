"use client";

import Link from "next/link";
import { useState } from "react";
import { authHeaders } from "../lib/client-auth";
import { isApproximatelyInMyanmar } from "../lib/delivery-country";
import DeliveryPinPicker, { type DeliveryPin } from "./DeliveryPinPicker";

/**
 * Shown once, right after a customer logs in.
 *
 * ONE tap does two things: it tells the customer whether their device looks
 * like it is in Myanmar, and it shares that single position with store
 * administrators. There is deliberately no second "also share" button.
 *
 * Because it now saves, the copy below states that plainly BEFORE the button:
 * this screen used to promise the position never left the browser, and that
 * promise had to go rather than quietly become untrue.
 */
export default function DeliveryLocationWelcome() {
  const [status, setStatus] = useState<"idle" | "loading" | "inside" | "outside" | "error">("idle");
  const [message, setMessage] = useState("");
  const [shared, setShared] = useState(false);
  const [practicePin, setPracticePin] = useState<DeliveryPin | null>(null);

  function requestLocation() {
    if (!window.isSecureContext || !navigator.geolocation) {
      setStatus("error");
      setMessage("Location needs HTTPS (or localhost) and a supported browser. You can still enter a Myanmar delivery address at checkout.");
      return;
    }

    setStatus("loading");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;

        // Save first: the customer allowed it, so the position should reach the
        // shop even if the Myanmar verdict below is inconclusive.
        let savedOk = false;

        try {
          const response = await fetch("/api/location", {
            method: "POST",
            headers: { ...authHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({
              consent: true,
              latitude,
              longitude,
              accuracy_m: accuracy,
            }),
          });
          savedOk = response.ok;
        } catch {
          savedOk = false;
        }

        setShared(savedOk);

        // The Myanmar check needs a reasonably tight fix to mean anything.
        if (accuracy > 5000) {
          setStatus("error");
          setMessage(
            savedOk
              ? "Your location was shared with the store. It is too approximate to confirm the country, so please use your written Myanmar delivery address at checkout."
              : "The location is too approximate to check, and it could not be shared. Please use your written Myanmar delivery address at checkout."
          );
          return;
        }

        const inside = isApproximatelyInMyanmar(latitude, longitude);
        setStatus(inside ? "inside" : "outside");
        setMessage(
          [
            inside
              ? "Your device appears to be in Myanmar. Courier availability still depends on your delivery address."
              : "Your device appears to be outside Myanmar. We do not ship internationally, but you can order for a recipient with a Myanmar delivery address.",
            savedOk
              ? "Your location has been shared with authorised store administrators."
              : "It could not be shared with the store just now — you can try again from the Location page.",
          ].join(" ")
        );
      },
      (error) => {
        setStatus("error");
        setMessage(
          error.code === 1
            ? "Location was not allowed, so nothing was shared. You can enable it in your browser’s site permissions or continue without sharing."
            : "We could not get your location. Try again, or enter a Myanmar delivery address at checkout."
        );
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
    );
  }

  return (
    <main className="flex min-h-screen min-h-[100svh] items-center justify-center bg-zinc-50 px-4 py-6 text-zinc-950 sm:px-5 sm:py-10">
      <section aria-labelledby="delivery-welcome-title" className="w-full max-w-lg rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8 lg:p-10">
        <p className="text-sm font-bold uppercase tracking-widest text-red-600">Aphrodite Myanmar</p>
        <h1 id="delivery-welcome-title" className="mt-4 text-2xl font-bold sm:text-3xl">Where are we delivering?</h1>

        <p className="mt-4 leading-7 text-zinc-600">
          We deliver within Myanmar only. Allowing location does two things: it checks whether your device appears to be in Myanmar, and it shares that one position with authorised store administrators so they can review your orders.
        </p>
        <p className="mt-3 text-sm leading-6 text-zinc-500">
          One position is saved for up to 30 days, with the accuracy and time your device reports. There is no continuous tracking, and it does not change your delivery address. You can remove it at any time on the{" "}
          <Link href="/location" className="underline">Location page</Link>. Sharing is optional — you can continue without it.
        </p>

        <button
          type="button"
          disabled={status === "loading"}
          onClick={requestLocation}
          className="mt-6 w-full rounded-full bg-red-600 px-5 py-4 font-semibold text-white disabled:opacity-50"
        >
          {status === "loading" ? "Checking and sharing…" : "Allow and share my location"}
        </button>

        <div aria-live="polite" aria-atomic="true">
          {message && (
            <p className={`mt-4 rounded-2xl p-4 text-sm leading-6 ${status === "inside" ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-900"}`}>
              {message}
            </p>
          )}
        </div>

        <Link href="/" className="mt-3 block rounded-full border border-zinc-300 px-5 py-3 text-center font-semibold">
          {status === "idle" || status === "error" ? "Continue without sharing" : "Continue to shop"}
        </Link>

        {shared && (
          <p className="mt-3 text-center text-xs text-zinc-500">
            Shared. Remove it any time on the{" "}
            <Link href="/location" className="underline">Location page</Link>.
          </p>
        )}

        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-semibold text-blue-800">How do I place my delivery pin?</summary>
          <div className="mt-4"><DeliveryPinPicker value={practicePin} onChange={setPracticePin} preview /></div>
        </details>

        <p className="mt-5 text-xs leading-5 text-zinc-500">
          Location is optional and cannot prove identity. Approximate boundaries:{" "}
          <a href="https://www.geoboundaries.org/" target="_blank" rel="noreferrer" className="underline">geoBoundaries</a> /{" "}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap</a>. Border or island locations may need manual confirmation.
        </p>
      </section>
    </main>
  );
}
