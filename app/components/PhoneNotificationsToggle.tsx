"use client";

import { useCallback, useEffect, useState } from "react";
import { disablePush, enablePush, getPushStatus, type PushStatus } from "../lib/push-client";
import { useLanguage } from "../lib/language";

/** Turns phone notifications on or off for THIS device, with plain-language help when it cannot work. */
export default function PhoneNotificationsToggle({ compact = false }: { compact?: boolean }) {
  const { text } = useLanguage();
  const [status, setStatus] = useState<PushStatus>("checking");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => setStatus(await getPushStatus()), []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  async function turnOn() {
    setBusy(true); setMessage("");
    const result = await enablePush();
    if (!result.ok) setMessage(result.message);
    await refresh();
    setBusy(false);
  }

  async function turnOff() {
    setBusy(true); setMessage("");
    await disablePush();
    await refresh();
    setBusy(false);
  }

  if (status === "checking") return null;

  const note = (body: string) => <p className="text-xs leading-5 text-zinc-600">{text(body)}</p>;

  return (
    <div className={compact ? "" : "rounded-2xl border border-zinc-200 bg-white p-4"}>
      <p className="text-sm font-bold">{text("Phone notifications")}</p>
      {status === "on" && (
        <>
          {note("You will get order updates, followed-product alerts and cart reminders on this phone, even when the website is closed.")}
          <button type="button" disabled={busy} onClick={() => void turnOff()} className="mt-2 rounded-full border px-4 py-1.5 text-xs font-semibold hover:border-red-500 hover:text-red-600 disabled:opacity-50">{busy ? text("Please wait…") : text("Turn off on this phone")}</button>
        </>
      )}
      {status === "off" && (
        <>
          {note("Get a message on your phone when your order moves, a product you follow is back or cheaper, or the shop replies.")}
          <button type="button" disabled={busy} onClick={() => void turnOn()} className="mt-2 rounded-full bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50">{busy ? text("Please wait…") : text("Turn on phone notifications")}</button>
        </>
      )}
      {status === "needs-install" && note("On iPhone: tap the Share button in Safari, choose “Add to Home Screen”, then open Aphrodite from your Home Screen and turn this on there.")}
      {status === "denied" && note("Notifications are blocked for this site. Allow them in your browser or phone settings, then come back here.")}
      {status === "unsupported" && note("This browser cannot show phone notifications. You will still see updates in the bell and by email.")}
      {status === "unavailable" && note("Phone notifications are not available right now. You will still see updates in the bell and by email.")}
      {message && <p role="alert" className="mt-2 text-xs font-semibold text-red-600">{message}</p>}
    </div>
  );
}
