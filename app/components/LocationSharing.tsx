"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { authHeaders } from "../lib/client-auth";
import { useCurrentUser } from "../lib/useCurrentUser";
import type { LocationShare } from "../lib/location-share";

export default function LocationSharing({ expanded = false }: { expanded?: boolean }) {
  const { user, status } = useCurrentUser();
  const pathname = usePathname();
  const [open, setOpen] = useState(expanded);
  const [busy, setBusy] = useState(false);
  const [location, setLocation] = useState<LocationShare | null>(null);
  const [locationOwner, setLocationOwner] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const version = useRef(0);
  const loadedUser = useRef<string | null>(null);
  const key = `aphrodite-location-choice:${user?.id ?? "guest"}`;

  useEffect(() => {
    let cancelled = false;
    if (!user?.id || user.role === "admin") {
      loadedUser.current = null;
      return;
    }
    loadedUser.current = user.id;
    void fetch("/api/location", { headers: authHeaders(), cache: "no-store" }).then(async response => {
      const data = await response.json();
      if (cancelled || loadedUser.current !== user.id || !response.ok) return;
      setLocation(data.location ?? null);
      setLocationOwner(user.id);
      if (!data.location && !sessionStorage.getItem(key)) setOpen(true);
    }).catch(() => {});
    return () => { cancelled = true; version.current += 1; };
  }, [user?.id, user?.role, key]);

  function dismiss() {
    version.current += 1;
    setBusy(false);
    sessionStorage.setItem(key, "dismissed");
    setOpen(false);
  }

  function share() {
    const userId = user?.id;
    if (!userId) return;
    if (!window.isSecureContext || !navigator.geolocation) {
      setMessage("Open this site using HTTPS in your browser to share location. You can still shop without sharing."); return;
    }
    const current = ++version.current;
    setBusy(true); setMessage("");
    navigator.geolocation.getCurrentPosition(async position => {
      if (current !== version.current) return;
      try {
        const response = await fetch("/api/location", {
          method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ consent: true, latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy_m: position.coords.accuracy }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to save your location. Please try again.");
        if (current !== version.current) return;
        setLocation(data.location); setLocationOwner(userId); sessionStorage.setItem(key, "shared");
        setMessage("Your location was shared with authorised store administrators. You can remove it here at any time.");
      } catch (error) { if (current === version.current) setMessage(error instanceof Error ? error.message : "Unable to share location."); }
      finally { if (current === version.current) setBusy(false); }
    }, error => {
      if (current !== version.current) return;
      setBusy(false);
      setMessage(error.code === 1 ? "Permission was not granted. You can change location permission in your browser’s site settings, or continue without sharing." : "Your device could not find a position. Please try again or continue without sharing.");
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  }

  async function remove() {
    const userId = user?.id;
    if (!userId) return;
    version.current += 1; setBusy(true);
    try {
      const response = await fetch("/api/location", { method: "DELETE", headers: authHeaders() });
      if (!response.ok) throw new Error("Unable to remove the location. Please try again.");
      setLocation(null); setLocationOwner(userId); sessionStorage.setItem(key, "removed");
      setMessage("Your shared location has been removed.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to remove location."); }
    finally { setBusy(false); }
  }

  if (status === "checking" || user?.role === "admin") return null;
  if (!user) return expanded ? <p className="rounded-2xl bg-zinc-50 p-6"><Link href="/login" className="font-semibold text-red-700 underline">Sign in</Link> to share your location with the store.</p> : null;
  if (!expanded && (!open || pathname.startsWith("/admin") || ["/login", "/register", "/location"].includes(pathname))) return null;

  const visibleLocation = locationOwner === user.id ? location : null;

  return <section aria-labelledby={expanded ? "location-page-title" : "location-banner-title"} className={expanded ? "rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8" : "fixed bottom-5 right-5 z-[80] max-h-[80vh] w-[calc(100%-2.5rem)] max-w-sm overflow-y-auto rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl"}>
    <p className="text-xs font-semibold uppercase tracking-widest text-red-600">Optional location sharing</p>
    <h2 id={expanded ? "location-page-title" : "location-banner-title"} className="mt-2 text-xl font-bold">Help us review your order</h2>
    <p className="mt-3 text-sm leading-6 text-zinc-600">Share your current device location from any country. Authorised store administrators can view it when checking your orders. It does not change your delivery address.</p>
    <p className="mt-2 text-xs leading-5 text-zinc-500">One position is saved for up to 30 days, with device-reported accuracy and time. No continuous tracking. Location can be inaccurate or spoofed and is not identity proof.</p>
    {visibleLocation && <div className="mt-4 rounded-xl bg-zinc-50 p-3 text-sm"><p>Shared: {visibleLocation.latitude.toFixed(5)}, {visibleLocation.longitude.toFixed(5)}</p><p className="mt-1 text-xs text-zinc-500">Accuracy: about {Math.round(visibleLocation.accuracy_m)} m · {new Date(visibleLocation.captured_at).toLocaleString()}</p></div>}
    <button type="button" disabled={busy} onClick={share} className="mt-5 w-full rounded-full bg-red-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Please wait…" : visibleLocation ? "Share updated location" : "Allow and share location"}</button>
    {visibleLocation && <button type="button" disabled={busy} onClick={remove} className="mt-2 w-full rounded-full border px-5 py-3 text-sm font-semibold disabled:opacity-50">Remove shared location</button>}
    {!expanded && <button type="button" disabled={busy} onClick={dismiss} className="mt-2 w-full py-2 text-sm text-zinc-600 disabled:opacity-50">{visibleLocation ? "Close" : "Not now"}</button>}
    <p role="status" className="mt-3 text-sm leading-6 text-zinc-700">{message}</p>
    {!expanded && <Link href="/location" className="text-xs text-zinc-500 underline">Manage location sharing</Link>}
  </section>;
}
