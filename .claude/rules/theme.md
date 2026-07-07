---
paths:
  - "apps/web/public/spa/theme-config.ts"
  - "apps/web/public/shell-mount.tsx"
  - "apps/web/vite.config.ts"
  - "apps/web/public/shared.css"
description: N6 light/dark theming + the pre-paint no-FOUC boot script + cached surface tokens.
---

# Theme & No-FOUC (N6)

Light/dark follows OS `prefers-color-scheme` — no per-user override. Don't break the pre-paint boot script.

## How mode is applied
- `spa/theme-config.ts` — `activeThemeMode()` reads the OS setting; `applyThemeMode(mode, tokens)` sets `data-theme` on `<html>` and writes the 7 surface tokens as **inline styles on `:root`** (these win over CSS). Side-effect-free — safe to import anywhere.
- `shell-mount.tsx` — `loadThemeTokens()` fetches `/api/theme-tokens`, applies them, **and caches the response to `localStorage['nexus.theme-tokens']`**, then subscribes to OS changes.

## Two-layer token model — do not collapse
- **7 configurable surface tokens** (`bg, bg-elev, bg-card, border, fg, fg-muted, accent`) persist per-mode in the `theme_tokens` table as `theme-<mode>-<token>`, edited at `/theme` (superadmin), applied inline on `:root`.
- **Everything else** (bg-inset, fg-dim, border-soft, ok/warn/err, journal/talca/paper…) gets static light values in the `:root[data-theme="light"]` block in `shared.css`; the dark baseline is plain `:root`.

## The no-FOUC boot script (`vite.config.ts` `transformIndexHtml`)
Injected synchronously after `</title>` in every HTML, **before any CSS**. It: sets `data-theme="light"` if the OS is light, then reads `localStorage['nexus.theme-tokens']` and applies the active mode's surface tokens — so first paint already uses the customized palette. Paired with `color-scheme` on `:root`/`:root[data-theme=light]` to fix the pre-CSS canvas.
- **Don't remove it** when refactoring HTML templates.
- Keep the boot script's inlined token-slug list in sync with `SURFACE_TOKEN_KEYS`.
- First-ever visit (empty cache) still flashes once — acceptable (HEURISTICS H-006).

## Hazard
`shell-mount.tsx` runs `mount()` as a top-level side effect on import — reach it only via the lazy `import("../shell-mount")`, never a static import, or the sidebar fails to render for everyone (HEURISTICS H-003).
