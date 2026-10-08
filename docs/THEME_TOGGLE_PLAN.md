# Light / Dark Theme Toggle — Implementation Plan

**Status:** proposed
**Date:** 2026-10-03
**Branch:** `global-ui`

---

## 1. The core constraint (read this first)

The instinct is to write:

```scss
// ✗ This cannot work at runtime
@if $theme == "dark" {
  background: $background-color-dark;
} @else {
  background: $background-color-light;
}
```

**Sass variables are compile-time.** By the time the browser loads the CSS, `$background-color-dark`
no longer exists — it has been flattened into a literal hex string. A Sass `@if` is resolved once,
during `next build`, so it can't respond to a button click.

Runtime theme switching needs a value the browser can re-resolve after load. That is a
**CSS custom property** (`var(--background)`).

### Architecture

```
_variables.scss          Sass palette + token maps   (compile time, source of truth)
        │
        ▼
global.scss              emits :root { --background: … }
                            and :root[data-theme="dark"] { --background: … }
        │
        ▼
<html data-theme="dark"> ← set by JS before first paint, flipped by the toggle
        │
        ▼
components               background: t.theme("background");  →  var(--background)
```

The browser does the conditional work for us: changing one attribute on `<html>` re-resolves every
`var()` on the page in a single style recalculation. No re-render, no duplicated rules, no
class-name juggling in components.

### Why not the alternatives

| Approach | Why not |
| --- | --- |
| Two compiled stylesheets, swap `<link>` | Doubles CSS payload; flash while the new sheet loads. |
| `.dark` class + `@if` per component | Every rule written twice; every new component must remember both. |
| `@media (prefers-color-scheme: dark)` only | Follows the OS — gives no *toggle*. (We still use it as the no-JS fallback, see Step 4.) |
| Tailwind `dark:` variants | Not in this project's dependencies. |

---

## 2. What exists today

| File | Current state |
| --- | --- |
| [src/ui/variables.scss](src/ui/variables.scss) | Light/dark hex pairs already defined. **Imported by nothing** — currently dead code. |
| [src/ui/global.scss](src/ui/global.scss) | Plain reset. No colors, no imports. |
| [src/app/layout.tsx](src/app/layout.tsx) | Imports `global.scss`. No `<head>`, no providers. |
| [next.config.ts](next.config.ts) | `sassOptions.additionalData: '$var: red;'` — leftover scaffolding. |
| Components | [page.tsx](src/app/page.tsx), [projects/page.tsx](src/app/projects/page.tsx), [ProjectCard](src/ui/components/ProjectCard/index.tsx) — all unstyled. |

Three things to clean up as we go:

1. `$text-primary-light: red;` is a placeholder, not a real color.
2. The `:export { primaryColor: … }` block only works in a **CSS Module** (`*.module.scss`).
   In a plain `.scss` it is silently dropped. Nothing reads it — remove it.
3. `additionalData: '$var: red;'` injects an unused variable into every Sass file. Remove it.

Nothing imports `variables.scss` yet, so there is **no migration burden** — we can restructure it freely.

---

## 3. File-by-file plan

New files are marked **NEW**.

```
src/
├── app/
│   └── layout.tsx                      (edit: head script + provider)
└── ui/
    ├── _variables.scss                 (rename + restructure)
    ├── _theme.scss                     NEW  mixin + theme() function
    ├── global.scss                     (edit: emit the custom properties)
    └── theme/
        ├── constants.ts                NEW  types + storage key
        ├── init-script.ts              NEW  pre-paint script string
        ├── ThemeProvider.tsx           NEW  "use client" — state + persistence
        └── ThemeToggle/
            ├── index.tsx               NEW  the button
            └── styles.module.scss      NEW
```

---

### Step 1 — Restructure the palette

Rename `src/ui/variables.scss` → `src/ui/_variables.scss`.

The leading underscore makes it a **Sass partial**: it marks the file as import-only and stops the
compiler from emitting a standalone `variables.css` into the build output.

Split into three sections — raw palette, theme-agnostic values, and token maps.

