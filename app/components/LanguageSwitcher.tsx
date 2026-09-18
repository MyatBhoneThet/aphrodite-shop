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
    <select
      value={current}
      onChange={(e) => change(e.target.value as Language)}
      aria-label="Language"
      className="rounded-full border px-3 py-2"
    >
      <option value="en">EN</option>
      <option value="my">မြန်မာ</option>
    </select>
  );
}
