"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapPoint = { latitude: number; longitude: number };

const towns = [
  { name: "Yangon", latitude: 16.8409, longitude: 96.1735 },
  { name: "Mandalay", latitude: 21.9588, longitude: 96.0891 },
  { name: "Naypyidaw", latitude: 19.7633, longitude: 96.0785 },
];

/** Mounted only after the customer chooses to load the third-party map. */
export default function DeliveryMap({ point, onSelect }: {
  point: MapPoint | null;
  onSelect: (point: MapPoint) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const initialPoint = useRef(point);
  const select = useRef(onSelect);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { select.current = onSelect; }, [onSelect]);

  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    void import("leaflet").then((L) => {
      if (disposed || !container.current) return;
      const start = initialPoint.current;
      const instance = L.map(container.current, {
        center: start ? [start.latitude, start.longitude] : [21.0, 96.0],
        zoom: start ? 17 : 6,
        minZoom: 4,
        maxZoom: 19,
        // Navigation boundary only, not a country-verification boundary.
        maxBounds: [[8, 90], [31, 103]],
        maxBoundsViscosity: 1,
        scrollWheelZoom: false,
      });
      map.current = instance;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        keepBuffer: 0,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      }).on("tileerror", () => {
        if (!disposed) setError("Some map images could not load. Try your connection, enter coordinates below, or request address confirmation by phone.");
      }).addTo(instance);
      const icon = L.divIcon({
        className: "delivery-pin-icon",
        html: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 44" width="32" height="44" aria-hidden="true"><path d="M16 1C7.7 1 1 7.7 1 16c0 11 15 26 15 26s15-15 15-26C31 7.7 24.3 1 16 1Z" fill="#dc2626" stroke="white" stroke-width="2"/><circle cx="16" cy="16" r="5" fill="white"/></svg>',
        iconSize: [32, 44],
        iconAnchor: [16, 44],
      });
      const pin = L.marker(start ? [start.latitude, start.longitude] : [21, 96], {
        icon,
        draggable: true,
        title: "Delivery pin — drag to your entrance",
        alt: "Customer-selected delivery pin",
      });
      marker.current = pin;
      if (start) pin.addTo(instance);
      pin.on("dragend", () => {
        const p = pin.getLatLng();
        select.current({ latitude: p.lat, longitude: p.lng });
      });
      instance.on("click", (event) => select.current({ latitude: event.latlng.lat, longitude: event.latlng.lng }));
      observer = new ResizeObserver(() => instance.invalidateSize());
      observer.observe(container.current);
      setReady(true);
    }).catch(() => {
      if (!disposed) setError("The map could not start. Use coordinates below or ask staff to confirm your written address.");
    });
    return () => {
      disposed = true;
      observer?.disconnect();
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !map.current || !marker.current) return;
    if (!point) {
      marker.current.remove();
      return;
    }
    marker.current.setLatLng([point.latitude, point.longitude]).addTo(map.current);
    if (!map.current.getBounds().contains([point.latitude, point.longitude])) {
      map.current.setView([point.latitude, point.longitude], 17);
    }
  }, [point, ready]);

  return (
    <div>
      <label className="mb-3 flex flex-wrap items-center gap-2 text-sm font-semibold">
        Start near
        <select defaultValue="" onChange={(event) => {
          const town = towns.find((item) => item.name === event.target.value);
          if (town) map.current?.setView([town.latitude, town.longitude], 14);
        }} className="rounded-lg border bg-white px-3 py-2">
          <option value="">Choose a city (optional)</option>
          {towns.map((town) => <option key={town.name}>{town.name}</option>)}
        </select>
      </label>
      <div ref={container} role="region" aria-label="Delivery map. Click to place a pin, drag it to adjust, or use the map centre button." className="relative z-0 h-80 w-full overflow-hidden rounded-xl border bg-zinc-100" />
      <button type="button" disabled={!ready} className="mt-3 rounded-full border bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50" onClick={() => {
        const centre = map.current?.getCenter();
        if (centre) select.current({ latitude: centre.lat, longitude: centre.lng });
      }}>Use map centre as pin</button>
      <p className="mt-2 text-xs text-zinc-600">Zoom to your building entrance, then click or drag the red pin. Keyboard: focus the map, use arrow keys and +/−, then select the centre.</p>
      {error && <p role="status" className="mt-2 text-xs text-amber-900">{error}</p>}
    </div>
  );
}
