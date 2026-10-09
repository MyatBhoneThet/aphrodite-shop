"use client";

import { useAdminText } from "../lib/useAdminText";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";

export type LocationPin = { id: string; latitude: number; longitude: number; label: string };

/** World map of shared customer device locations (any country). */
export default function CustomerLocationsMap({ pins, focus }: { pins: LocationPin[]; focus: string | null }) {
  const a = useAdminText();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const leaflet = useRef<typeof import("leaflet") | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    void import("leaflet").then((L) => {
      if (disposed || !container.current) return;
      leaflet.current = L;
      const instance = L.map(container.current, { center: [20, 0], zoom: 2, minZoom: 2, maxZoom: 19, worldCopyJump: true, scrollWheelZoom: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      }).on("tileerror", () => { if (!disposed) setError("Some map images could not load. The list below still works."); }).addTo(instance);
      map.current = instance;
      layer.current = L.layerGroup().addTo(instance);
      observer = new ResizeObserver(() => instance.invalidateSize());
      observer.observe(container.current);
      setReady(true);
    }).catch(() => { if (!disposed) setError("The map could not start. Use the list below."); });
    return () => { disposed = true; observer?.disconnect(); map.current?.remove(); map.current = null; layer.current = null; };
  }, []);

  useEffect(() => {
    const L = leaflet.current;
    if (!ready || !L || !map.current || !layer.current) return;
    layer.current.clearLayers();
    const icon = L.divIcon({
      className: "",
      html: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 44" width="26" height="36" aria-hidden="true"><path d="M16 1C7.7 1 1 7.7 1 16c0 11 15 26 15 26s15-15 15-26C31 7.7 24.3 1 16 1Z" fill="#dc2626" stroke="white" stroke-width="2"/><circle cx="16" cy="16" r="5" fill="white"/></svg>',
      iconSize: [26, 36],
      iconAnchor: [13, 36],
    });
    for (const pin of pins) {
      // Leaflet renders tooltip strings as HTML, so escape customer-provided names.
      const safe = pin.label.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
      L.marker([pin.latitude, pin.longitude], { icon, title: pin.label, alt: pin.label }).bindTooltip(safe).addTo(layer.current);
    }
    if (pins.length === 1) map.current.setView([pins[0].latitude, pins[0].longitude], 12);
    else if (pins.length > 1) map.current.fitBounds(L.latLngBounds(pins.map((p) => [p.latitude, p.longitude] as [number, number])), { padding: [40, 40], maxZoom: 12 });
  }, [pins, ready]);

  useEffect(() => {
    const pin = pins.find((p) => p.id === focus);
    if (ready && pin && map.current) map.current.setView([pin.latitude, pin.longitude], 15);
  }, [focus, pins, ready]);

  return <div>
    <div ref={container} role="region" aria-label={a("Map of shared customer device locations")} className="relative z-0 h-96 w-full overflow-hidden rounded-xl border bg-zinc-100" />
    {error && <p role="status" className="mt-2 text-xs text-amber-900">{a(error)}</p>}
  </div>;
}
