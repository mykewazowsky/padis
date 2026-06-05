"use client";

import { useLanguage } from "@/contexts/LanguageContext";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useLanguage();

  return (
    <button
      type="button"
      onClick={() => setLocale(locale === "id" ? "en" : "id")}
      aria-label={locale === "id" ? "Switch to English" : "Ganti ke Bahasa Indonesia"}
      className={`inline-flex items-center gap-1 rounded-lg border border-[var(--theme-shell-border)] bg-[var(--theme-toggle-bg)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-[var(--theme-shell-text-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] ${className}`}
    >
      <span className={locale === "id" ? "text-[var(--color-primary)]" : "opacity-40"}>ID</span>
      <span className="opacity-30">/</span>
      <span className={locale === "en" ? "text-[var(--color-primary)]" : "opacity-40"}>EN</span>
    </button>
  );
}
