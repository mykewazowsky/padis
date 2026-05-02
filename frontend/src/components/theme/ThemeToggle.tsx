"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "./ThemeProvider";

type Props = {
  mobile?: boolean;
};

export default function ThemeToggle({ mobile = false }: Props) {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && theme === "dark";
  const label = isDark ? "Gunakan tema terang" : "Gunakan tema gelap";

  if (mobile) {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className="inline-flex w-full items-center justify-between rounded-2xl border border-[var(--theme-shell-border)] bg-[var(--theme-shell-surface)] px-4 py-3 text-sm font-medium text-[var(--theme-shell-text)] transition hover:bg-[var(--theme-toggle-hover)]"
        aria-label={label}
        title={label}
      >
        <span>Tema</span>
        <span className="inline-flex items-center gap-2 text-[var(--theme-shell-text-muted)]">
          {isDark ? "Gelap" : "Terang"}
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--theme-shell-border)] bg-[var(--theme-toggle-bg)] text-[var(--theme-shell-text)] shadow-sm">
            {isDark ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </span>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="hidden md:inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--theme-shell-border)] bg-[var(--theme-toggle-bg)] text-[var(--theme-shell-text)] shadow-sm transition hover:bg-[var(--theme-toggle-hover)]"
      aria-label={label}
      title={label}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
