"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Locale = "id" | "en";

const STORAGE_KEY = "padis-locale";

// Lazy-load translation files
const translations: Record<Locale, Record<string, unknown>> = {
  id: require("@/locales/id.json"),
  en: require("@/locales/en.json"),
};

function resolve(obj: unknown, keys: string[]): string | undefined {
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return typeof cur === "string" ? cur : undefined;
}

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("id");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "en" || stored === "id") setLocaleState(stored);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      setLocale: (next: Locale) => {
        setLocaleState(next);
        try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
      },
      t: (key: string): string => {
        const keys = key.split(".");
        // Try current locale
        const result = resolve(translations[locale], keys);
        if (result !== undefined) return result;
        // Fallback to id
        const fallback = resolve(translations["id"], keys);
        return fallback ?? key;
      },
    }),
    [locale]
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
