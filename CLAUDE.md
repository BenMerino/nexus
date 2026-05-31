# CLAUDE.md

Guidance for Claude Code working in this repo. Nexus-specific only — universal coding guidelines live in `~/.claude/CLAUDE.md`.

## Memory & invariants (read first)

Nexus's doctrine lives **in-repo** (a Zincro-style memory system, Phase 1):

- **Invariants `N1–N7`** — `.claude/rules/hard-rules.md` (`@`-included below, always loaded): scope guard, live-tree, token styling, data-layer isolation, file size, theme/FOUC, English-only.
- **Philosophy** — `docs/PHILOSOPHY.md` (5 tenets + voice).
- **Heuristics** — `docs/HEURISTICS.md` (`H-NNN` gotchas: per-ISSN tags, OpenAlex flags, FOUC, scope divergence…).

> ⚠️ **The "Commands" and "Architecture" sections below are STALE.** They describe the dead pre-monorepo Vercel tree (`vercel dev`, `node build.js`, root `api/`/`lib/`/`public/`, "three tables"). The **live** tree is `apps/api/` (Express on Railway) + `apps/web/` (Vite). See **N2**. Full rewrite pending (memory-system Phase 2).

@.claude/rules/hard-rules.md

## Commands

- **Dev server:** `vercel dev` (or `npm run dev`)
- **Build:** `node build.js` (bundles React entries via esbuild)
- **No test suite configured.**

## Architecture

Nexus is a DOI metadata aggregator and multi-tenant CRIS for universities. Users submit DOIs (or bulk-import by institution ROR); the system fetches metadata from four scholarly APIs (CrossRef, OpenAlex, Semantic Scholar, DataCite), normalizes/merges, stores in Neon PostgreSQL, and renders interactive graph + chart views.

**Backend:** Vercel serverless functions in `api/`. One file per route.
**Database:** Neon PostgreSQL via `@vercel/postgres`. Schema + queries in `lib/db.js`. Three tables: `submissions`, `doi_records`, `tags`.
**Frontend:** HTML pages in `public/` with React bundles built by `build.js`. Six bundles: `charts`, `relationships`, `dashboard`, `tenant`, `shell-mount`, `collaborators`.
**Graph engine:** `graph-engine/` holds shared D3 visualization modules (rendering, force sim, color scales, legends, drag).

For cross-cutting invariants (scope model, role hierarchy, auth flow, HTML→bundle map), see [ARCHITECTURE.md](ARCHITECTURE.md).
For data pipeline details, see [lib/README.md](lib/README.md).

## Project Rules

### Rule nbr15: File Size

`hooks/pre-commit-audit.sh` blocks commits with source files over 150 lines. This fires at commit time only — write code at whatever size it naturally wants to be, and refactor only when the hook complains or the seam is real.

**When the hook fires, refactor — extract a cohesive chunk into a new file and import it back.** Never compress: don't collapse multi-line `useMemo` / `useEffect` / `if` blocks into one-liners, don't strip comments or whitespace, don't inline things that were intentionally expanded. The rule exists to force real refactoring; making the code denser defeats its purpose.

### Deploy policy

After every task, commit and push to `main`. Vercel auto-deploys from `main`. Do not ask first. Still ask before destructive git ops (force push, reset --hard, branch deletion).
