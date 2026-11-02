"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const THEME_STORAGE_KEY = "theme";
const THEME_COLORS = { light: "#ffffff", dark: "#0a0a0a" } as const;

/** Applies a theme to <html data-theme> and the browser UI color. */
export function applyTheme(theme: keyof typeof THEME_COLORS) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
}

/**
 * Light/dark switch (on = dark). The saved theme is applied before first paint by the inline
 * script in app/layout.tsx; this component only reads it back and persists changes.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.dataset.theme === "dark"), []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    applyTheme(next ? "dark" : "light");
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // storage unavailable (private mode) — the choice lasts for this page view only
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={t("darkMode")}
      onClick={toggle}
      className={cn("flex h-10 w-[4.25rem] shrink-0 items-center rounded-full border border-foreground/20 bg-foreground/5 px-1 transition hover:bg-foreground/10", className)}
    >
      <span className={cn("flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform duration-300", dark && "translate-x-[26px]")}>
        {dark ? <Moon className="h-4 w-4" aria-hidden /> : <Sun className="h-4 w-4" aria-hidden />}
      </span>
    </button>
  );
}
