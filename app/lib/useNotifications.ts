"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authHeaders } from "./client-auth";

export type NotificationItem = {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  created_at: string;
  read: boolean;
};

const POLL_MS = 30_000;

/** The signed-in customer's bell: refreshes every 30 seconds while the tab is visible. */
export function useNotifications(enabled: boolean) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const stopped = useRef(false);

  const refresh = useCallback(async () => {
    if (stopped.current) return;
    try {
      const response = await fetch("/api/notifications", { headers: authHeaders(), cache: "no-store" });
      if (response.status === 401) { stopped.current = true; return; } // signed out: stop asking
      if (!response.ok) return;
      const data = (await response.json()) as { items: NotificationItem[]; unread: number };
      setItems(data.items);
      setUnread(data.unread);
    } catch { /* offline: try again next time */ }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    stopped.current = false;
    const first = window.setTimeout(() => void refresh(), 0);
    const tick = () => { if (document.visibilityState === "visible") void refresh(); };
    const interval = window.setInterval(tick, POLL_MS);
    window.addEventListener("focus", tick);
    return () => { window.clearTimeout(first); window.clearInterval(interval); window.removeEventListener("focus", tick); };
  }, [enabled, refresh]);

  const markRead = useCallback(async (ids: string[] | "all") => {
    // Update the screen first so it feels instant; the server call follows.
    setItems((current) => current.map((item) => (ids === "all" || ids.includes(item.id) ? { ...item, read: true } : item)));
    setUnread((current) => (ids === "all" ? 0 : Math.max(0, current - ids.length)));
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
    } catch { /* the next refresh corrects the count */ }
  }, []);

  return { items, unread, refresh, markRead };
}

export function timeAgo(iso: string, language: string, now = Date.now()) {
  const seconds = Math.round((Date.parse(iso) - now) / 1000);
  const formatter = (() => { try { return new Intl.RelativeTimeFormat(language === "my" ? "my" : "en", { numeric: "auto" }); } catch { return new Intl.RelativeTimeFormat("en", { numeric: "auto" }); } })();
  const abs = Math.abs(seconds);
  if (abs < 60) return formatter.format(Math.trunc(seconds / 1) || 0, "second").replace(/^in 0 seconds?$/, "now");
  if (abs < 3600) return formatter.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return formatter.format(Math.round(seconds / 3600), "hour");
  return formatter.format(Math.round(seconds / 86400), "day");
}
