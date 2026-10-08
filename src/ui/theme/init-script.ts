// src/ui/theme/init-script.ts
import { THEME_STORAGE_KEY } from "./constants";

/**
 * Runs synchronously in <head>, before first paint, to set data-theme
 * from the stored preference. Prevents a flash of the wrong theme.
 *
 * Constraints — this is NOT a normal module:
 *   - it is injected as a raw string, so it cannot import anything
 *   - it must stay small; it blocks parsing
 *   - localStorage access must be guarded: it throws in Safari
 *     private browsing and when a browser blocks site data
 */
export const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var pref = (stored === "light" || stored === "dark" || stored === "system")
      ? stored
      : "system";
    var resolved = pref === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : pref;
    document.documentElement.setAttribute("data-theme", resolved);
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
`;