```scss
// src/ui/_variables.scss
@use "sass:map";

// ─────────────────────────────────────────────────────────────
// Raw palette — compile-time only. Never reference these from
// a component; go through theme() so the value stays swappable.
// ─────────────────────────────────────────────────────────────
$background-light: #f0f0f0;
$background-dark: #1a1a1a;

$foreground-light: #333333;
$foreground-dark: #f0f0f0;

$surface-light: #ffffff;   // cards, panels — sits on top of background
$surface-dark: #242424;

$border-light: #d4d4d4;
$border-dark: #3a3a3a;

$text-primary-light: #1a1a1a;   // was `red` — placeholder, now a real value
$text-primary-dark: #f9f9f9;

$text-secondary-light: #4a4a4a;
$text-secondary-dark: #c6c6c6;

// ─────────────────────────────────────────────────────────────
// Theme-agnostic — identical in both themes.
// ─────────────────────────────────────────────────────────────
$primary-color: #7400a1;
$primary-color-hover: #8f1dc0;

// ─────────────────────────────────────────────────────────────
// Token maps. Each key becomes one CSS custom property.
// Both maps MUST have an identical key set (asserted below).
// ─────────────────────────────────────────────────────────────
$light-theme: (
  "background": $background-light,
  "foreground": $foreground-light,
  "surface": $surface-light,
  "border": $border-light,
  "text-primary": $text-primary-light,
  "text-secondary": $text-secondary-light,
);

$dark-theme: (
  "background": $background-dark,
  "foreground": $foreground-dark,
  "surface": $surface-dark,
  "border": $border-dark,
  "text-primary": $text-primary-dark,
  "text-secondary": $text-secondary-dark,
);

// Build-time guard: a token present in one theme but not the other
// would render as an unresolvable var() in that theme.
@each $key, $_ in $light-theme {
  @if not map.has-key($dark-theme, $key) {
    @error "Theme token `#{$key}` exists in $light-theme but is missing from $dark-theme.";
  }
}
@each $key, $_ in $dark-theme {
  @if not map.has-key($light-theme, $key) {
    @error "Theme token `#{$key}` exists in $dark-theme but is missing from $light-theme.";
  }
}
```

**Why maps instead of loose variables?** The maps let Step 2 emit all custom properties in one loop, and let the `theme()` function validate token names. Adding a new themed color becomes a two-line change in one file, and forgetting the dark value fails the build instead of shipping a broken dark mode.

**Naming:** dropped the `-color` infix (`$background-color-light` → `$background-light`) so the
Sass name and the token name line up: `$background-light` / `$background-dark` → `--background`.

---

### Step 2 — The theme module **NEW**

```scss
// src/ui/_theme.scss
@use "sass:map";
@use "variables" as v;

/// Emits one custom property per entry in $map.
/// Call inside a selector (`:root`, `[data-theme="dark"]`, …).
@mixin emit-vars($map) {
  @each $name, $value in $map {
    --#{$name}: #{$value};
  }
}

