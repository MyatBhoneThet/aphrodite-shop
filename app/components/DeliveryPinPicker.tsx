"use client";

import { useLanguage } from "../lib/language";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { isApproximatelyInMyanmar } from "../lib/delivery-country";
import type { MapPoint } from "./DeliveryMap";

const DeliveryMap = dynamic(() => import("./DeliveryMap"), {
  ssr: false,
  loading: () => <MapLoading />,
});

function MapLoading() {
  const { text } = useLanguage();
  return <p className="rounded-xl bg-zinc-100 p-6 text-sm">{text("Loading map…")}</p>;
}

export type DeliveryPin = MapPoint & {
  // Unknown for a manually placed pin; never invent GPS accuracy.
  accuracy_m: number | null;
  captured_at: string;
};

export default function DeliveryPinPicker({ value, onChange, preview = false }: {
  value: DeliveryPin | null;
  onChange: (pin: DeliveryPin | null) => void;
  preview?: boolean;
}) {
  const { text, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [candidate, setCandidate] = useState<DeliveryPin | null>(value);
  const [latitude, setLatitude] = useState(value ? String(value.latitude) : "");
  const [longitude, setLongitude] = useState(value ? String(value.longitude) : "");
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState("");
  const requestVersion = useRef(0);

  useEffect(() => () => { requestVersion.current += 1; }, []);

  function choosePoint(point: MapPoint, accuracy: number | null = null) {
    requestVersion.current += 1;
    setLocating(false);
    onChange(null);
    setCandidate({ ...point, accuracy_m: accuracy, captured_at: new Date().toISOString() });
    setLatitude(point.latitude.toFixed(6));
    setLongitude(point.longitude.toFixed(6));
    setMessage(isApproximatelyInMyanmar(point.latitude, point.longitude)
      ? text("Check that the red pin is at the recipient’s entrance, then confirm below.")
      : text("This pin appears outside Myanmar. Choose the recipient’s Myanmar address, or use written-address verification if the map boundary is incorrect."));
  }

  function useDeviceLocation() {
    if (!window.isSecureContext || !navigator.geolocation) {
      setMessage(text("GPS needs HTTPS or localhost. You can still place the pin manually."));
      return;
    }
    const request = ++requestVersion.current;
    setLocating(true);
    navigator.geolocation.getCurrentPosition((position) => {
      if (request !== requestVersion.current) return;
      if (!isApproximatelyInMyanmar(position.coords.latitude, position.coords.longitude)) {
        setLocating(false);
        setMessage(text("Your device appears outside Myanmar. Its position has not been placed on the map. Select the recipient’s Myanmar delivery address manually."));
        return;
      }
      choosePoint({ latitude: position.coords.latitude, longitude: position.coords.longitude }, position.coords.accuracy);
    }, (error) => {
      if (request !== requestVersion.current) return;
      setLocating(false);
      setMessage(error.code === 1
        ? text("GPS permission was denied. Click the map or enter coordinates instead; you do not need to enable GPS.")
        : "GPS could not find your position. You can place the pin manually.");
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }

  function clearPin() {
    requestVersion.current += 1;
    setLocating(false);
    setCandidate(null);
    setLatitude("");
    setLongitude("");
    onChange(null);
    setMessage(text("Pin removed. No coordinates will be attached to this order."));
  }

  const inside = candidate && isApproximatelyInMyanmar(candidate.latitude, candidate.longitude);

  return (
    <fieldset className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-zinc-950">
      <legend className="px-1 text-sm font-bold">{text("Pin the delivery entrance")}</legend>
      <p className="text-sm leading-6 text-zinc-600">{text("Place the pin at the recipient\u2019s address, not necessarily your current location. GPS access is optional. A pin helps the courier but does not verify identity.")}</p>
      {preview && <p className="mt-2 text-sm font-semibold">{text("Practice map only: nothing is saved. Confirm your actual delivery pin again at checkout.")}</p>}
      {!open ? (
        <>
          <p className="mt-3 text-xs leading-5 text-zinc-600">{text("Opening the map loads OpenStreetMap images. That provider receives your IP address and the area you view; we do not send your name, phone or written address to it.")}</p>
          <button type="button" onClick={() => setOpen(true)} className="mt-3 rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white">{text("Open map to place a pin")}</button>
        </>
      ) : (
        <div className="mt-4 space-y-4">
          <button type="button" disabled={locating} onClick={useDeviceLocation} className="rounded-full border border-blue-700 bg-white px-4 py-2 text-sm font-bold text-blue-800 disabled:opacity-50">{locating ? text("Finding device location…") : text("Use my current location")}</button>
          <DeliveryMap point={candidate} onSelect={choosePoint} />
          <details className="rounded-xl border bg-white p-3 text-sm">
            <summary className="cursor-pointer font-semibold">{text("Enter coordinates instead")}</summary>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold">{text("Latitude")}<input type="number" step="any" min="-90" max="90" value={latitude} onChange={(event) => { requestVersion.current += 1; setLocating(false); setLatitude(event.target.value); setCandidate(null); onChange(null); }} className="mt-1 w-full rounded-lg border p-2" /></label>
              <label className="text-xs font-semibold">{text("Longitude")}<input type="number" step="any" min="-180" max="180" value={longitude} onChange={(event) => { requestVersion.current += 1; setLocating(false); setLongitude(event.target.value); setCandidate(null); onChange(null); }} className="mt-1 w-full rounded-lg border p-2" /></label>
            </div>
            <button type="button" className="mt-3 rounded-full border px-4 py-2 font-semibold" onClick={() => {
              const lat = Number(latitude);
              const lng = Number(longitude);
              if (!latitude.trim() || !longitude.trim() || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
                setMessage(text("Enter a valid latitude and longitude."));
                return;
              }
              choosePoint({ latitude: lat, longitude: lng });
            }}>{text("Apply coordinates")}</button>
          </details>
          {candidate && <p className="text-xs leading-5">{text("Selected:")} {candidate.latitude.toFixed(6)}, {candidate.longitude.toFixed(6)}. {candidate.accuracy_m == null ? text("Manually selected; accuracy is not verified.") : t("location.pinAccuracy", { meters: Math.round(candidate.accuracy_m) })}</p>}
          <p className="text-xs leading-5 text-zinc-600">{preview ? text("This practice pin stays in this page only.") : text("Confirming the pin gives permission to attach it to the order you place and share it with authorised store staff for delivery. It is not saved until you place the order.")}</p>
          <button type="button" disabled={!inside || locating} onClick={() => {
            if (candidate && inside) {
              onChange(candidate);
              setMessage(preview ? text("Practice pin confirmed. Nothing was saved to your account.") : text("Delivery pin confirmed. It will be attached when you place your order."));
            }
          }} className="w-full rounded-full bg-blue-700 px-4 py-3 text-sm font-bold text-white disabled:bg-zinc-400">{preview ? text("Confirm practice pin") : text("Confirm and share this delivery pin")}</button>
          {candidate && <button type="button" onClick={clearPin} className="rounded-full border bg-white px-4 py-2 text-sm font-semibold">{text("Remove pin")}</button>}
          {value && <p className="rounded-lg bg-green-100 p-3 text-sm font-semibold text-green-900">{text("\u2713 Pin confirmed")}</p>}
        </div>
      )}
      <p role="status" aria-live="polite" className="mt-3 text-sm leading-6">{message}</p>
    </fieldset>
  );
}
