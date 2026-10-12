"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../lib/language";
import { timeAgo, type NotificationItem } from "../lib/useNotifications";
import PhoneNotificationsToggle from "./PhoneNotificationsToggle";

type Props = {
  items: NotificationItem[];
  unread: number;
  markRead: (ids: string[] | "all") => Promise<void>;
};

/** Opens the chat (support replies) or the page the update is about, and marks it read. */
export function openNotification(item: NotificationItem, markRead: Props["markRead"], push: (href: string) => void) {
  if (!item.read) void markRead([item.id]);
  if (item.kind === "support_reply") {
    window.dispatchEvent(new Event("aphrodite:open-chat"));
    return;
  }
  if (item.link) push(item.link);
}

export default function NotificationBell({ items, unread, markRead }: Props) {
  const { text, language } = useLanguage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (box.current && !box.current.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);

  const label = unread > 0 ? `${text("Notifications")}: ${unread}` : text("Notifications");

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={label}
        aria-expanded={open}
        title={text("Notifications")}
        className="group relative flex h-11 w-9 items-center justify-center rounded-lg text-zinc-600 transition hover:bg-white hover:text-red-600 hover:shadow-sm motion-reduce:transition-none min-[460px]:w-12 min-[460px]:rounded-xl"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span aria-hidden="true" className="absolute right-0.5 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white ring-2 ring-zinc-50">{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+0.75rem)] z-[80] w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-zinc-200 bg-white text-left shadow-[0_16px_48px_rgba(0,0,0,0.18)]">
          <div className="flex items-center justify-between gap-3 border-b border-zinc-100 bg-zinc-50 px-4 py-3">
            <p className="text-sm font-bold">{text("Notifications")}</p>
            {unread > 0 && <button type="button" onClick={() => void markRead("all")} className="text-xs font-semibold text-red-600 hover:underline">{text("Mark all as read")}</button>}
          </div>

          <ul className="max-h-80 overflow-y-auto" aria-label={text("Notifications")}>
            {items.length === 0 && <li className="p-6 text-center text-sm text-zinc-500">{text("No notifications yet. Updates about your orders will appear here.")}</li>}
            {items.slice(0, 8).map((item) => (
              <li key={item.id} className="border-b border-zinc-100 last:border-b-0">
                <button
                  type="button"
                  onClick={() => { setOpen(false); openNotification(item, markRead, router.push); }}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-zinc-50 ${item.read ? "" : "bg-red-50/50"}`}
                >
                  <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.read ? "bg-transparent" : "bg-red-600"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{item.title}</span>
                    <span className="block break-words text-xs text-zinc-700">{item.body}</span>
                    <span className="mt-0.5 block text-[11px] text-zinc-400">{timeAgo(item.created_at, language)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="space-y-3 border-t border-zinc-100 p-4">
            <PhoneNotificationsToggle compact />
            <Link href="/notifications" onClick={() => setOpen(false)} className="block text-xs font-semibold text-red-600 hover:underline">{text("See all notifications")}</Link>
          </div>
        </div>
      )}
    </div>
  );
}
