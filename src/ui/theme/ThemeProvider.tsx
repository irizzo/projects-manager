// src/ui/theme/ThemeProvider.tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  isThemePreference,
  resolveTheme,
  systemTheme,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from "./constants";

interface ThemeContextValue {
  /** The user's choice, including "system". */
  preference: ThemePreference;
  /** What is actually rendered. */
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  /** Flip light ↔ dark, pinning an explicit preference. */
  toggleTheme: () => void;
  /** False until the stored preference has been read. See note below. */
  mounted: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(resolved: ResolvedTheme) {
  document.documentElement.setAttribute("data-theme", resolved);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Must match the server render exactly, or hydration mismatches.
  // The *visible* theme is already correct — the init script set it
  // before paint. This state only drives the toggle's own UI.
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
  const [mounted, setMounted] = useState(false);

  // Adopt whatever the init script already decided.
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      // storage blocked — fall through to "system"
    }

    const next = isThemePreference(stored) ? stored : "system";
    setPreferenceState(next);
    setResolvedTheme(resolveTheme(next));
    setMounted(true);
  }, []);

  // Follow the OS, but only while the preference is "system".
  useEffect(() => {
    if (preference !== "system") return;

    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = systemTheme();
      setResolvedTheme(next);
      applyTheme(next);
    };

    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [preference]);

  // Keep other tabs in sync.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      const next = isThemePreference(event.newValue) ? event.newValue : "system";
      setPreferenceState(next);
      const resolved = resolveTheme(next);
      setResolvedTheme(resolved);
      applyTheme(resolved);
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    const resolved = resolveTheme(next);
    setResolvedTheme(resolved);
    applyTheme(resolved);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // storage blocked — theme still applies for this session
    }
  }, []);

  const toggleTheme = useCallback(() => {
    // Resolve "system" against what is on screen, so the first
    // click always flips away from what the user is looking at.
    setPreference(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setPreference]);

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference, toggleTheme, mounted }),
    [preference, resolvedTheme, setPreference, toggleTheme, mounted],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider.");
  }
  return context;
}