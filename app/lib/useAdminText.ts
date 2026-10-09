"use client";

import { useCallback } from "react";
import { useLanguage } from "./language";
import { translateAdminText } from "./admin-translations";

export function useAdminText() {
  const { language } = useLanguage();
  return useCallback((value: string) => translateAdminText(language, value), [language]);
}
