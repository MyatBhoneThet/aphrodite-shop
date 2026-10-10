"use client";

import { authHeaders } from "./client-auth";

/**
 * Browser side of phone notifications. Everything here must run from a tap
 * (browsers refuse to ask for permission otherwise), so nothing prompts on
 * its own.
 */

export type PushStatus =
  | "checking"
  | "unsupported" // this browser cannot show them at all
  | "needs-install" // iPhone/iPad: only works once the site is added to the Home Screen
  | "denied" // the customer blocked them in the browser
  | "unavailable" // the shop has not finished setting them up
  | "off"
  | "on";

const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export async function getPushStatus(): Promise<PushStatus> {
  if (typeof window === "undefined") return "checking";
  if (!supported()) return isIos() && !isStandalone() ? "needs-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    const subscription = await registration?.pushManager.getSubscription();
    return Notification.permission === "granted" && subscription ? "on" : "off";
  } catch {
    return "off";
  }
}

function keyToBytes(base64Url: string) {
  const padded = base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export async function enablePush(): Promise<{ ok: true } | { ok: false; reason: PushStatus; message: string }> {
  if (!supported()) {
    return isIos() && !isStandalone()
      ? { ok: false, reason: "needs-install", message: "On iPhone, first add this site to your Home Screen, then open it from there." }
      : { ok: false, reason: "unsupported", message: "This browser cannot show phone notifications." };
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, reason: permission === "denied" ? "denied" : "off", message: "Notifications were not allowed. You can change this in your browser settings." };
  }
  try {
    const keyResponse = await fetch("/api/notifications/push", { headers: authHeaders(), cache: "no-store" });
    const { publicKey } = (await keyResponse.json().catch(() => ({ publicKey: null }))) as { publicKey: string | null };
    if (!keyResponse.ok || !publicKey) {
      return { ok: false, reason: "unavailable", message: "Phone notifications are not available right now. Please try again later." };
    }
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) }));
    const saved = await fetch("/api/notifications/push", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });
    if (!saved.ok) {
      const body = (await saved.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, reason: "off", message: body?.error ?? "Could not turn on phone notifications." };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "off", message: "Could not turn on phone notifications. Please try again." };
  }
}

export async function disablePush() {
  try {
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    await fetch("/api/notifications/push", {
      method: "DELETE",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    }).catch(() => undefined);
    await subscription.unsubscribe();
  } catch {
    /* already off */
  }
}
