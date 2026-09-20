"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { translateStorefrontText } from "./storefront-translations";
import { translate, type Language, type TranslationKey } from "./translations";

/**
 * The shop's language choice in one place: the navbar switcher, the settings
 * page and every translated component read and write it here, and the choice
 * is remembered between visits and across open tabs.
 *
 * Pages that still keep their own `language` state work unchanged; the
 * switcher updates both while they are moved onto this provider.
 */

const STORAGE_KEY = "aphrodite.language";

const listeners = new Set<() => void>();
let cached: Language | null = null;

function storedLanguage(): Language {
  if (cached) return cached;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    cached = stored === "my" || stored === "en" ? stored : "en";
  } catch {
    // Private windows can refuse storage; English is a fine default.
    cached = "en";
  }

  return cached;
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  // Changing the language in another tab keeps this one in step.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    cached = null;
    listener();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function writeLanguage(value: Language) {
  cached = value;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Not stored, so the choice lasts for this visit only.
  }
  for (const listener of listeners) listener();
}

type LanguageValue = {
  text: (value: string) => string;
  language: Language;
  setLanguage: (value: Language) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // The server always renders English; the client picks up the stored choice
  // through the store below, so no state is set from inside an effect.
  const language = useSyncExternalStore(subscribe, storedLanguage, () => "en" as Language);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((value: Language) => writeLanguage(value), []);

  const value = useMemo<LanguageValue>(
    () => ({
      language,
      setLanguage,
      text: (value) => translateStorefrontText(language, value),
      t: (key, vars) => translate(language, key, vars),
    }),
    [language, setLanguage]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/** English is used when a component renders outside the provider. */
export function useLanguage(): LanguageValue {
  return (
    useContext(LanguageContext) ?? {
      language: "en",
      text: (value) => value,
      setLanguage: () => {},
      t: (key, vars) => translate("en", key, vars),
    }
  );
}
