"use client";

import { useLanguage } from "../lib/language";
import type { Language } from "../lib/translations";

type Props = {
  /** Pages that still keep their own language state pass it here. */
  language?: Language;
  setLanguage?: (value: Language) => void;
};

export default function LanguageSwitcher({ language, setLanguage }: Props) {
  const shared = useLanguage();
  const current = language ?? shared.language;

  function change(value: Language) {
    // Update the page's own state (where it still has one) and the shared
    // choice, so both halves agree while pages move onto the dictionary.
    setLanguage?.(value);
    shared.setLanguage(value);
  }

  return (
    <div role="group" aria-label="Language" className="inline-flex shrink-0 items-center gap-1 rounded-full border border-zinc-200 bg-zinc-100 p-1 shadow-inner">
      {(["en", "my"] as const).map(value => (
        <button key={value} type="button" lang={value}
          aria-label={value === "en" ? "English" : "မြန်မာ"}
          aria-pressed={current === value} onClick={() => change(value)}
          className={`min-h-9 rounded-full px-3 text-xs font-bold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 motion-reduce:transition-none ${current === value ? "bg-red-600 text-white shadow-md shadow-red-600/20" : "text-zinc-600 hover:bg-white hover:text-zinc-950"}`}>
          {value === "en" ? "EN" : "မြန်မာ"}
        </button>
      ))}
    </div>
  );
}
