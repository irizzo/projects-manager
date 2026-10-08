// src/ui/theme/ThemeToggle/index.tsx
"use client";

import { useTheme } from "../ThemeProvider";
import styles from "./styles.module.scss";

export default function ThemeToggle() {
  const { resolvedTheme, toggleTheme, mounted } = useTheme();

  // Reserve the layout box, but stay silent to AT until we know
  // the real theme — otherwise the label announces the wrong state.
  if (!mounted) {
    return <div className={styles.placeholder} aria-hidden="true" />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
      title={`Switch to ${isDark ? "light" : "dark"} theme`}
    >
      <span aria-hidden="true">{isDark ? "☀" : "☾"}</span>
    </button>
  );
}