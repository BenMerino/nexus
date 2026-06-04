# CLAUDE.md

Guidance for Claude Code working in this repo. Nexus-specific only — universal coding guidelines live in `~/.claude/CLAUDE.md`.

## Memory & invariants (read first)

Nexus's doctrine lives **in-repo** (a Zincro-style memory system, Phase 1):

- **Invariants `N1–N7`** — `.claude/rules/hard-rules.md` (`@`-included below, always loaded): scope guard, live-tree, token styling, data-layer isolation, file size, theme/FOUC, English-only.
- **Philosophy** — `docs/PHILOSOPHY.md` (5 tenets + voice).
- **Heuristics** — `docs/HEURISTICS.md` (`H-NNN` gotchas: per-ISSN tags, OpenAlex flags, FOUC, scope divergence…).
- **Anti-patterns** — `docs/ANTI_PATTERNS.md` (the never-do list).
- **Subsystem guides** (on-demand, not auto-loaded — read when touching the area): `ls .claude/rules/` — `scope-model`, `db-layer`, `design-dna`, `theme`, `claustro-feature`, and the **DGA** set: `governor-patterns` (doctrine), `dga` (layout/wiring), `id-taxonomy`, `cross-stack-naming`, `app-conventions`.
- **DGA** — the backend is migrating to a Deterministic Governor Architecture (domain-owned Governors/Validators/Resolvers/Composers/Workflows/Dispatchers over a typed EventBus; tenant isolation → Postgres RLS). The domain model (which governors exist, what they own) is `docs/DGA_DESIGN.md`. Migration is additive, one domain at a time; handlers stay thin and delegate to compiled governors in `apps/api/dist/`.

@.claude/rules/hard-rules.md

## Commands

- **Dev:** `npm run dev:web` (Vite frontend, port 9000) · `npm run dev:api` (Express API, :3000)
- **Build web:** `npm run build:web` (Vite → `apps/web/dist`) · **Start API:** `npm run start:api`
- **No test suite configured.**

## Architecture

Nexus is a DOI metadata aggregator and multi-tenant CRIS for universities. Users submit DOIs (or bulk-import an institution by ROR); the system fetches metadata from four scholarly APIs (CrossRef, OpenAlex, Semantic Scholar, DataCite), normalizes/merges, stores it scope-isolated in PostgreSQL, and renders graph + chart views. UTalca is the first tenant.

**Monorepo (npm workspaces).** The live, deployed tree is two apps; root `api/`, `lib/`, `public/`, `legacy/` are **dead pre-monorepo leftovers — never edit** (invariant N2).

- **Backend — `apps/api/`** (Express on Railway). `index.js` auto-mounts each `handlers/*.js` (Vercel-shaped `(req,res)=>…`) at `/api/<name>`. Postgres via `pg` Pool + the local `src/lib/sql.js` wrapper (not `@vercel/postgres`). Shared libs in `src/lib/` (`db*.js`, `scope.js`, `auth.js`, `claustro.js`…). Migrations in `src/db/migrations/NNN_*.sql`, applied on boot by `runMigrations()`. See `.claude/rules/db-layer.md`, `scope-model.md`.
- **Frontend — `apps/web/`** (Vite). HTML pages + JS/TSX in `public/`; build → `dist/`, served by **Caddy** (static + SPA fallback; Express serves only `/api`, see `Caddyfile`). Design tokens in `public/dna.css` (scales) + `public/shared.css` (palette). See `.claude/rules/design-dna.md`, `theme.md`.
- **Database** — PostgreSQL (Railway). Core tables: `doi_records`, `tags`, `submissions`, `users`, `tenants`, `theme_tokens`, `projects`. All tenant-scoped via `tenant_id`; every read passes through `requireScope` (N1).

⚠️ `ARCHITECTURE.md` and `lib/README.md` still cite the old root `lib/`/`api/` paths — the **concepts** (scope model, roles, auth flow) are accurate, the **paths** are stale; trust `.claude/rules/scope-model.md` for current paths.

