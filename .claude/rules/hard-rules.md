---
description: Core Nexus invariants (N1–N7). Always loaded. Phase-3 arch-audit will enforce N1–N4 at commit; until then they are conventions.
---

# Hard Rules

The non-negotiables. Codes are stable so docs, commits, and (future) audit can reference them. Universal coding guidelines live in `~/.claude/CLAUDE.md`; these are Nexus-specific.

## N1 — Scope Guard
Every API handler that **reads** tenant data calls `requireScope(req, res)` (`apps/api/src/lib/scope.js`) and filters through the returned scope. Every handler that **writes** calls `requireEditor(req)` or `requireRole(req, ...roles)` (`apps/api/src/lib/auth.js`). No SQL query runs without a tenant/scope filter; no hardcoded tenant IDs. `tenant_admin` is a capability flag *separate* from `role` — honor it wherever editor access is gated. Cross-scope leakage is the only fatal error.

## N2 — Live Tree Only
The deployed code is **`apps/api/`** (Express, Railway) and **`apps/web/`** (Vite). The root `api/`, `lib/`, `public/` and `legacy/` directories are **dead** — edits there never run. Before touching backend, confirm you're under `apps/api/`; schema changes are a new `apps/api/src/db/migrations/NNN_*.sql`, not an inline `ALTER`. Frontend lives in `apps/web/public/`. (CLAUDE.md's "Commands"/"Architecture" sections still describe the dead Vercel tree — stale.)

## N3 — Token-Sourced Styling
UI and chart colors come from the design-DNA tokens: scales in `apps/web/public/dna.css`, palette in `shared.css` `:root` (+ `[data-theme="light"]`). No hardcoded hex per chart, no invented `--chart-N` (it doesn't exist — it falls through to the hex fallback). Build chart palettes from the semantic tokens (`--primary`, `--secondary`, `--journal`, `--ok`, `--warn`, `--err`). Fix visual problems at the token/primitive layer, not the call site.

## N4 — Data-Layer Isolation
SQL lives in `apps/api/src/lib/db*.js` (and feature libs like `claustro.js`), never inline in handlers and never in the frontend. Handlers are thin: auth/scope → call a lib function → return JSON. The frontend reaches data only via `fetch('/api/...')` — no DB driver, no secrets client-side.

## N5 — File Size ≤150
`hooks/pre-commit-audit.sh` blocks commits with `.js/.ts/.tsx/.mjs/.cjs` files over 150 lines. One concern per file; the line count is the proxy. When it fires, **refactor** (extract a cohesive chunk) — never compress (no one-lining `useMemo`/`if`, no stripping comments). `.md`/`.css`/`.html` are exempt.

## N6 — Theme / No-FOUC
Light/dark follows OS `prefers-color-scheme`. A synchronous boot script (injected by `vite.config.ts` after `</title>`) sets `data-theme` AND applies cached surface tokens from `localStorage['nexus.theme-tokens']` **before first paint**. Don't remove it when editing HTML templates. The 7 configurable surface tokens are inline-on-`:root`; everything else is CSS. Keep the boot script's token-slug list in sync with `SURFACE_TOKEN_KEYS`.

## N7 — Single-Language Chrome
All user-facing UI is **English**. Exempt: proper nouns (Fondecyt, CORFO, CNA, ANID, real university/journal names), stored DB data, and CSV column matchers that must match a Spanish export header. When translating, don't break data matching — flag the migration instead of silently desyncing.

## Deploy
After a task, commit and push `main` (Railway auto-deploys both services). Ask before destructive git ops (force push, `reset --hard`, branch deletion).

## Enforcement
`scripts/arch-audit.sh` runs at pre-commit (via `.git/hooks/pre-commit` → `hooks/pre-commit-audit.sh`). **Hard-blocks:** N2 (dead-tree edits), N4 (`@vercel/postgres` / frontend DB driver), N5 (≤150 lines). **Soft-warns:** N1 (handler missing a gate), N3 (new hex / `--chart-N`). Per-file opt-out: comment `arch-audit-ignore: N1` (etc.). Run manually: `bash scripts/arch-audit.sh`. On a fresh clone, install with `cp hooks/pre-commit-audit.sh .git/hooks/pre-commit` (git hooks aren't version-controlled).

## On-demand subsystem guides
Read from `.claude/rules/` when touching the area (not auto-loaded): `scope-model.md`, `db-layer.md`, `design-dna.md`, `theme.md`, `claustro-feature.md`. Doctrine: `docs/PHILOSOPHY.md`, `docs/ANTI_PATTERNS.md`, `docs/HEURISTICS.md`.
