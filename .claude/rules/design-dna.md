---
paths:
  - "apps/web/public/**/*.css"
  - "apps/web/public/dna.css"
  - "apps/web/public/ui/**"
description: N3 design-DNA token system — scales (dna.css), palette (shared.css), atomic primitives. No hardcoded hex/px.
---

# Design DNA (N3)

A hand-written token system modeled on Zincro's `packages/shared` DNA, minus the live-generation pipeline (Nexus is smaller — see the `dna-design-system` memory). Visual changes happen at the token layer, not the call site.

## Token files (import order in `shared.css`, top of file)
1. **`apps/web/public/dna-defaults.css`** — the **Zincro DNA token root**, vendored (synced via `sync-engine.sh` `SHARED_FILES`). The base the vendored `ui/primitives`+`ui/composed` are built against: control/nest cascade (`--_ctl-*`/`--_nest-*`), `--status-*`, `--bg-elevated`, numeric `--space-N`, ramps, `--icon-control-*`. **Don't hand-edit — fix in Zincro and sync.**
2. **`apps/web/public/dna.css`** — nexus's own **scales** layered on top: spacing `--space-*` aliases, radius roles, shadow, z-index, motion, type scale.
3. **`apps/web/public/dna-bridge.css`** — nexus-owned **alias bridge**: maps the theme-handler surface tokens (`--bg/--fg/--accent/--ok…`) onto Zincro's component-var names (`--bg-main/--text-main/--primary/--status-*`) + seeds the `--_ctl-*` md-row root defaults. One direction (nexus→Zincro); theme handler stays source of truth. See `theme.md`.
4. **`shared.css` `:root`** — the **palette** (surfaces, foreground, brand, domain, status). Lives here (not dna.css) because the theme handler reads/writes it per-mode. Overrides #1's surfaces by source order.

## Resolution chain
primitive prop → `ui/primitives/tokens.ts` (`name → var(--…)`) → CSS variable (defined in dna-defaults/dna.css, aliased in dna-bridge) → resolved value. Example: `<BaseBox p="4">` → `var(--space-4)`.

## Canonical primitives (`apps/web/ui/primitives/`, vendored from Zincro)
The ONE primitive source: `BaseBox/BaseText/BaseAction/BaseTile/BaseIcon/BaseCheckbox/Divider/MetaChip/StatusPill/TweenedNumber` + composed components in `apps/web/ui/composed/`. **App code (`public/**`) imports them via `public/ui-kit/`** — a thin barrel re-exporting the vendored layer plus nexus app-molecules (`Stat`, `SectionHead`) rebuilt on `BaseBox`/`BaseText`, and the legacy `Tag` mapped onto `MetaChip`. The old `public/ui/` and `public/ui-primitives.tsx` copies were **deleted** (2026-06-28) — do not recreate them. Single control point for accent/glow: `<GraphProviders>` (mounts `ThemeAccentProvider`). Live catalog: `/dna.html`.

## Rules
- **No hardcoded hex** in chart/component code — build palettes from semantic tokens (`--primary`, `--secondary`, `--journal`, `--ok`, `--warn`, `--err`). `--chart-N` does **not** exist; `var(--chart-5, …)` always falls through to its hex fallback (HEURISTICS H, `design-tokens` memory).
- **No hardcoded px** in CSS — use `var(--space-*)`, `var(--radius-*)`, etc. Exceptions: `0`, `100%`, `100vh/vw`, `1px` borders, `@keyframes`.
- Chart bars consume `--accent` directly — editing the accent recolors charts.
- When a visual issue is reported ("blocky", "spacing off", "too saturated"), open `dna.css`/`shared.css` and the primitive first — not the page.
