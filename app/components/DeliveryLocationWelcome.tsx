"use client";

import Link from "next/link";
import { useState } from "react";
import { isApproximatelyInMyanmar } from "../lib/delivery-country";
import DeliveryPinPicker, { type DeliveryPin } from "./DeliveryPinPicker";

export default function DeliveryLocationWelcome() {
  const [status, setStatus] = useState<"idle" | "loading" | "inside" | "outside" | "error">("idle");
  const [message, setMessage] = useState("");
  const [practicePin, setPracticePin] = useState<DeliveryPin | null>(null);

  function requestLocation() {
    if (!window.isSecureContext || !navigator.geolocation) {
      setStatus("error");
      setMessage("Location needs HTTPS (or localhost) and a supported browser. You can still enter a Myanmar delivery address at checkout.");
      return;
    }
    setStatus("loading");
    navigator.geolocation.getCurrentPosition((position) => {
      if (position.coords.accuracy > 5000) {
        setStatus("error");
        setMessage("The location is too approximate to check. Please use your written Myanmar delivery address at checkout.");
        return;
      }
      const inside = isApproximatelyInMyanmar(position.coords.latitude, position.coords.longitude);
      setStatus(inside ? "inside" : "outside");
      setMessage(inside
        ? "Your device appears to be in Myanmar. Courier availability still depends on your delivery address."
        : "Your device appears to be outside Myanmar. We do not ship internationally, but you can order for a recipient with a Myanmar delivery address.");
    }, (error) => {
      setStatus("error");
      setMessage(error.code === 1
        ? "Location was not allowed. You can enable it in your browser’s site permissions or continue without sharing."
        : "We could not get your location. Try again, or enter a Myanmar delivery address at checkout.");
    }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-5 py-10 text-zinc-950">
      <section aria-labelledby="delivery-welcome-title" className="w-full max-w-lg rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm sm:p-10">
        <p className="text-sm font-bold uppercase tracking-widest text-red-600">Aphrodite Myanmar</p>
        <h1 id="delivery-welcome-title" className="mt-4 text-3xl font-bold">Where are we delivering?</h1>
        <p className="mt-4 leading-7 text-zinc-600">We deliver within Myanmar only. Allow a one-time location check to see whether your device appears to be in Myanmar.</p>
        <p className="mt-3 text-sm leading-6 text-zinc-500">This check stays in your browser. It does not save your coordinates, share them with an administrator, or track you. Your delivery address is confirmed separately at checkout.</p>
        <button type="button" disabled={status === "loading"} onClick={requestLocation} className="mt-6 w-full rounded-full bg-red-600 px-5 py-4 font-semibold text-white disabled:opacity-50">{status === "loading" ? "Checking location…" : "Allow location check"}</button>
        <div aria-live="polite" aria-atomic="true">{message && <p className={`mt-4 rounded-2xl p-4 text-sm leading-6 ${status === "inside" ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-900"}`}>{message}</p>}</div>
        <Link href="/" className="mt-3 block rounded-full border border-zinc-300 px-5 py-3 text-center font-semibold">{status === "idle" || status === "error" ? "Continue without location" : "Continue to shop"}</Link>
        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-semibold text-blue-800">How do I place my delivery pin?</summary>
          <div className="mt-4"><DeliveryPinPicker value={practicePin} onChange={setPracticePin} preview /></div>
        </details>
        <p className="mt-5 text-xs leading-5 text-zinc-500">Location is optional and cannot prove identity. Approximate boundaries: <a href="https://www.geoboundaries.org/" target="_blank" rel="noreferrer" className="underline">geoBoundaries</a> / <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap</a>. Border or island locations may need manual confirmation.</p>
      </section>
    </main>
  );
}
