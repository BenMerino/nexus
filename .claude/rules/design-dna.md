---
paths:
  - "apps/web/public/**/*.css"
  - "apps/web/public/dna.css"
  - "apps/web/public/ui/**"
description: N3 design-DNA token system — scales (dna.css), palette (shared.css), atomic primitives. No hardcoded hex/px.
---

# Design DNA (N3)

A hand-written token system modeled on Zincro's `packages/shared` DNA, minus the live-generation pipeline (Nexus is smaller — see the `dna-design-system` memory). Visual changes happen at the token layer, not the call site.

## Two token files
- **`apps/web/public/dna.css`** — the **scales** `shared.css` lacked: spacing `--space-*`, radius roles `--radius-control/card/pill`, shadow `--shadow-sm/md/lg`, z-index `--z-*`, motion `--motion-*`/`--ease-out`, type scale `--text-*`/`--leading-*`/`--tracking-*`. `shared.css` `@import "./dna.css"` at the very top.
- **`shared.css` `:root`** — the **palette** (surfaces, foreground, brand, domain, status). Color tokens deliberately live here (not dna.css) because the theme handler reads/writes them per-mode. See `theme.md`.

## Resolution chain
primitive prop → `ui/tokens.ts` (`name → var(--…)`) → CSS variable → resolved value. Example: `<BaseBox p="4">` → `var(--space-4)`.

## Atomic primitives (`apps/web/public/ui/`)
`BaseBox.tsx` (layout via tokens), `BaseText.tsx` (type-scale variants), `BaseAction.tsx` (reuses `shared.css` `.primary`/`.secondary`/`.link-btn`), `index.ts` barrel. Each ≤150 lines. Library code — not all consumers migrated yet (DNA roadmap Phase 4). *(Note: a second, older primitives copy exists at `apps/web/ui/primitives/` — `public/ui/` is the canonical one per the DNA memory; don't add to both.)*

## Rules
- **No hardcoded hex** in chart/component code — build palettes from semantic tokens (`--primary`, `--secondary`, `--journal`, `--ok`, `--warn`, `--err`). `--chart-N` does **not** exist; `var(--chart-5, …)` always falls through to its hex fallback (HEURISTICS H, `design-tokens` memory).
- **No hardcoded px** in CSS — use `var(--space-*)`, `var(--radius-*)`, etc. Exceptions: `0`, `100%`, `100vh/vw`, `1px` borders, `@keyframes`.
- Chart bars consume `--accent` directly — editing the accent recolors charts.
- When a visual issue is reported ("blocky", "spacing off", "too saturated"), open `dna.css`/`shared.css` and the primitive first — not the page.
