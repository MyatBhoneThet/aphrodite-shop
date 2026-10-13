"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useAdminText } from "../lib/useAdminText";
import { matchesConfirmText, registerConfirmOpener, type ConfirmOptions } from "./confirm";

/** Mounted once on the admin page. Opens when an action calls confirmAction(). */
export default function ConfirmDialogHost() {
  const a = useAdminText();
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [typed, setTyped] = useState("");
  const settle = useRef<((ok: boolean) => void) | null>(null);

  useEffect(() => {
    registerConfirmOpener((next) => {
      // A second request while one is open counts as "no" for the first.
      settle.current?.(false);
      setTyped("");
      setOptions(next);
      return new Promise<boolean>((resolve) => {
        settle.current = resolve;
      });
    });
    return () => registerConfirmOpener(null);
  }, []);

  function close(ok: boolean) {
    setOptions(null);
    setTyped("");
    settle.current?.(ok);
    settle.current = null;
  }

  useEffect(() => {
    if (!options) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [options]);

  if (!options) return null;

  const tone = options.tone ?? "danger";
  const required = options.requireText ?? "";
  const unlocked = !required || matchesConfirmText(typed, required);
  const accent =
    tone === "danger"
      ? { icon: "bg-red-50 text-red-600", button: "bg-red-600 hover:bg-red-700", bullet: "bg-red-500" }
      : { icon: "bg-amber-50 text-amber-600", button: "bg-amber-600 hover:bg-amber-700", bullet: "bg-amber-500" };

  function submit(event: FormEvent) {
    event.preventDefault();
    if (unlocked) close(true);
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 px-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close(false);
      }}
    >
      <form
        onSubmit={submit}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${accent.icon}`} aria-hidden="true">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              <path d="M12 9v4M12 17h.01" />
            </svg>
          </span>
          <div className="min-w-0">
            <h2 id="confirm-title" className="text-lg font-black leading-snug">{a(options.title)}</h2>
            {options.message && (
              <p id="confirm-message" className="mt-1 text-sm leading-6 text-zinc-600">{a(options.message)}</p>
            )}
          </div>
        </div>

        {options.subject && (
          <p className="mt-4 break-words rounded-xl bg-zinc-100 px-4 py-3 text-sm font-bold text-zinc-900">{options.subject}</p>
        )}

        {options.consequences && options.consequences.length > 0 && (
          <ul className="mt-4 space-y-2 text-sm leading-6 text-zinc-700">
            {options.consequences.map((line) => (
              <li key={line} className="flex gap-2">
                <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${accent.bullet}`} aria-hidden="true" />
                <span>{a(line)}</span>
              </li>
            ))}
          </ul>
        )}

        {required && (
          <div className="mt-5">
            <label htmlFor="confirm-typed" className="block text-sm font-semibold text-zinc-700">
              {a("Type the word below to confirm.")}
            </label>
            <p className="mt-2 inline-block rounded-lg bg-zinc-900 px-3 py-1 font-mono text-sm font-bold tracking-widest text-white">
              {required}
            </p>
            <input
              id="confirm-typed"
              autoFocus
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              className="mt-2 w-full rounded-xl border px-4 py-3 font-mono tracking-widest outline-none focus:border-red-500"
              aria-label={`${a("Type the word below to confirm.")} ${required}`}
            />
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            autoFocus={!required}
            onClick={() => close(false)}
            className="rounded-full border px-5 py-2.5 text-sm font-semibold hover:bg-zinc-50"
          >
            {a("Cancel")}
          </button>
          <button
            type="submit"
            disabled={!unlocked}
            className={`rounded-full px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40 ${accent.button}`}
          >
            {a(options.confirmLabel ?? "Confirm")}
          </button>
        </div>
      </form>
    </div>
  );
}
