"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import type { Product } from "../data/products";
import { authHeaders } from "../lib/client-auth";
import { formatCurrency } from "../lib/format";
import type { CurrentUser } from "../lib/useCurrentUser";

type SupportMessage = { id: string; sender_role: "customer" | "admin"; body: string; created_at: string };
type SupportConversation = { id: string; status: "open" | "resolved" };
type SupportResponse = { conversation: SupportConversation | null; messages: SupportMessage[]; error?: string };
type LocalMessage = { id: number; role: "assistant" | "user"; body: string; products?: Product[] };

const quickQuestions = ["Recommend a laptop", "Build a ฿50,000 PC", "How do returns work?", "Show Acer products"];
const messageTime = (value: string) => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function assistantReply(question: string, products: Product[]) {
  const text = question.toLowerCase();
  const available = products.filter((product) => product.stock === "In Stock");
  const brand = Array.from(new Set(products.map((product) => product.brand))).find((value) => text.includes(value.toLowerCase()));
  let matches: Product[] = [];

  if (brand) matches = available.filter((product) => product.brand === brand);
  else if (/gaming|game|graphics|gpu/.test(text)) matches = available.filter((product) => product.type === "laptop" && /gaming|rtx|radeon|geforce/i.test(`${product.name} ${product.category} ${product.fullSpecs.graphics ?? ""}`));
  else if (/student|school|office|work|laptop|recommend/.test(text)) matches = available.filter((product) => product.type === "laptop");
  else if (/accessor|mouse|keyboard|bag|head/.test(text)) matches = available.filter((product) => product.type === "accessory");

  const budget = Number(text.replaceAll(",", "").match(/\d{5,}/)?.[0] ?? 0);
  if (budget > 0) matches = (matches.length ? matches : available).filter((product) => product.price <= budget);
  matches = matches.sort((left, right) => left.price - right.price).slice(0, 3);

  if (/return|wrong|defect|error|broken|color|colour|storage/.test(text)) return { body: "You can request a return from My Orders within 7 days after delivery. Choose the exact problem, then select courier pickup or store drop-off. The refund is recorded only after the machine is received and inspected." };
  if (/build.*pc|pc.*build|computer.*budget/.test(text)) return { body: "Open the PC Build Planner from the header. Enter your minimum and maximum budget (for example ฿50,000–฿60,000) and choose gaming, office, development, streaming, creative, or 3D work. It will generate demo parts lists from current in-stock PC parts." };
  if (/receipt|invoice/.test(text)) return { body: "Your digital receipt appears in My Orders after an administrator confirms the order. Open it and choose Print / Save PDF. A confirmation email is also sent when email delivery is configured." };
  if (/deliver|shipping|arrive|track/.test(text)) return { body: "Open My Orders to see Pending, Confirmed, Shipped, or Delivered status. For a specific delivery time, use Live support so the admin team can check your order." };
  if (/cancel|out of stock/.test(text)) return { body: "Pending or confirmed orders can be cancelled. Customers can send a cancellation request, and administrators can cancel directly when stock is unavailable. Reserved stock is restored automatically." };
  if (matches.length) return { body: `These in-stock choices look relevant${budget ? ` for a budget up to ${formatCurrency(budget)}` : ""}. Open a product to compare its full specifications.`, products: matches };
  return { body: "I can help with product recommendations, Acer and other brands, receipts, order tracking, cancellation, and returns. Tell me what the laptop is for and your approximate budget, or switch to Live support for a person." };
}

