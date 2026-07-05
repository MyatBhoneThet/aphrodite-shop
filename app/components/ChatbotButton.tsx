"use client";

import { FormEvent, useState } from "react";

export default function ChatbotButton({
  language,
}: {
  language: "en" | "my";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!message.trim()) return;

    setIsSending(true);

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    });

    const data = (await response.json()) as { reply: string };

    setReply(data.reply);
    setMessage("");
    setIsSending(false);
  }

  return (
    <div className="fixed bottom-6 left-6 z-50">
      {isOpen && (
        <div className="mb-4 w-[min(22rem,calc(100vw-3rem))] rounded-2xl border bg-white p-4 shadow-xl">
          <div className="flex items-center justify-between gap-4">
            <p className="font-bold text-zinc-950">
              {language === "en" ? "Shop assistant" : "ဆိုင် အကူအညီ"}
            </p>

            <button
              onClick={() => setIsOpen(false)}
              className="rounded-full border px-3 py-1 text-sm"
            >
              Close
            </button>
          </div>

          <p className="mt-3 rounded-2xl bg-zinc-100 p-3 text-sm text-zinc-700">
            {reply ||
              (language === "en"
                ? "Ask for gaming, MacBook, or accessories."
                : "Gaming, MacBook သို့မဟုတ် accessory အကြောင်းမေးပါ။")}
          </p>

          <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={language === "en" ? "What do you need?" : "ဘာလိုချင်ပါသလဲ"}
              className="min-w-0 flex-1 rounded-full border px-4 py-2 text-sm outline-none focus:border-red-500"
            />

            <button
              type="submit"
              disabled={isSending}
              className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-zinc-400"
            >
              {isSending ? "..." : "Send"}
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setIsOpen((open) => !open)}
        className="rounded-full bg-red-600 px-5 py-4 font-semibold text-white shadow-xl"
      >
        {language === "en" ? "Chat" : "မေးရန်"}
      </button>
    </div>
  );
}
