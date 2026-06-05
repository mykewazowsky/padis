"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import idTranslations from "@/locales/id.json";

export type Locale = "id" | "en";

const STORAGE_KEY = "padis-locale";

type TranslationMap = Record<string, unknown>;
type TranslationCache = Partial<Record<Locale, TranslationMap>>;

function resolve(obj: unknown, keys: string[]): string | undefined {
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return typeof cur === "string" ? cur : undefined;
}

async function loadEnTranslations(): Promise<TranslationMap> {
  const mod = await import("@/locales/en.json");
  return mod.default as TranslationMap;
}

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("id");
  const [cache, setCache] = useState<TranslationCache>({
    id: idTranslations as TranslationMap,
  });

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "en") {
        setLocaleState("en");
        if (!cache.en) {
          loadEnTranslations().then((data) =>
            setCache((prev) => ({ ...prev, en: data }))
          );
        }
      }
    } catch {
      // ignore
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      setLocale: (next: Locale) => {
        setLocaleState(next);
        try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
        if (next === "en" && !cache.en) {
          loadEnTranslations().then((data) =>
            setCache((prev) => ({ ...prev, en: data }))
          );
        }
      },
      t: (key: string): string => {
        const keys = key.split(".");
        const localeData = cache[locale] ?? cache.id;
        const result = resolve(localeData, keys);
        if (result !== undefined) return result;
        if (locale !== "id") {
          const fallback = resolve(cache.id, keys);
          return fallback ?? key;
        }
        return key;
      },
    }),
    [locale, cache]
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
