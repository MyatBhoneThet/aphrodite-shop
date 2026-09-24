"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import type { Product } from "../data/products";
import { authHeaders } from "../lib/client-auth";
import { formatCurrency } from "../lib/format";
import { assistantReply, quickQuestions } from "../lib/assistant-rules";
import type { CurrentUser } from "../lib/useCurrentUser";
import { useLanguage } from "../lib/language";

type SupportMessage = {
  id: string;
  sender_role: "customer" | "admin";
  body: string;
  created_at: string;
  attachment_url?: string | null;
  product?: { id: number; name: string; brand: string; price: number; image: string } | null;
};
type SupportConversation = { id: string; status: "open" | "resolved" };
type SupportResponse = { conversation: SupportConversation | null; messages: SupportMessage[]; error?: string };
type AssistantSource = "gemini" | "rules";
type AdminPresence = {
  status: "online" | "away" | "busy" | "offline";
  message: string | null;
  back_at: string | null;
};
type LocalMessage = {
  id: number;
  role: "assistant" | "user";
  body: string;
  products?: Product[];
  pending?: boolean;
};
type AssistantResponse = { reply?: string; products?: Product[]; source?: AssistantSource; error?: string };

const messageTime = (value: string) => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const PRESENCE_DOT: Record<AdminPresence["status"], string> = {
  online: "bg-emerald-500",
  away: "bg-amber-500",
  busy: "bg-orange-500",
  offline: "bg-zinc-400",
};
const PRESENCE_TEXT: Record<AdminPresence["status"], string> = {
  online: "Admin is online",
  away: "Admin is away",
  busy: "Admin is busy",
  offline: "Admin is offline",
};

