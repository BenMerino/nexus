# Governor Patterns (DGA)

Nexus's backend is migrating to a **Deterministic Governor Architecture (DGA)**, adapted in spirit from Zincro — not carbon-copied. This rule is the doctrine; the concrete domain/governor/event names live in [docs/DGA_DESIGN.md](../../docs/DGA_DESIGN.md). Applies to `apps/api/src/services/**`.

## DGA Taxonomy (6 roles)
| Role | Contract |
|------|----------|
| **Governor** | Owns one aggregate. CRUD. Emits events. The only role that writes. Extends `BaseGovernor`. |
| **Validator** | Pure decision logic. Reads any Governor. No writes, no events. |
| **Resolver** | Stateless compound reads. May cache, invalidating on events. No writes. |
| **Composer** | Assembles UI directives (chart/table `GraphDirective`s) from reads. No writes. |
| **Workflow** | Orchestrates a multi-Governor sequence. The only role that calls Governors directly. |
| **Dispatcher** | Delivers to external systems (the 4 scholarly APIs, email). Side effects expected. |

## Aggregate boundaries — the actual invariant
"Governors never call each other" is a *consequence*, not the root. The root is **one writer per aggregate, with self-contained atomic transactions** (one `withTenant` block per write). Cross-aggregate effects travel by **event**, so each aggregate's writes stay single-sourced. Two corollaries:
- **Same aggregate → one module, one tx.** Concerns that must commit together share one Governor + one `withTenant` block; they do not become two Governors calling each other.
- **True cross-aggregate orchestration → a Workflow.** The only sanctioned place for direct, synchronous Governor-to-Governor calls. Nexus has exactly two: `IngestionWorkflow` and `RosterWorkflow`.

## DGA protocol (per write)
1. Handler resolves scope (`requireScope`/`requireEditor`) → builds `ActorContext` (`actorContext(req)`).
2. Governor runs deterministic logic (pure fns in `{Domain}Logic.ts`).
3. Persists via the `lib/` repo functions inside a single `withTenant(tenantId, fn)` tx, threading `tx = {client, tenantId}` (use `runOn` for nestable repos).
4. Emits its `domain.action` event **after the tx commits** — consumers must never see uncommitted state.

## BaseGovernor
- Every Governor extends `BaseGovernor` (`apps/api/src/services/BaseGovernor.ts`).
- `BaseGovernor.configure({ ledger })` is called once at bootstrap, before any governor emits/logs.
- Methods: `emitEvent<K>(event, payload)`, `logToLedger(tenantId, entityId, action, userId, context?)`.
- The circular dep (governor → ledger → governor) is broken via the `AuditPort` interface in `GovernorPorts.ts`.

## EventBus
- Typed via `GovernorEventMap` in `apps/api/src/services/EventBus.ts`. Channel naming: `<domain>.<action>` — lowercase domain, camelCase action (`catalog.recordUpserted`, `ingestion.completed`).
- **One owner per channel.** Exactly one file emits any given channel (`CatalogGovernor` emits `catalog.*`).
- Governors coordinate via the bus, not direct calls (except inside a Workflow). Synchronous, in-process.

## Event sourcing is a targeted choice, not a default
Nexus has no event-sourced aggregate today, and shouldn't add one by default. Reach for it only if a change-history is itself a deliverable. `doi_records` etc. are plain state-with-cache.

## Evolve by addition (grandfather the old)
Migrate one domain at a time, **additive only, callers untouched**. Repoint a handler to call the new compiled Governor; keep the route URL identical; remove the legacy `lib/` path only after every caller moves, in a separate pass. Never a big-bang rewrite. A schema change is a *new* numbered migration (never an inline `ALTER`).

## Naming & size
- PascalCase = class/manifest files (`CatalogGovernor.ts`, `CatalogActions.ts`). kebab/camel = `{Domain}Logic.ts` helpers.
- Every Governor write method gets a companion `{Domain}Actions.ts` manifest, auto-discovered at startup.
- **N5 (nbr15) applies to `apps/api/**/*.ts`** (only `apps/web/{ui,architect,…}` are exempt) — Governors stay ≤150 lines; extract `{Domain}Logic.ts` when they grow. Per-file opt-out: `arch-audit-ignore: N5`.
