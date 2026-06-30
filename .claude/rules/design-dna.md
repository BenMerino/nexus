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

## Typography — generated from ONE source (tight control)
Type is the one scale nexus DOES generate. **`apps/web/ui/dna/type-scale.js`** is the single source of truth: one `TYPE_ROLES` object binds every role's family + size + weight + leading + tracking (roles: `display/h1/h2/h3/body/detail/caption/label/micro`). `npm run gen:type` (`scripts/gen-type-scale.mjs`) renders it into **two** artifacts between `@generated:type-scale … @end` sentinels — the type block of **`dna.css`** (`--text-*/--weight-*/--leading-*/--tracking-*/--font-*`) and the `typography` map in **`ui/primitives/tokens.ts`** (what `<BaseText variant=…>` reads). One edit → both regenerate → they can't drift.
- **Never hand-edit between the sentinels.** Edit `type-scale.js`, run `npm run gen:type`, stage the result.
- **Never hand-write raw type** (`font-size:18px`, `fontWeight:700`, `font-family:Inter`). Use `var(--text-*/--weight-*/--font-*)` or `<BaseText variant=…>`. Enforced: **N3-type** hard-blocks raw type in `apps/web/**`; **N3-gen** hard-blocks a drifted artifact. Exempt: `ui/primitives/`, the source/generator, `shared.css`/`dna-defaults.css` family stacks, and `ui/graph-engine/` (vendored + SVG-numeric — Zincro-owned debt).
- **Live catalog:** the Typography tab at `/dna.html` (`public/dna-typography.tsx`) renders every role straight from `type-scale.js` — same source the generator uses, so the catalog never lies.

## Canonical primitives (`apps/web/ui/primitives/`, vendored from Zincro)
The ONE primitive source: `BaseBox/BaseText/BaseAction/BaseTile/BaseIcon/BaseCheckbox/Divider/MetaChip/StatusPill/TweenedNumber` + composed components in `apps/web/ui/composed/`. **App code (`public/**`) imports them via `public/ui-kit/`** — a thin barrel re-exporting the vendored layer plus nexus app-molecules (`Stat`, `SectionHead`) rebuilt on `BaseBox`/`BaseText`, and the legacy `Tag` mapped onto `MetaChip`. The old `public/ui/` and `public/ui-primitives.tsx` copies were **deleted** (2026-06-28) — do not recreate them. Single control point for accent/glow: `<GraphProviders>` (mounts `ThemeAccentProvider`). Live catalog: `/dna.html`.

## Rules
- **No hardcoded hex** in chart/component code — build palettes from semantic tokens (`--primary`, `--secondary`, `--journal`, `--ok`, `--warn`, `--err`). `--chart-N` does **not** exist; `var(--chart-5, …)` always falls through to its hex fallback (HEURISTICS H, `design-tokens` memory).
- **No hardcoded px** in CSS — use `var(--space-*)`, `var(--radius-*)`, etc. Exceptions: `0`, `100%`, `100vh/vw`, `1px` borders, `@keyframes`.
- Chart bars consume `--accent` directly — editing the accent recolors charts.
- When a visual issue is reported ("blocky", "spacing off", "too saturated"), open `dna.css`/`shared.css` and the primitive first — not the page.
