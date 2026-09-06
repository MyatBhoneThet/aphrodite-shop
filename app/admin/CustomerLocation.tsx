"use client";
import { useState } from "react";
import type { LocationShare } from "../lib/location-share";
import { authHeaders } from "../lib/client-auth";

export default function CustomerLocation({ userId }: { userId: string }) {
  const [location, setLocation] = useState<LocationShare | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true); setLocation(null); setMessage("");
    try {
      const response = await fetch(`/api/admin/customer-location/${encodeURIComponent(userId)}`, { headers: authHeaders(), cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load customer location.");
      setLocation(data.location); if (!data.location) setMessage("No current location shared. The customer may have declined, removed it, or it expired.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load location."); }
    finally { setBusy(false); }
  }
  return <div className="mt-3"><button type="button" onClick={load} disabled={busy} className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-50">{busy ? "Loading…" : "View shared device location"}</button>{location && <div className="mt-2 rounded-xl bg-blue-50 p-3 text-xs leading-5"><a href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`} target="_blank" rel="noreferrer" className="font-semibold text-blue-800 underline">Open device location on map ↗</a><p>Accuracy: ±{Math.round(location.accuracy_m)} m</p><p>Shared {new Date(location.captured_at).toLocaleString()}</p><p>Customer device report; not proof of identity or delivery address.</p></div>}<p role="status" className="mt-2 text-xs text-zinc-500">{message}</p></div>;
}
