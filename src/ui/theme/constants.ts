// src/ui/theme/constants.ts
export const THEME_STORAGE_KEY = "em-theme";

/** What the user chose. Persisted. */
export type ThemePreference = "light" | "dark" | "system";

/** What is actually on screen. Written to <html data-theme>. */
export type ResolvedTheme = "light" | "dark";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function systemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === "system" ? systemTheme() : preference;
}