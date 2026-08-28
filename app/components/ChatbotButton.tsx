"use client";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { authHeaders } from "../lib/client-auth";
import type { CurrentUser } from "../lib/useCurrentUser";

type SupportMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: "customer" | "admin";
  body: string;
  created_at: string;
};

type SupportConversation = {
  id: string;
  status: "open" | "resolved";
};

type SupportResponse = {
  conversation: SupportConversation | null;
  messages: SupportMessage[];
  error?: string;
};

function messageTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ChatbotButton({
  language,
  currentUser,
}: {
  language: "en" | "my";
  currentUser: CurrentUser | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [conversation, setConversation] =
    useState<SupportConversation | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messageListRef = useRef<HTMLDivElement>(null);

  const loadConversation = useCallback(async (quiet = false) => {
    if (!currentUser || currentUser.role === "admin") return;

    if (!quiet) setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        headers: authHeaders(),
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as
        | SupportResponse
        | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to load support messages.");
      }

      setConversation(data?.conversation ?? null);
      setMessages(data?.messages ?? []);
      setError("");
    } catch (err) {
      if (!quiet) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load support messages."
        );
      }
    } finally {
      if (!quiet) setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!isOpen || !currentUser || currentUser.role === "admin") return;

    const initialLoad = window.setTimeout(() => {
      void loadConversation();
    }, 0);
    const interval = window.setInterval(() => {
      void loadConversation(true);
    }, 2500);

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [currentUser, isOpen, loadConversation]);

  useEffect(() => {
    const element = messageListRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedMessage = message.trim();

    if (!trimmedMessage || !currentUser || currentUser.role === "admin") return;

    setIsSending(true);
    setError("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: trimmedMessage }),
      });
      const data = (await response.json().catch(() => null)) as
        | SupportResponse
        | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to send your message.");
      }

      setConversation(data?.conversation ?? null);
      setMessages(data?.messages ?? []);
      setMessage("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to send your message."
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="fixed bottom-6 left-6 z-50">
      {isOpen && (
        <section
          aria-label="Customer support chat"
          className="mb-4 flex h-[min(34rem,calc(100vh-8rem))] w-[min(24rem,calc(100vw-3rem))] flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl"
        >
          <div className="flex items-center justify-between gap-4 border-b p-4">
            <div>
              <p className="font-bold text-zinc-950">
                {language === "en" ? "Customer support" : "ဖောက်သည်အကူအညီ"}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                <span className="mr-1 inline-block h-2 w-2 rounded-full bg-green-500" />
                Messages go directly to the admin team
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full border px-3 py-1 text-sm"
            >
              Close
            </button>
          </div>

          {!currentUser ? (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
              <p className="text-lg font-bold">Login to contact support</p>
              <p className="mt-2 text-sm text-zinc-500">
                Your account keeps this conversation private and lets the
                administrator identify who needs help.
              </p>
              <Link
                href="/login"
                className="mt-5 rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white"
              >
                Login
              </Link>
            </div>
          ) : currentUser.role === "admin" ? (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
              <p className="text-lg font-bold">Admin support inbox</p>
              <p className="mt-2 text-sm text-zinc-500">
                Reply to customers individually from the Live Chat panel.
              </p>
              <Link
                href="/admin"
                className="mt-5 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white"
              >
                Open admin
              </Link>
            </div>
          ) : (
            <>
              <div
                ref={messageListRef}
                className="flex-1 space-y-3 overflow-y-auto bg-zinc-50 p-4"
                aria-live="polite"
              >
                {isLoading ? (
                  <p className="text-center text-sm text-zinc-500">
                    Loading conversation...
                  </p>
                ) : messages.length === 0 ? (
                  <div className="rounded-2xl bg-white p-4 text-sm text-zinc-600 shadow-sm">
                    Hello {currentUser.full_name || currentUser.email}. How can
                    our support team help you today?
                  </div>
                ) : (
                  messages.map((item) => {
                    const isCustomer = item.sender_role === "customer";

                    return (
                      <div
                        key={item.id}
                        className={`flex ${
                          isCustomer ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                            isCustomer
                              ? "rounded-br-md bg-red-600 text-white"
                              : "rounded-bl-md bg-white text-zinc-800 shadow-sm"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">
                            {item.body}
                          </p>
                          <p
                            className={`mt-1 text-[10px] ${
                              isCustomer ? "text-red-100" : "text-zinc-400"
                            }`}
                          >
                            {isCustomer ? "You" : "Admin"} ·{" "}
                            {messageTime(item.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="border-t bg-white p-4">
                {conversation?.status === "resolved" && (
                  <p className="mb-2 rounded-lg bg-green-50 p-2 text-xs text-green-700">
                    This conversation was resolved. Sending a new message will
                    reopen it.
                  </p>
                )}

                {error && (
                  <p className="mb-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">
                    {error}
                  </p>
                )}

                <form onSubmit={handleSubmit} className="flex gap-2">
                  <input
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    maxLength={1000}
                    placeholder={
                      language === "en"
                        ? "Type your message..."
                        : "စာရေးပါ..."
                    }
                    className="min-w-0 flex-1 rounded-full border px-4 py-2 text-sm outline-none focus:border-red-500"
                  />

                  <button
                    type="submit"
                    disabled={isSending || !message.trim()}
                    className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-zinc-400"
                  >
                    {isSending ? "..." : "Send"}
                  </button>
                </form>
              </div>
            </>
          )}
        </section>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="rounded-full bg-red-600 px-5 py-4 font-semibold text-white shadow-xl"
        aria-expanded={isOpen}
      >
        {language === "en" ? "💬 Live chat" : "💬 အကူအညီ"}
      </button>
    </div>
  );
}