/// Resolves a token name to var(--token).
/// Unknown names fail the build rather than producing dead CSS.
@function theme($name) {
  @if not map.has-key(v.$light-theme, $name) {
    @error "Unknown theme token `#{$name}`. Available tokens: #{map.keys(v.$light-theme)}.";
  }
  @return var(--#{$name});
}
```

The `@error` is the main reason to wrap `var()` in a function. A hand-written `var(--backgrond)`
typo is **silent** — CSS drops the declaration and the element renders transparent, and you debug
it in devtools. `t.theme("backgrond")` stops `next build` with the list of valid tokens.

Note the `#{$value}` interpolation in the mixin: Sass treats custom-property values as raw
un-parsed tokens, so a bare `$value` would emit the literal text `$value`.

---

### Step 3 — Emit the properties in `global.scss`

```scss
// src/ui/global.scss
@use "theme" as t;
@use "variables" as v;

// ── Light (default) ──────────────────────────────────────────
:root {
  color-scheme: light;
  @include t.emit-vars(v.$light-theme);

  // Theme-agnostic tokens
  --primary: #{v.$primary-color};
  --primary-hover: #{v.$primary-color-hover};
}

// ── Dark ─────────────────────────────────────────────────────
:root[data-theme="dark"] {
  color-scheme: dark;
  @include t.emit-vars(v.$dark-theme);
}

// ── No-JS fallback ───────────────────────────────────────────
// The init script (Step 5) always writes a concrete data-theme,
// so this only applies when JS is disabled and the attribute is
// absent. `:not([data-theme])` can never collide with the rules
// above, which keeps us out of specificity-tie territory.
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
    color-scheme: dark;
    @include t.emit-vars(v.$dark-theme);
  }
}

* {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

a {
  color: inherit;
  text-decoration: none;
}

html,
body {
  min-width: 100vw;
  max-width: 100vw;
  min-height: 100vh;
  max-height: 100vh;
}

body {
  display: flex;
  flex-direction: column;
  font-family: Verdana, Geneva, Tahoma, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;

  background-color: t.theme("background");
  color: t.theme("text-primary");
}
```

`color-scheme` is doing real work here, not decoration: it tells the browser to render native UI —
scrollbars, `<select>` dropdowns, date pickers, form field defaults — in the matching shade. Without
it you get a dark page with bright white scrollbars.

**On the existing `max-height: 100vh` on `html, body`:** this clips the page at viewport height, so
content below the fold is unreachable once the pages have real content. Unrelated to theming and
left as-is — flagging it because it will bite during Step 9.

---

### Step 4 — Why JS resolves `"system"`, not CSS

A tempting shortcut is to let the media query handle the system case and have `data-theme` override
it. The problem is specificity:

- `:root[data-theme="dark"]` → specificity (0, 2, 0)
- `:root:not([data-theme="light"])` → also (0, 2, 0), because `:not()` takes its argument's specificity

Equal specificity means **source order** decides, which makes the cascade fragile — it silently
breaks if the rules are ever reordered or if the media block moves.

Instead:

- **localStorage holds the _preference_:** `"light" | "dark" | "system"`.
- **`data-theme` holds the _resolved_ value:** always `"light"` or `"dark"`, never `"system"`.
- JS resolves `"system"` via `matchMedia` and re-resolves when the OS changes.

CSS then only ever sees two mutually exclusive states. No ties, no ordering dependency.

---

### Step 5 — Types, storage key, and the pre-paint script **NEW**

```ts
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
```

#### The flash-of-wrong-theme problem

React renders on the server, then hydrates. The server cannot read `localStorage` — it does not
exist there. So if the provider sets the theme in a `useEffect`, the sequence is:

1. Server sends HTML with no `data-theme` → **light**
2. Browser paints → user sees a **white flash**
3. React hydrates, effect runs, theme flips to dark

That flash is one or two frames of bright white in a dark room. The fix is a tiny **synchronous**
script in `<head>` that runs before the browser's first paint:

```ts
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
```

`JSON.stringify(THEME_STORAGE_KEY)` keeps the storage key to a single source of truth and quotes it
correctly, rather than hardcoding `"em-theme"` a second time inside the string.

**Use an inline `<script>`, not `next/script`.** Even `strategy="beforeInteractive"` is not
guaranteed to execute before first paint — which is the entire point of this script. A plain inline
`<script>` in `<head>` is synchronous and blocking, so it is the one thing that reliably wins the
race.

---

### Step 6 — `ThemeProvider` **NEW**

```tsx
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
```

**Design notes**

- **`mounted` exists to protect the toggle, not the page.** The page colors are correct from the
  first paint. But the *button* renders on the server, where the stored preference is unknown — so
  a sun/moon icon chosen during SSR can disagree with the real theme. `mounted` lets the toggle
  render a neutral placeholder for one tick instead of visibly swapping its icon.
- **The provider wraps `children` but does not re-render them on theme change.** Switching themes
  mutates one DOM attribute; the cascade does the rest. Only components that actually call
  `useTheme()` re-render.
- **`throw` in `useTheme`** turns a missing provider into an immediate, named error rather than
  a confusing `null` dereference.

---

### Step 7 — `ThemeToggle` **NEW**

```tsx
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
```

```scss
// src/ui/theme/ThemeToggle/styles.module.scss
@use "theme" as t;

.toggle,
.placeholder {
  width: 2.5rem;
  height: 2.5rem;
}

.toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;

  font-size: 1.125rem;
  line-height: 1;
  cursor: pointer;

  background-color: t.theme("surface");
  color: t.theme("text-primary");
  border: 1px solid t.theme("border");
  border-radius: 50%;

  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;

  &:hover {
    border-color: var(--primary);
  }

  &:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }
}
```

**Accessibility**

- The emoji sits in an `aria-hidden` span; the `aria-label` carries the meaning. Screen readers
  announce *"Switch to dark theme, button"* rather than the character name.
- The label states the **action** (`Switch to dark`), not the current state. This is why
  `aria-pressed` is omitted — "pressed" has no natural meaning for a two-way theme switch, and
  combining it with an action label gives contradictory announcements.
- `:focus-visible` rather than `:focus` keeps the ring for keyboard users without flashing it on
  mouse clicks. Never remove it — this is the only way a keyboard user locates the control.

Mount it somewhere persistent. There is no header component yet, so for now place it directly in
the layout; move it into a real header when one exists.

---

### Step 8 — Wire up `layout.tsx`

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";
import "@/database/firebase.config";
import "@/ui/global.scss";
import { ThemeProvider } from "@/ui/theme/ThemeProvider";
import ThemeToggle from "@/ui/theme/ThemeToggle";
import { themeInitScript } from "@/ui/theme/init-script";

export const metadata: Metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the init script sets data-theme on this
    // element before React hydrates, so the client attributes will not
    // match the server HTML. Scoped to <html> only — it does not
    // suppress warnings for any descendant.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: static
          // build-time string, no user input; must be synchronous and
          // inline to run before first paint.
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
      </head>
      <body>
        <ThemeProvider>
          <ThemeToggle />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

**`suppressHydrationWarning` is required, and it is safe here.** Without it React logs a mismatch
warning on every load, because the init script deliberately changed `<html>` before hydration. The
prop does not cascade to children, so real mismatches elsewhere still surface.

**Keep `ThemeProvider` as deep as possible** — here, inside `<body>`. It is a client component, so
everything it wraps becomes part of the client boundary. `layout.tsx` itself stays a server
component, and `page.tsx` / `projects/page.tsx` remain **async server components** that can keep
awaiting Firebase. Passing them as `children` through a client provider does not convert them.

---

### Step 9 — Make Sass imports resolvable from anywhere

`@use "theme"` only resolves relative to the importing file, so a deep component would need
`@use "../../../ui/theme" as t;`. Fix it once in config:

```ts
// next.config.ts
import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  sassOptions: {
    // Lets any .scss file write `@use "theme"` / `@use "variables"`
    // regardless of its depth. The `@/*` TS alias does NOT work in
    // Sass — it is a TypeScript/bundler alias, unknown to the Sass
    // compiler, which resolves load paths itself.
    //
    // `loadPaths`, not `includePaths`: the latter is the legacy Sass
    // API name and is ignored by the modern compiler API that Next
    // uses, which fails with "Can't find stylesheet to import".
    loadPaths: [path.join(process.cwd(), "src/ui")],
  },
};

export default nextConfig;
```

Note that `additionalData: '$var: red;'` is **removed** — it was unused scaffolding.

Do *not* be tempted to replace it with `additionalData: '@use "theme" as t;'`. It would save a line
per file but breaks the moment a file writes its own `@use "theme"` — Sass rejects two loads of the
same module under the same namespace in one file. Explicit per-file `@use` is worth the line.

---

### Step 10 — Apply tokens to existing components

Now that `body` carries the themed background and text color, the pages inherit sane defaults. The
one component with its own surface is `ProjectCard`.

```scss
// src/ui/components/ProjectCard/styles.module.scss   NEW
@use "theme" as t;

.card {
  padding: 1rem 1.25rem;
  border: 1px solid t.theme("border");
  border-radius: 0.5rem;
  background-color: t.theme("surface");
}

.title {
  margin-bottom: 0.25rem;
  color: t.theme("text-primary");
  font-size: 1.125rem;
}

.meta {
  color: t.theme("text-secondary");
  font-size: 0.8125rem;
}
```

```tsx
// src/ui/components/ProjectCard/index.tsx
import type { Project } from "@/types";
import styles from "./styles.module.scss";

export default function ProjectCard({ project }: { project: Project }) {
  return (
    <div className={styles.card}>
      <h2 className={styles.title}>{project.name}</h2>
      <p className={styles.meta}>ID: {project.id}</p>
    </div>
  );
}
```

> Separate from theming: this component currently reads `project.Name`, but
> [src/types/index.ts](src/types/index.ts) declares the field as `name` (lowercase). That renders
> `undefined`. Corrected above since we are editing the file anyway — worth confirming which
> casing Firestore actually stores.

**The rule for all future styling:** never reference a `$…-light` / `$…-dark` Sass variable from a
component. Always go through `t.theme("token")`. A component that uses the raw Sass variable is
frozen to one theme and will not respond to the toggle.

---

### Step 11 — Verification

Run `npm run dev`, then check each of these:

| # | Check | Expected |
| --- | --- | --- |
| 1 | Click the toggle | Colors flip immediately; icon updates |
| 2 | Reload after choosing dark | Loads dark, **no white flash** |
| 3 | Throttle CPU 6× in devtools, hard-reload | Still no flash — proves the init script beats paint |
| 4 | Set OS to dark, clear localStorage, reload | Loads dark (`"system"` default) |
| 5 | Change OS theme with preference `"system"` | Page follows live, no reload |
| 6 | Change OS theme after clicking the toggle | Page does **not** change — explicit choice wins |
| 7 | Open two tabs, toggle in one | Other tab follows (`storage` event) |
| 8 | Disable JS, OS in dark | Dark via the media-query fallback |
| 9 | Dark mode: scroll a long page; open a `<select>` | Scrollbar and dropdown are dark (`color-scheme`) |
| 10 | Tab to the toggle | Visible focus ring; `Enter` and `Space` both activate |
| 11 | Safari private browsing | No crash; defaults to light, toggle works for the session |
| 12 | Add a token to `$light-theme` only | `next build` **fails** with the Step 1 `@error` |
| 13 | `t.theme("nonsense")` | Build **fails** listing valid tokens |

Then:

```bash
npm run lint     # biome check
npm run build    # catches Sass @error guards and type errors
```

Also confirm **contrast** rather than eyeballing it. Both directions need WCAG AA (4.5:1 for body
text): `#333333` on `#f0f0f0` ≈ 10.9:1 ✓ and `#f9f9f9` on `#1a1a1a` ≈ 16.1:1 ✓. But `--primary`
`#7400a1` on the dark `#1a1a1a` background is only ≈ 3.5:1 — **below AA for text.** It is fine for
the focus ring and borders (3:1 applies to non-text), but if purple is ever used for body copy or
link text, dark mode needs a lightened variant. Resolve this by making `--primary` a themed token
(a light-purple dark-mode value) rather than the theme-agnostic one it is in Step 1.

---

### Step 12 — Optional follow-ups

Not required for the feature to work.

**Mobile browser chrome.** Tints the address bar to match. Add to `metadata` in `layout.tsx`:

```ts
export const metadata: Metadata = {
  // …
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f0f0f0" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a1a" },
  ],
};
```

Caveat: this keys off the OS preference, so it will disagree with an explicit in-app override.
Syncing it exactly means updating the `<meta>` from `ThemeProvider` on every change.

**Cross-fade on switch.** An instant flip can feel abrupt. The naive fix — `transition` on `*` —
also animates during initial page load and costs real performance on large trees. Apply it only
during the switch:

```scss
:root.theme-switching,
:root.theme-switching * {
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease !important;
}

@media (prefers-reduced-motion: reduce) {
  :root.theme-switching,
  :root.theme-switching * {
    transition: none !important;
  }
}
```

Add the class in `setPreference`, remove it after ~250ms. Honor `prefers-reduced-motion` — a
full-page color animation is exactly the kind of thing that triggers vestibular discomfort.

**Three-way control.** `setPreference` already accepts `"system"`; the current button only cycles
light/dark. A segmented Light / Dark / System control would expose the third state and let users
return to following the OS after an explicit choice. Worth doing once there is a settings surface.

**Cookie-based SSR theme.** The one thing this design cannot do is render the correct theme in the
*server HTML* — the init script fixes it before paint, but the markup itself always says light.
Storing the preference in a cookie instead lets `layout.tsx` read it via `cookies()` and emit
`<html data-theme="dark">` directly, removing the inline script and the `mounted` dance entirely.
The tradeoff: the cookie rides along on every request, and the layout becomes dynamic, forfeiting
static rendering. Only worth it if the inline script becomes a problem (e.g. a strict CSP that
forbids inline scripts without a nonce).

---

## 4. Execution order

Each step leaves the app in a building state.

| # | Step | Depends on |
| --- | --- | --- |
| 1 | `_variables.scss` restructure | — |
| 2 | `_theme.scss` | 1 |
| 3 | `loadPaths` in `next.config.ts` | — |
| 4 | `global.scss` emits properties | 1, 2 |
| 5 | `theme/constants.ts` | — |
| 6 | `theme/init-script.ts` | 5 |
| 7 | `ThemeProvider.tsx` | 5 |
| 8 | `ThemeToggle/` | 2, 7 |
| 9 | `layout.tsx` wiring | 6, 7, 8 |
| 10 | `ProjectCard` tokens | 2, 3 |
| 11 | Verification pass | all |

After step 4 the app is themeable but has no toggle — verify by hand-setting
`data-theme="dark"` on `<html>` in devtools before building any of the React layer. That isolates
"do the CSS variables work?" from "does the React state work?", which is much easier to debug than
finding out both are broken at once.

---

## 5. Summary of decisions

| Decision | Rationale |
| --- | --- |
| CSS custom properties, not Sass `@if` | Sass is compile-time; runtime switching needs runtime values |
| `data-theme` on `<html>`, not a class | Attribute selectors read clearly and leave `className` free |
| Sass token **maps** | One loop emits all properties; mismatched themes fail the build |
| `theme()` wrapper over bare `var()` | Typos become build errors instead of silently-dropped CSS |
| JS resolves `"system"`, CSS sees two states | Avoids a `:not()` specificity tie in the cascade |
| Preference and resolved value stored separately | `"system"` must survive a reload as *"follow the OS"* |
| Blocking inline `<script>` in `<head>` | Only reliable way to beat first paint; kills the flash |
| `suppressHydrationWarning` on `<html>` only | The mismatch is deliberate; scoped so real ones still show |
| `ThemeProvider` inside `<body>` | Keeps pages as async server components for Firebase |
| `color-scheme` alongside each theme | Themes native scrollbars and form controls too |





-----

Plan saved to THEME_TOGGLE_PLAN.md — 12 steps with the actual code for every file, plus an execution order and a verification table.

The central thing to know before you start:

Sass @if can't do what you want. $background-color-dark is flattened to a hex string at build time, so a Sass conditional is resolved once during next build and can't respond to a click. The plan routes your Sass palette into CSS custom properties, which the browser can re-resolve after load:

_variables.scss (palette + token maps) → global.scss emits --background
→ <html data-theme="dark"> → components use t.theme("background")
Flipping one attribute on <html> re-themes the whole page in one style recalc — no re-render, no rules written twice.

You still author in Sass, and you get something plain CSS vars don't give you: a theme() function that fails the build on a typo'd token name (a hand-written var(--backgrond) is silently dropped and renders transparent), plus a guard that errors if a token exists in one theme but not the other.

Four decisions worth your attention, since they're where I'd expect pushback:

A blocking inline <script> in <head>. Unavoidable — the server can't read localStorage, so without it you get a frame of white flash on every dark-mode load. next/script with beforeInteractive isn't guaranteed to beat first paint, which is the whole point. This also requires suppressHydrationWarning on <html>.
JS resolves "system", not CSS. Letting a media query handle it creates a specificity tie with [data-theme="dark"] (both 0,2,0), so source order silently decides. Instead, localStorage holds the preference (light/dark/system) and data-theme holds only the resolved value.
ThemeProvider goes inside <body>, not around the layout — so page.tsx and projects/page.tsx stay async server components and keep awaiting Firebase.
color-scheme is in there deliberately, not as polish: without it you get a dark page with bright white scrollbars and form controls.
Three things in the current code the plan cleans up: $text-primary-light: red (placeholder), the :export block (silently dropped outside a .module.scss, and nothing reads it), and additionalData: '$var: red;' in your Next config.

Two pre-existing issues I noticed and flagged rather than silently changed — both outside the theming ask:

ProjectCard reads project.Name, but types/index.ts declares name. That renders undefined. Step 10 corrects it since it edits that file — worth confirming which casing Firestore actually stores.
max-height: 100vh on html, body in global.scss clips content below the fold. Harmless while pages are empty; it'll bite as soon as the project list grows.
One contrast finding from checking the palette: --primary #7400a1 on dark #1a1a1a is ≈3.5:1, under AA for text. Fine for borders and the focus ring, but if purple ever becomes link or body text, make --primary a themed token with a lightened dark value instead of the theme-agnostic one in Step 1.

Want me to implement it?