function backInWords(backAt: string | null) {
  if (!backAt) return null;
  const minutes = Math.round((new Date(backAt).getTime() - Date.now()) / 60000);
  if (minutes <= 0) return "back any moment";
  if (minutes === 1) return "back in about 1 minute";
  if (minutes < 60) return `back in about ${minutes} minutes`;
  return `back around ${new Date(backAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

// `language` is still accepted so existing callers keep working; the text now
// comes from the shared language provider instead.
export default function ChatbotButton({ currentUser, products }: { language?: "en" | "my"; currentUser: CurrentUser | null; products: Product[] }) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"assistant" | "live">("assistant");
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([{ id: 1, role: "assistant", body: "Hello! I am the Aphrodite shopping assistant. Ask me about products, prices, delivery, receipts or returns — and your own orders once you are logged in." }]);
  const [assistantSource, setAssistantSource] = useState<AssistantSource>("rules");
  const [isThinking, setIsThinking] = useState(false);
  const [conversation, setConversation] = useState<SupportConversation | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [presence, setPresence] = useState<AdminPresence | null>(null);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [productPick, setProductPick] = useState<Product | null>(null);
  const [productQuery, setProductQuery] = useState("");
  const messageListRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const localMessageId = useRef(1);

  const loadConversation = useCallback(async (quiet = false) => {
    if (!currentUser || currentUser.role === "admin") return;
    if (!quiet) setIsLoading(true);
    try {
      const response = await fetch("/api/chat", { headers: authHeaders(), cache: "no-store" });
      const data = (await response.json().catch(() => null)) as SupportResponse | null;
      if (!response.ok) throw new Error(data?.error ?? "Unable to load support messages.");
      setConversation(data?.conversation ?? null); setMessages(data?.messages ?? []); setError("");
    } catch (loadError) {
      if (!quiet) setError(loadError instanceof Error ? loadError.message : "Unable to load support messages.");
    } finally { if (!quiet) setIsLoading(false); }
  }, [currentUser]);

  // Presence is public, so a visitor sees whether anyone is there before
  // deciding to log in and start a conversation.
  const loadPresence = useCallback(async () => {
    try {
      const response = await fetch("/api/support/presence", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { presence: AdminPresence };
      setPresence(data.presence);
    } catch { /* presence is optional decoration */ }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    // Deferred like the other loaders in this file: setting state directly in
    // an effect body causes cascading renders.
    const timer = window.setTimeout(() => void loadPresence(), 0);
    return () => window.clearTimeout(timer);
  }, [isOpen, loadPresence]);

  useEffect(() => {
    if (!isOpen || mode !== "live" || !currentUser || currentUser.role === "admin") return;
    const first = window.setTimeout(() => void loadConversation(), 0);
    const interval = window.setInterval(() => { void loadConversation(true); void loadPresence(); }, 4000);
    return () => { window.clearTimeout(first); window.clearInterval(interval); };
  }, [currentUser, isOpen, loadConversation, loadPresence, mode]);
  useEffect(() => { if (messageListRef.current) messageListRef.current.scrollTop = messageListRef.current.scrollHeight; }, [localMessages, messages, mode, isThinking]);

  // Asks the server assistant, which uses Gemini when a key is configured and
  // the built-in rules otherwise. If the request itself fails (offline, 429),
  // answer locally with the same rules rather than showing a dead end.
  async function askAssistant(question: string) {
    const trimmed = question.trim();
    if (!trimmed || isThinking) return;

    const userId = localMessageId.current + 1;
    const pendingId = userId + 1;
    localMessageId.current = pendingId;

    // Recent turns give the model context for follow-ups ("the cheaper one?").
    const history = localMessages
      .filter((item) => !item.pending && item.body)
      .slice(-8)
      .map((item) => ({ role: item.role === "user" ? ("user" as const) : ("model" as const), text: item.body.slice(0, 1000) }));

    setLocalMessages((current) => [
      ...current,
      { id: userId, role: "user", body: trimmed },
      { id: pendingId, role: "assistant", body: "", pending: true },
    ]);
    setMessage("");
    setIsThinking(true);

    let reply: LocalMessage;

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, history }),
      });
      const data = (await response.json().catch(() => null)) as AssistantResponse | null;
      if (!response.ok || !data?.reply) throw new Error(data?.error ?? "Assistant unavailable.");
      setAssistantSource(data.source ?? "rules");
      reply = { id: pendingId, role: "assistant", body: data.reply, products: data.products ?? [] };
    } catch {
      const local = assistantReply(trimmed, products);
      setAssistantSource("rules");
      reply = { id: pendingId, role: "assistant", body: local.body, products: local.products };
    } finally {
      setIsThinking(false);
    }

    setLocalMessages((current) => current.map((item) => (item.id === pendingId ? reply : item)));
  }

  function chooseFile(file: File | null) {
    setError("");
    if (!file) { setAttachment(null); return; }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Choose a JPG, PNG or WebP photo."); return;
    }
    if (file.size > 5 * 1024 * 1024) { setError("The photo must be 5 MB or smaller."); return; }
    setAttachment(file);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "assistant") { void askAssistant(message); return; }
    const trimmed = message.trim();
    if (!currentUser || currentUser.role === "admin") return;
    if (!trimmed && !attachment && !productPick) return;
    setIsSending(true); setError("");
    try {
      let response: Response;

      if (attachment || productPick) {
        // Multipart carries the photo and/or the product the customer is
        // asking about; the server stores it privately and links the product.
        const form = new FormData();
        form.set("message", trimmed);
        if (attachment) form.set("file", attachment);
        if (productPick) form.set("product_id", String(productPick.id));
        response = await fetch("/api/chat", { method: "POST", headers: authHeaders(), body: form });
      } else {
        response = await fetch("/api/chat", { method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ message: trimmed }) });
      }

      const data = (await response.json().catch(() => null)) as SupportResponse | null;
      if (!response.ok) throw new Error(data?.error ?? "Unable to send your message.");
      setConversation(data?.conversation ?? null); setMessages(data?.messages ?? []);
      setMessage(""); setAttachment(null); setProductPick(null); setProductQuery("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (sendError) { setError(sendError instanceof Error ? sendError.message : "Unable to send your message."); }
    finally { setIsSending(false); }
  }

  const productMatches = productQuery.trim().length > 1
    ? products.filter((item) => `${item.name} ${item.brand}`.toLowerCase().includes(productQuery.trim().toLowerCase())).slice(0, 6)
    : [];

  return <div className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-5 z-[60]">
    {isOpen && <section aria-label="Shopping and customer support chat" className="mb-3 flex h-[min(38rem,calc(100dvh-7rem-env(safe-area-inset-bottom)))] w-[min(25rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-3xl border bg-white shadow-2xl">
      <div className="bg-zinc-950 p-4 text-white"><div className="flex items-center justify-between"><div><p className="font-black">{t("chat.title")}</p><p className="mt-0.5 text-xs text-zinc-300">{t("chat.subtitle")}</p></div><button type="button" onClick={() => setIsOpen(false)} className="rounded-full border border-zinc-600 px-3 py-1 text-xs">Close</button></div>
        <div className="mt-4 grid grid-cols-2 rounded-xl bg-zinc-800 p-1 text-xs font-bold"><button type="button" onClick={() => { setMode("assistant"); setError(""); }} className={`rounded-lg px-3 py-2 ${mode === "assistant" ? "bg-white text-zinc-950" : "text-zinc-300"}`}>✨ Instant help</button><button type="button" onClick={() => { setMode("live"); setError(""); }} className={`rounded-lg px-3 py-2 ${mode === "live" ? "bg-white text-zinc-950" : "text-zinc-300"}`}>● Live support</button></div>
      </div>

      {mode === "assistant" ? <>
        <div ref={messageListRef} className="flex-1 space-y-3 overflow-y-auto bg-zinc-50 p-4" aria-live="polite" aria-busy={isThinking}>{localMessages.map((item) => <div key={item.id} className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm ${item.role === "user" ? "rounded-br-md bg-red-600 text-white" : "rounded-bl-md bg-white text-zinc-800 shadow-sm"}`}>
          {item.pending
            ? <span className="flex items-center gap-1.5 py-1" aria-label="Assistant is typing"><span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.3s]" /><span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.15s]" /><span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" /></span>
            : <p className="whitespace-pre-wrap">{item.body}</p>}
          {item.products?.map((product) => <Link key={product.id} href={`/products/${product.id}`} className="mt-2 block rounded-xl border bg-zinc-50 p-2 text-zinc-900 hover:border-red-400"><span className="block font-bold">{product.name}</span><span className="text-xs text-zinc-500">{product.brand} · {formatCurrency(product.price)}</span></Link>)}
        </div></div>)}</div>
        <div className="border-t bg-white p-4"><div className="mb-3 flex gap-2 overflow-x-auto pb-1">{quickQuestions.map((question) => <button key={question} type="button" onClick={() => void askAssistant(question)} disabled={isThinking} className="shrink-0 rounded-full bg-zinc-100 px-3 py-2 text-xs font-semibold hover:bg-red-50 hover:text-red-700 disabled:opacity-50">{question}</button>)}</div><form onSubmit={handleSubmit} className="flex gap-2"><input value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} placeholder={t("chat.askPlaceholder")} className="min-w-0 flex-1 rounded-full border px-4 py-2 text-sm outline-none focus:border-red-500" /><button type="submit" disabled={!message.trim() || isThinking} className="rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:bg-zinc-300">{isThinking ? "..." : t("chat.ask")}</button></form>
        <p className="mt-2 text-[10px] text-zinc-400">{assistantSource === "gemini"
          ? "Answers are generated by Google Gemini and can be wrong — check important details. Never share passwords or card numbers."
          : "Free built-in assistant. Your message is not sent to an AI provider."}</p></div>
      </> : !currentUser ? <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        {presence && <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-zinc-500"><span className={`h-2 w-2 rounded-full ${PRESENCE_DOT[presence.status]}`} />{PRESENCE_TEXT[presence.status]}</p>}
        <p className="text-lg font-bold">{t("chat.loginTitle")}</p><p className="mt-2 text-sm text-zinc-500">{t("chat.loginBody")}</p><Link href="/login" className="mt-5 rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold text-white">{t("nav.login")}</Link></div>
      : currentUser.role === "admin" ? <div className="flex flex-1 flex-col items-center justify-center p-6 text-center"><p className="text-lg font-bold">Admin support inbox</p><p className="mt-2 text-sm text-zinc-500">Reply from the single admin dashboard.</p><Link href="/admin?panel=support" className="mt-5 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-bold text-white">Open admin</Link></div>
      : <>
        {presence && <div className="flex flex-wrap items-center gap-2 border-b bg-zinc-50 px-4 py-2 text-xs">
          <span className={`h-2 w-2 rounded-full ${PRESENCE_DOT[presence.status]}`} />
          <span className="font-semibold text-zinc-700">{PRESENCE_TEXT[presence.status]}</span>
          {presence.message && <span className="text-zinc-500">· {presence.message}</span>}
          {presence.status !== "online" && backInWords(presence.back_at) && <span className="text-zinc-500">· {backInWords(presence.back_at)}</span>}
        </div>}

        <div ref={messageListRef} className="flex-1 space-y-3 overflow-y-auto bg-zinc-50 p-4" aria-live="polite">{isLoading ? <p className="text-center text-sm text-zinc-500">Loading conversation...</p> : messages.length === 0 ? <div className="rounded-2xl bg-white p-4 text-sm text-zinc-600 shadow-sm">Hello {currentUser.full_name || currentUser.email}. How can our support team help? You can also send a photo or ask about one product.</div> : messages.map((item) => { const own = item.sender_role === "customer"; return <div key={item.id} className={`flex ${own ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${own ? "rounded-br-md bg-red-600 text-white" : "rounded-bl-md bg-white shadow-sm"}`}>
          {item.product && <Link href={`/products/${item.product.id}`} className={`mb-2 flex items-center gap-2 rounded-xl border p-2 ${own ? "border-red-400 bg-red-500" : "border-zinc-200 bg-zinc-50"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.product.image} alt="" className="h-9 w-9 rounded object-contain" />
            <span className="min-w-0"><span className="block truncate text-xs font-bold">{item.product.name}</span><span className="block text-[10px] opacity-80">{formatCurrency(item.product.price)}</span></span>
          </Link>}
          {item.attachment_url && <a href={item.attachment_url} target="_blank" rel="noreferrer" className="mb-2 block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.attachment_url} alt="Photo you sent" className="max-h-48 w-auto rounded-xl border" />
          </a>}
          {item.body && <p className="whitespace-pre-wrap break-words">{item.body}</p>}
          <p className={`mt-1 text-[10px] ${own ? "text-red-100" : "text-zinc-400"}`}>{own ? "You" : "Admin"} · {messageTime(item.created_at)}</p>
        </div></div>; })}</div>

        <div className="border-t bg-white p-4">
          {conversation?.status === "resolved" && <p className="mb-2 rounded-lg bg-green-50 p-2 text-xs text-green-700">Resolved. Sending a message will reopen it.</p>}
          {error && <p className="mb-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</p>}

          {(attachment || productPick) && <div className="mb-2 flex flex-wrap gap-2">
            {attachment && <span className="flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-xs">📎 {attachment.name.slice(0, 28)}<button type="button" onClick={() => chooseFile(null)} aria-label="Remove photo" className="shrink-0 font-bold text-zinc-500">×</button></span>}
            {productPick && <span className="flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-xs">🛒 {productPick.name.slice(0, 28)}<button type="button" onClick={() => setProductPick(null)} aria-label="Remove product" className="shrink-0 font-bold text-zinc-500">×</button></span>}
          </div>}

          {!productPick && <div className="mb-2">
            <input value={productQuery} onChange={(event) => setProductQuery(event.target.value)} placeholder="Ask about a product? Type its name..." className="w-full rounded-full border px-3 py-1.5 text-xs outline-none focus:border-red-500" />
            {productMatches.length > 0 && <ul className="mt-1 max-h-32 overflow-y-auto rounded-xl border">
              {productMatches.map((item) => <li key={item.id}><button type="button" onClick={() => { setProductPick(item); setProductQuery(""); }} className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-zinc-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.image} alt="" className="h-7 w-7 rounded object-contain" />
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
              </button></li>)}
            </ul>}
          </div>}

          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} />

          <form onSubmit={handleSubmit} className="flex gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} aria-label="Attach a photo" className="rounded-full border px-3 py-2 text-sm hover:bg-zinc-100">📎</button>
            <input value={message} onChange={(event) => setMessage(event.target.value)} maxLength={1000} placeholder={t("chat.messagePlaceholder")} className="min-w-0 flex-1 rounded-full border px-4 py-2 text-sm outline-none focus:border-red-500" />
            <button type="submit" disabled={isSending || (!message.trim() && !attachment && !productPick)} className="rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:bg-zinc-400">{isSending ? "..." : "Send"}</button>
          </form>
        </div></>}
    </section>}
    <button type="button" onClick={() => setIsOpen((open) => !open)} className="rounded-full bg-red-600 px-5 py-4 font-bold text-white shadow-xl" aria-expanded={isOpen}>{t("chat.button")}</button>
  </div>;
}
