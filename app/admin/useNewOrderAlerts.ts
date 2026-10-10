"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authHeaders } from "@/app/lib/client-auth";

const SEEN_KEY = "aphrodite_admin_orders_seen";
const SOUND_KEY = "aphrodite_admin_order_sound";
const POLL_MS = 30_000;

export type NewOrderPreview = { id: string; total_amount: number; shipping_name: string };

// Browser storage can be blocked (private windows); the alert still works for the session.
const read = (key: string) => { try { return window.localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string) => { try { window.localStorage.setItem(key, value); } catch { /* ignore */ } };

/** One short two-note chime. Needs a click earlier on the page, which turning the sound on provides. */
function chime() {
  try {
    const Audio = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Audio) return;
    const context = new Audio();
    [660, 880].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + index * 0.18;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.18);
    });
    window.setTimeout(() => void context.close(), 800);
  } catch { /* sound is a nicety */ }
}

/**
 * Polls for orders placed since the admin last looked at the Orders panel.
 * `count` drives the sidebar badge and the banner; the tab title shows it too.
 */
export function useNewOrderAlerts(enabled: boolean) {
  const [count, setCount] = useState(0);
  const [capped, setCapped] = useState(false);
  const [preview, setPreview] = useState<NewOrderPreview[]>([]);
  const [soundOn, setSoundOn] = useState(false);
  const latestAt = useRef<string | null>(null);
  const lastCount = useRef(0);
  const sound = useRef(false);
  const baseTitle = useRef<string>("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const on = read(SOUND_KEY) === "on";
      sound.current = on;
      setSoundOn(on);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const poll = useCallback(async () => {
    let since = read(SEEN_KEY);
    if (!since) {
      since = new Date().toISOString(); // first visit: only orders from now on count as new
      write(SEEN_KEY, since);
    }
    try {
      const response = await fetch(`/api/admin/new-orders?since=${encodeURIComponent(since)}`, { headers: authHeaders(), cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { count: number; capped: boolean; latestAt: string | null; orders: NewOrderPreview[] };
      latestAt.current = data.latestAt;
      if (data.count > lastCount.current && sound.current) chime();
      lastCount.current = data.count;
      setCount(data.count);
      setCapped(data.capped);
      setPreview(data.orders);
    } catch { /* offline: try again next time */ }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const first = window.setTimeout(() => void poll(), 0);
    const tick = () => { if (document.visibilityState === "visible") void poll(); };
    const interval = window.setInterval(tick, POLL_MS);
    window.addEventListener("focus", tick);
    return () => { window.clearTimeout(first); window.clearInterval(interval); window.removeEventListener("focus", tick); };
  }, [enabled, poll]);

  useEffect(() => {
    if (!baseTitle.current) baseTitle.current = document.title;
    document.title = count > 0 ? `(${count}${capped ? "+" : ""}) New orders · ${baseTitle.current}` : baseTitle.current;
    return () => { document.title = baseTitle.current; };
  }, [count, capped]);

  /** Call when the admin opens the Orders panel or dismisses the banner. */
  const markSeen = useCallback(() => {
    write(SEEN_KEY, new Date(Math.max(Date.now(), latestAt.current ? Date.parse(latestAt.current) : 0)).toISOString());
    lastCount.current = 0;
    setCount(0);
    setCapped(false);
    setPreview([]);
  }, []);

  const toggleSound = useCallback(() => {
    const next = !sound.current;
    sound.current = next;
    setSoundOn(next);
    write(SOUND_KEY, next ? "on" : "off");
    if (next) chime(); // also unlocks audio, which browsers only allow after a click
  }, []);

  return { count, capped, preview, soundOn, toggleSound, markSeen };
}
