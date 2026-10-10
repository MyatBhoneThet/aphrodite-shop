"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import PhoneNotificationsToggle from "../components/PhoneNotificationsToggle";
import { openNotification } from "../components/NotificationBell";
import { useLanguage } from "../lib/language";
import { timeAgo, useNotifications } from "../lib/useNotifications";
import { useCurrentUser } from "../lib/useCurrentUser";

export default function NotificationsPage() {
  const { text, language } = useLanguage();
  const router = useRouter();
  const { user, status } = useCurrentUser();
  const { items, unread, markRead } = useNotifications(status === "ready" && Boolean(user));

  if (status === "checking") return <main className="flex min-h-screen items-center justify-center">{text("Loading…")}</main>;
  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5 text-center">
        <div><h1 className="text-2xl font-bold">{text("Login to see your notifications")}</h1><Link href="/login" className="mt-4 inline-block rounded-full bg-red-600 px-6 py-3 font-semibold text-white">{text("Login")}</Link></div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto max-w-2xl px-5 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-black">{text("Notifications")}</h1>
          <Link href="/" className="rounded-full border bg-white px-4 py-2 text-sm font-semibold">{text("Back to Store")}</Link>
        </div>

        <div className="mt-6"><PhoneNotificationsToggle /></div>

        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-zinc-600">{unread > 0 ? `${unread} ${text("unread")}` : text("You are all caught up.")}</p>
          {unread > 0 && <button type="button" onClick={() => void markRead("all")} className="text-sm font-semibold text-red-600 hover:underline">{text("Mark all as read")}</button>}
        </div>

        <ul className="mt-3 divide-y overflow-hidden rounded-2xl border bg-white">
          {items.length === 0 && <li className="p-8 text-center text-sm text-zinc-500">{text("No notifications yet. Updates about your orders will appear here.")}</li>}
          {items.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => openNotification(item, markRead, router.push)} className={`flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-zinc-50 ${item.read ? "" : "bg-red-50/50"}`}>
                <span aria-hidden="true" className={`mt-2 h-2 w-2 shrink-0 rounded-full ${item.read ? "bg-transparent" : "bg-red-600"}`} />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{item.title}</span>
                  <span className="block break-words text-sm text-zinc-700">{item.body}</span>
                  <span className="mt-1 block text-xs text-zinc-400">{timeAgo(item.created_at, language)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
