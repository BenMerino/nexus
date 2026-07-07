# Philosophy: How Nexus is built

> **Mission**: A multi-tenant CRIS (current research information system) for universities. Users submit DOIs or bulk-import an institution by ROR; Nexus fetches metadata from four scholarly APIs (CrossRef, OpenAlex, Semantic Scholar, DataCite), normalizes and merges it, stores it scope-isolated in PostgreSQL, and renders graph + chart views. UTalca is the first tenant.

Adapted from Zincro's doctrine, sized to Nexus. We took the *structure* (named invariants + on-demand subsystem rules + a heuristics manifest) and the *spirit* (determinism, isolation, token-sourced visuals). Nexus is now **adopting Zincro's Deterministic Governor Architecture (DGA) in spirit** — domain-owned Governors, Validators, Resolvers, Composers, Workflows, and Dispatchers coordinating over a typed EventBus, with tenant isolation moving to Postgres RLS. We adapt rather than carbon-copy: integer tenant ids (not ULIDs), Nexus's own domain nouns, no CLI/multi-app surface. The doctrine lives in `.claude/rules/governor-patterns.md`; the concrete domain/governor/event names in `docs/DGA_DESIGN.md`. The legacy Express-handlers-over-`lib/` layer is migrated one domain at a time, additively — handlers stay thin and delegate to compiled governors.

## 1. Scope is sovereign
A tenant's data is its territory, and a personal-scope researcher sees only their own slice. The only "fatal error" Nexus recognizes is **cross-scope leakage**. Every endpoint that reads data passes through `requireScope`; every write through `requireEditor`/`requireRole`. The scope object — not an ad-hoc `WHERE` clause — is what narrows data. See **N1** in `.claude/rules/hard-rules.md`.

## 2. One live tree
The deployed code is `apps/api/` (Express on Railway) + `apps/web/` (Vite). The root `api/`, `lib/`, `public/` directories are **dead pre-monorepo leftovers** — git-tracked, uploaded, never executed. Editing them ships nothing. This is the most expensive mistake in this repo's history (a whole feature was "shipped" into the dead tree). See **N2**.

## 3. Deterministic ingestion
The merge pipeline (4 sources → normalize → tags) must be predictable and lossless. Two rules earned in blood: **prefer one canonical source over many feeds** (OpenAlex already exposes WoS/DOAJ/SciELO indexation flags — don't build three seeders), and **never normalize an external ID to a single form** (store one journal tag per ISSN; lookups must match whichever ISSN a source uses). See `docs/HEURISTICS.md` H-002, H-003.

## 4. Tokens are the source of truth for visuals
Color, spacing, radius, and motion come from the design-DNA token system (`apps/web/public/dna.css` for scales, `shared.css` `:root` for the palette). No per-chart hex, no invented `--chart-N` variables. Fix visual issues at the token layer, not the call site. See **N3** and the DNA roadmap (`dna-design-system`).

## 5. Memory travels with the code
Invariants and hard-won gotchas live **in the repo** (`docs/`, `.claude/rules/`), not only in per-user agent memory — so they survive a new machine, a new contributor, and audit enforcement. When a doc goes stale (e.g. CLAUDE.md still describing the old Vercel tree), flag it; don't trust it silently.

## Voice
Direct and technical. If a quick fix violates an invariant (scope bypass, dead-tree edit, hardcoded hex, fat handler), say so and offer the compliant path — don't quietly comply. Surface the foundational issue before patching the symptom.