export default function ChatbotButton({ language, currentUser, products }: { language: "en" | "my"; currentUser: CurrentUser | null; products: Product[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"assistant" | "live">("assistant");
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([{ id: 1, role: "assistant", body: "Hello! I am the free Aphrodite shopping assistant. Ask for a product recommendation, receipt help, delivery information, or the return process." }]);
  const [conversation, setConversation] = useState<SupportConversation | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messageListRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!isOpen || mode !== "live" || !currentUser || currentUser.role === "admin") return;
    const first = window.setTimeout(() => void loadConversation(), 0);
    const interval = window.setInterval(() => void loadConversation(true), 4000);
    return () => { window.clearTimeout(first); window.clearInterval(interval); };
  }, [currentUser, isOpen, loadConversation, mode]);
  useEffect(() => { if (messageListRef.current) messageListRef.current.scrollTop = messageListRef.current.scrollHeight; }, [localMessages, messages, mode]);

  function askAssistant(question: string) {
    const trimmed = question.trim();
    if (!trimmed) return;
    const id = localMessageId.current + 1;
    localMessageId.current = id + 1;
    const reply = assistantReply(trimmed, products);
    setLocalMessages((current) => [...current, { id, role: "user", body: trimmed }, { id: id + 1, role: "assistant", ...reply }]);
    setMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "assistant") { askAssistant(message); return; }
    const trimmed = message.trim();
    if (!trimmed || !currentUser || currentUser.role === "admin") return;
    setIsSending(true); setError("");
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ message: trimmed }) });
      const data = (await response.json().catch(() => null)) as SupportResponse | null;
      if (!response.ok) throw new Error(data?.error ?? "Unable to send your message.");
      setConversation(data?.conversation ?? null); setMessages(data?.messages ?? []); setMessage("");
    } catch (sendError) { setError(sendError instanceof Error ? sendError.message : "Unable to send your message."); }
    finally { setIsSending(false); }
  }

  return <div className="fixed bottom-5 left-5 z-50">
    {isOpen && <section aria-label="Shopping and customer support chat" className="mb-3 flex h-[min(38rem,calc(100vh-7rem))] w-[min(25rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-3xl border bg-white shadow-2xl">
      <div className="bg-zinc-950 p-4 text-white"><div className="flex items-center justify-between"><div><p className="font-black">Aphrodite Help</p><p className="mt-0.5 text-xs text-zinc-300">Instant answers or private admin support</p></div><button type="button" onClick={() => setIsOpen(false)} className="rounded-full border border-zinc-600 px-3 py-1 text-xs">Close</button></div>
        <div className="mt-4 grid grid-cols-2 rounded-xl bg-zinc-800 p-1 text-xs font-bold"><button type="button" onClick={() => { setMode("assistant"); setError(""); }} className={`rounded-lg px-3 py-2 ${mode === "assistant" ? "bg-white text-zinc-950" : "text-zinc-300"}`}>✨ Instant help</button><button type="button" onClick={() => { setMode("live"); setError(""); }} className={`rounded-lg px-3 py-2 ${mode === "live" ? "bg-white text-zinc-950" : "text-zinc-300"}`}>● Live support</button></div>
      </div>

      {mode === "assistant" ? <>
        <div ref={messageListRef} className="flex-1 space-y-3 overflow-y-auto bg-zinc-50 p-4" aria-live="polite">{localMessages.map((item) => <div key={item.id} className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm ${item.role === "user" ? "rounded-br-md bg-red-600 text-white" : "rounded-bl-md bg-white text-zinc-800 shadow-sm"}`}><p className="whitespace-pre-wrap">{item.body}</p>{item.products?.map((product) => <Link key={product.id} href={`/products/${product.id}`} className="mt-2 block rounded-xl border bg-zinc-50 p-2 text-zinc-900 hover:border-red-400"><span className="block font-bold">{product.name}</span><span className="text-xs text-zinc-500">{product.brand} · {formatCurrency(product.price)}</span></Link>)}</div></div>)}</div>
        <div className="border-t bg-white p-4"><div className="mb-3 flex gap-2 overflow-x-auto pb-1">{quickQuestions.map((question) => <button key={question} type="button" onClick={() => askAssistant(question)} className="shrink-0 rounded-full bg-zinc-100 px-3 py-2 text-xs font-semibold hover:bg-red-50 hover:text-red-700">{question}</button>)}</div><form onSubmit={handleSubmit} className="flex gap-2"><input value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} placeholder="Ask about products or orders..." className="min-w-0 flex-1 rounded-full border px-4 py-2 text-sm outline-none focus:border-red-500" /><button type="submit" disabled={!message.trim()} className="rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:bg-zinc-300">Ask</button></form><p className="mt-2 text-[10px] text-zinc-400">Free rule-based assistant. It does not send your message to an AI provider.</p></div>
      </> : !currentUser ? <div className="flex flex-1 flex-col items-center justify-center p-6 text-center"><p className="text-lg font-bold">Login for live support</p><p className="mt-2 text-sm text-zinc-500">Your private conversation goes directly to the Aphrodite administrator.</p><Link href="/login" className="mt-5 rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold text-white">Login</Link></div>
      : currentUser.role === "admin" ? <div className="flex flex-1 flex-col items-center justify-center p-6 text-center"><p className="text-lg font-bold">Admin support inbox</p><p className="mt-2 text-sm text-zinc-500">Reply from the single admin dashboard.</p><Link href="/admin?panel=support" className="mt-5 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-bold text-white">Open admin</Link></div>
      : <><div ref={messageListRef} className="flex-1 space-y-3 overflow-y-auto bg-zinc-50 p-4" aria-live="polite">{isLoading ? <p className="text-center text-sm text-zinc-500">Loading conversation...</p> : messages.length === 0 ? <div className="rounded-2xl bg-white p-4 text-sm text-zinc-600 shadow-sm">Hello {currentUser.full_name || currentUser.email}. How can our support team help?</div> : messages.map((item) => { const own = item.sender_role === "customer"; return <div key={item.id} className={`flex ${own ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${own ? "rounded-br-md bg-red-600 text-white" : "rounded-bl-md bg-white shadow-sm"}`}><p className="whitespace-pre-wrap break-words">{item.body}</p><p className={`mt-1 text-[10px] ${own ? "text-red-100" : "text-zinc-400"}`}>{own ? "You" : "Admin"} · {messageTime(item.created_at)}</p></div></div>; })}</div>
        <div className="border-t bg-white p-4">{conversation?.status === "resolved" && <p className="mb-2 rounded-lg bg-green-50 p-2 text-xs text-green-700">Resolved. Sending a message will reopen it.</p>}{error && <p className="mb-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</p>}<form onSubmit={handleSubmit} className="flex gap-2"><input value={message} onChange={(event) => setMessage(event.target.value)} maxLength={1000} placeholder={language === "en" ? "Type your message..." : "စာရေးပါ..."} className="min-w-0 flex-1 rounded-full border px-4 py-2 text-sm outline-none focus:border-red-500" /><button type="submit" disabled={isSending || !message.trim()} className="rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:bg-zinc-400">{isSending ? "..." : "Send"}</button></form></div></>}
    </section>}
    <button type="button" onClick={() => setIsOpen((open) => !open)} className="rounded-full bg-red-600 px-5 py-4 font-bold text-white shadow-xl" aria-expanded={isOpen}>{language === "en" ? "💬 Ask Aphrodite" : "💬 အကူအညီ"}</button>
  </div>;
}
