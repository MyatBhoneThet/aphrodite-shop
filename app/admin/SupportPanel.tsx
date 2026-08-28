"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { authHeaders } from "../lib/client-auth";

type SupportConversation = {
  id: string;
  customer_id: string;
  assigned_admin_id: string | null;
  status: "open" | "resolved";
  last_message_at: string;
  last_message_preview: string | null;
  last_sender_role: "customer" | "admin" | null;
  needs_reply: boolean;
  created_at: string;
  customer: {
    email: string;
    full_name: string | null;
  };
};

type SupportMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: "customer" | "admin";
  body: string;
  created_at: string;
};

type ConversationResponse = {
  conversation?: SupportConversation;
  messages?: SupportMessage[];
  error?: string;
};

function displayName(conversation: SupportConversation) {
  return conversation.customer.full_name?.trim() || conversation.customer.email;
}

function conversationTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function messageTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function responseError(response: Response) {
  const data = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  return data?.error ?? "Request failed.";
}

export default function SupportPanel() {
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] =
    useState<SupportConversation | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [isLoadingInbox, setIsLoadingInbox] = useState(true);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messageListRef = useRef<HTMLDivElement>(null);

  const loadInbox = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoadingInbox(true);

    try {
      const response = await fetch("/api/admin/support", {
        headers: authHeaders(),
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as
        | { conversations?: SupportConversation[]; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to load customer conversations.");
      }

      const nextConversations = data?.conversations ?? [];
      setConversations(nextConversations);
      setSelectedId((current) => {
        if (
          current &&
          nextConversations.some((conversation) => conversation.id === current)
        ) {
          return current;
        }

        return nextConversations[0]?.id ?? null;
      });

      if (!quiet) setError("");
    } catch (err) {
      if (!quiet) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load customer conversations."
        );
      }
    } finally {
      if (!quiet) setIsLoadingInbox(false);
    }
  }, []);

  const loadConversation = useCallback(
    async (conversationId: string, quiet = false) => {
      if (!quiet) setIsLoadingConversation(true);

      try {
        const response = await fetch(
          `/api/admin/support/${encodeURIComponent(conversationId)}`,
          {
            headers: authHeaders(),
            cache: "no-store",
          }
        );
        const data = (await response.json().catch(() => null)) as
          | ConversationResponse
          | null;

        if (!response.ok) {
          throw new Error(data?.error ?? "Unable to load this conversation.");
        }

        setSelectedConversation(data?.conversation ?? null);
        setMessages(data?.messages ?? []);
        if (!quiet) setError("");
      } catch (err) {
        if (!quiet) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load this conversation."
          );
        }
      } finally {
        if (!quiet) setIsLoadingConversation(false);
      }
    },
    []
  );

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadInbox();
    }, 0);
    const interval = window.setInterval(() => {
      void loadInbox(true);
    }, 3000);

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [loadInbox]);

  useEffect(() => {
    if (!selectedId) return;

    const initialLoad = window.setTimeout(() => {
      void loadConversation(selectedId);
    }, 0);
    const interval = window.setInterval(() => {
      void loadConversation(selectedId, true);
    }, 2500);

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [loadConversation, selectedId]);

  useEffect(() => {
    const element = messageListRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages]);

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = reply.trim();

    if (!selectedId || !message) return;

    setIsSending(true);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/support/${encodeURIComponent(selectedId)}`,
        {
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message }),
        }
      );
      const data = (await response.json().catch(() => null)) as
        | ConversationResponse
        | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to send the reply.");
      }

      setSelectedConversation(data?.conversation ?? null);
      setMessages(data?.messages ?? []);
      setReply("");
      await loadInbox(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to send the reply."
      );
    } finally {
      setIsSending(false);
    }
  }

  async function changeStatus(status: "open" | "resolved") {
    if (!selectedId) return;

    setError("");

    try {
      const response = await fetch(
        `/api/admin/support/${encodeURIComponent(selectedId)}`,
        {
          method: "PATCH",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        }
      );

      if (!response.ok) throw new Error(await responseError(response));

      setSelectedConversation((current) =>
        current ? { ...current, status } : current
      );
      await loadInbox(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update the conversation."
      );
    }
  }

  const waitingCount = conversations.filter(
    (conversation) => conversation.needs_reply
  ).length;

  return (
    <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-100">
      <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-bold">Live Customer Support</h2>
          <p className="text-sm text-zinc-500">
            Private conversations grouped by customer account.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
            {waitingCount} waiting
          </span>
          <button
            type="button"
            onClick={() => loadInbox()}
            disabled={isLoadingInbox}
            className="rounded-full border px-4 py-2 text-xs font-semibold disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <p className="border-b bg-red-50 px-5 py-3 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      <div className="grid min-h-[600px] lg:grid-cols-[340px_1fr]">
        <aside className="border-b bg-zinc-50 lg:border-b-0 lg:border-r">
          {isLoadingInbox ? (
            <p className="p-5 text-sm text-zinc-500">Loading conversations...</p>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center">
              <p className="font-semibold">No customer messages yet</p>
              <p className="mt-2 text-sm text-zinc-500">
                A conversation will appear here after a logged-in customer
                sends a support message.
              </p>
            </div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setSelectedId(conversation.id)}
                  className={`w-full border-b p-4 text-left transition ${
                    selectedId === conversation.id
                      ? "bg-white shadow-[inset_4px_0_0_#dc2626]"
                      : "hover:bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {displayName(conversation)}
                      </p>
                      <p className="truncate text-xs text-zinc-500">
                        {conversation.customer.email}
                      </p>
                    </div>

                    {conversation.needs_reply && (
                      <span className="shrink-0 rounded-full bg-red-600 px-2 py-1 text-[10px] font-bold text-white">
                        Needs reply
                      </span>
                    )}
                  </div>

                  <p className="mt-2 truncate text-sm text-zinc-600">
                    {conversation.last_sender_role === "admin" && "You: "}
                    {conversation.last_message_preview || "New conversation"}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-400">
                    <span>{conversationTime(conversation.last_message_at)}</span>
                    <span className="capitalize">{conversation.status}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        <div className="flex min-h-[600px] flex-col">
          {!selectedId ? (
            <div className="flex flex-1 items-center justify-center p-8 text-center text-zinc-500">
              Select a customer conversation to begin.
            </div>
          ) : isLoadingConversation ? (
            <div className="flex flex-1 items-center justify-center text-zinc-500">
              Loading messages...
            </div>
          ) : selectedConversation ? (
            <>
              <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold">
                    {displayName(selectedConversation)}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {selectedConversation.customer.email} · Account #
                    {selectedConversation.customer_id.slice(0, 8)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    changeStatus(
                      selectedConversation.status === "open"
                        ? "resolved"
                        : "open"
                    )
                  }
                  className={`rounded-full px-4 py-2 text-xs font-semibold ${
                    selectedConversation.status === "open"
                      ? "bg-green-100 text-green-700"
                      : "bg-zinc-900 text-white"
                  }`}
                >
                  {selectedConversation.status === "open"
                    ? "Mark resolved"
                    : "Reopen conversation"}
                </button>
              </div>

              <div
                ref={messageListRef}
                className="flex-1 space-y-3 overflow-y-auto bg-zinc-100 p-5"
                aria-live="polite"
              >
                {messages.map((message) => {
                  const isAdmin = message.sender_role === "admin";

                  return (
                    <div
                      key={message.id}
                      className={`flex ${
                        isAdmin ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                          isAdmin
                            ? "rounded-br-md bg-zinc-900 text-white"
                            : "rounded-bl-md bg-white text-zinc-900 shadow-sm"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">
                          {message.body}
                        </p>
                        <p
                          className={`mt-1 text-[10px] ${
                            isAdmin ? "text-zinc-400" : "text-zinc-400"
                          }`}
                        >
                          {isAdmin
                            ? "Admin"
                            : displayName(selectedConversation)}{" "}
                          · {messageTime(message.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form onSubmit={sendReply} className="border-t bg-white p-4">
                <label
                  htmlFor="admin-support-reply"
                  className="mb-2 block text-xs font-semibold text-zinc-600"
                >
                  Reply to {displayName(selectedConversation)}
                </label>
                <div className="flex gap-2">
                  <input
                    id="admin-support-reply"
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    maxLength={1000}
                    placeholder="Type an individual reply..."
                    className="min-w-0 flex-1 rounded-full border px-4 py-3 text-sm outline-none focus:border-red-500"
                  />
                  <button
                    type="submit"
                    disabled={isSending || !reply.trim()}
                    className="rounded-full bg-red-600 px-5 py-3 text-sm font-semibold text-white disabled:bg-zinc-400"
                  >
                    {isSending ? "Sending..." : "Send reply"}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-zinc-500">
              Conversation unavailable.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