## Project Rules

### Pre-commit audit (`scripts/arch-audit.sh`)

The pre-commit hook (`hooks/pre-commit-audit.sh` → `scripts/arch-audit.sh`) enforces the invariants. **Hard-blocks:** N2 dead-tree edits, N4 data-layer leaks, **N5/nbr15** source files >150 lines. **Soft-warns:** N1, N3. Opt-out per file with `arch-audit-ignore: <Nx>`. Run manually: `bash scripts/arch-audit.sh`. On a fresh clone install it: `cp hooks/pre-commit-audit.sh .git/hooks/pre-commit`.

**On N5 (file size):** fires at commit time only — write code at whatever size it naturally wants, and refactor only when the hook complains or the seam is real.

**When the hook fires, refactor — extract a cohesive chunk into a new file and import it back.** Never compress: don't collapse multi-line `useMemo` / `useEffect` / `if` blocks into one-liners, don't strip comments or whitespace, don't inline things that were intentionally expanded. The rule exists to force real refactoring; making the code denser defeats its purpose.

### Deploy policy

After every task, commit and push to `main`. **Railway** auto-deploys both services from `main` — `Nexus` (API) and `Nexus-Web` (Caddy static). `dist/` is gitignored; Railway builds the web app from source. Do not ask first. Still ask before destructive git ops (force push, reset --hard, branch deletion).

### Vendored chart engine (synced from Zincro)

The chart **graph-engine is vendored from Zincro** (`git@github.com:BenMerino/Sincro.git`, authoritative source under `packages/shared/src/`). Don't hand-edit the boundary for engine logic — fix it in Zincro and sync down.

- **To pull the latest engine:** `bash scripts/sync-engine.sh --apply` (default is a dry-run report; `--check` exits non-zero if drifted, for CI/pre-push). It fetches Zincro at `$ZINCRO_REF` (default `origin/main`; `$ZINCRO_ROOT` = local fast-path) into gitignored `.engine-src/` and **prints the resolved SHA every run** — record it in the sync commit.
- **Boundary (Zincro → nexus):** `ui/graph-engine/`, `ui/visual-lang/` are **full mirrors**; `ui/composed/`, `ui/primitives/` sync **only the files nexus already vendors** (Zincro has 100s nexus doesn't want); plus the explicit architect engine-deps (`fold-atoms*`, `graph-composer.types`, `chart-kpi.types`, `graph-directive-runtime.types`, `place-atoms`, `replayable-directive`, `bucket-sequence`, `graph-features.types`). The rest of `architect/` is nexus's own forked controller layer — **not synced**.
- **App coupling = one provider.** The engine's only host hooks (`apiGet`/`useIsDark`/`useUiPref`) are injected via `EngineConfig` through `<GraphEngineProvider>`. nexus's adapter + combined mount live in `apps/web/ui/graph-engine-providers.tsx` (`GraphProviders`), applied at each chart root (`tenant.tsx`, `dashboard-charts.tsx`). Wire any new chart root the same way or the slider span / theme / toggles fall back to inert defaults.
- **Exclusions (nexus-owned, never overwritten — in `sync-engine.sh`):** `engine-visual-defaults.ts` (square corners 0/0 vs Zincro 6/3), `ChartTuningContext.tsx` (glow-0 seam + host tuning fetch — glow set via the provider, NOT by forking `chart-tuning.ts`), `index.ts` (re-exports nexus's `DirectiveChart`), `__tests__/`. Also kept (no Zincro counterpart): `DirectiveChart.tsx`, `chart-trace.ts`, the `apps/web/architect/` controller fork.
- **Flow-UP debt:** `ChartChromeLayer.tsx` carries a nexus `fmtTick` thousands fix (`2403→2,403`) Zincro lacks — currently excluded so `--check` is green. Push it to Zincro, then remove its exclusion line so it syncs clean.
