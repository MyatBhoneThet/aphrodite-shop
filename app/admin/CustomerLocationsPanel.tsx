"use client";

import { useAdminText } from "../lib/useAdminText";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { authHeaders } from "../lib/client-auth";
import type { LocationShare } from "../lib/location-share";

const CustomerLocationsMap = dynamic(() => import("./CustomerLocationsMap"), {
  ssr: false,
  loading: () => <div className="flex h-96 items-center justify-center rounded-xl border bg-zinc-50 text-sm text-zinc-500">Loading map…</div>,
});

type SharedLocation = LocationShare & { user_id: string; email: string | null; full_name: string | null; phone: string | null };

export default function CustomerLocationsPanel() {
  const a = useAdminText();
  const [locations, setLocations] = useState<SharedLocation[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [focus, setFocus] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setStatus("loading"); setMessage("");
    try {
      const response = await fetch("/api/admin/customer-locations", { headers: authHeaders(), cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load customer locations.");
      setLocations(data.locations ?? []); setStatus("ready");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load customer locations."); setStatus("error"); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    return text ? locations.filter((l) => [l.full_name, l.email, l.phone].some((v) => v?.toLowerCase().includes(text))) : locations;
  }, [locations, query]);
  const pins = useMemo(() => visible.map((l) => ({ id: l.user_id, latitude: l.latitude, longitude: l.longitude, label: l.full_name || l.email || "Customer" })), [visible]);

  return <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-100">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold">{a("Customer device locations")}</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-600">{a("Customers who chose")} <strong>{a("Allow and share location")}</strong>{a(", from any country. Each share is one device position kept for up to 30 days. Customers can remove it at any time. It is not proof of identity or of the delivery address.")}</p>
      </div>
      <div className="flex w-full flex-wrap gap-2 sm:w-auto">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={a("Search name, email, phone")} className="rounded-lg border px-3 py-2 text-sm" />
        <button type="button" onClick={() => void load()} disabled={status === "loading"} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50">{status === "loading" ? a("Loading…") : a("Refresh")}</button>
      </div>
    </div>

    {status === "error" && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{a(message)}</p>}

    <div className="mt-5"><CustomerLocationsMap pins={pins} focus={focus} /></div>

    {status === "ready" && visible.length === 0 && <p className="mt-5 rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600">{locations.length === 0 ? a("No customer has shared a location yet. Signed-in customers see an \"Allow and share location\" box and can also use the /location page.") : a("No customers match your search.")}</p>}

    {visible.length > 0 && <div className="mt-5 overflow-x-auto" tabIndex={0} role="region" aria-label={a("Shared customer locations")}>
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b text-xs uppercase text-zinc-500"><tr><th className="py-2 pr-3">{a("Customer")}</th><th className="py-2 pr-3">{a("Coordinates")}</th><th className="py-2 pr-3">{a("Accuracy")}</th><th className="py-2 pr-3">{a("Shared")}</th><th className="py-2">{a("Actions")}</th></tr></thead>
        <tbody>{visible.map((l) => <tr key={l.user_id} className={`border-b last:border-0 ${focus === l.user_id ? "bg-red-50" : ""}`}>
          <td className="py-3 pr-3"><p className="font-semibold">{l.full_name || "—"}</p><p className="text-xs text-zinc-500">{l.email ?? a("Unknown account")}{l.phone ? ` · ${l.phone}` : ""}</p></td>
          <td className="py-3 pr-3 font-mono text-xs">{l.latitude.toFixed(5)}, {l.longitude.toFixed(5)}</td>
          <td className="py-3 pr-3">±{Math.round(l.accuracy_m).toLocaleString()}  {a("m")}</td>
          <td className="py-3 pr-3 text-xs">{new Date(l.captured_at).toLocaleString()}<br /><span className="text-zinc-500">{a("expires")} {new Date(l.expires_at).toLocaleDateString()}</span></td>
          <td className="py-3"><div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setFocus(l.user_id)} className="rounded-full border px-3 py-1 text-xs font-semibold">{a("Show on map")}</button>
            <a href={`https://www.google.com/maps?q=${l.latitude},${l.longitude}`} target="_blank" rel="noreferrer" className="rounded-full border px-3 py-1 text-xs font-semibold text-blue-800">{a("Google Maps ↗")}</a>
          </div></td>
        </tr>)}</tbody>
      </table>
    </div>}
  </section>;
}
