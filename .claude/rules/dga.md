# DGA Layout & Mechanics

How the Deterministic Governor Architecture is physically organized in `apps/api`. The *doctrine* (roles, one-writer invariant, evolve-by-addition) is in [governor-patterns.md](governor-patterns.md); the *domain model* (which governors exist) is in [docs/DGA_DESIGN.md](../../docs/DGA_DESIGN.md). This file is the **wiring**.

## Where things live
- `apps/api/src/services/` — the DGA. Core: `BaseGovernor.ts`, `EventBus.ts`, `GovernorPorts.ts`, `role-contracts.ts`. Per domain: `services/{context}/` holding `{Domain}Governor.ts`, `{Domain}Logic.ts`, `{Domain}Actions.ts`, `{Domain}ResolverTools.ts`, `{Domain}Workflow.ts`, `{Domain}Validator.ts`, `{Domain}Types.ts` as needed.
- `apps/api/src/substrate/` — NOT the DGA. `actor.ts` (`ActorContext` — the acting identity), and the tenancy boundary (`withTenant` lives in `src/db/index.js`). The DGA consumes these; it does not govern them.
- `apps/api/src/lib/` — the existing data layer (`db-*.js`, `sql.js`). Governors import these repos; they are migrated, not rewritten wholesale ([db-layer.md](db-layer.md)).

## TypeScript + build (Phase 1)
- `services/` and `substrate/` are **TypeScript**, compiled by `tsc` to `apps/api/dist/` as CommonJS. Legacy JS (`lib/`, `handlers/`, `index.js`) stays CJS and `require()`s the compiled governors from `dist/`.
- Handlers coexist: not-yet-migrated `handlers/*.js` mount as today; a migrated handler delegates to `require("../dist/services/...")`. Route URLs never change on migration.

## The write path (every governor method)
1. Handler gates (`requireScope`/`requireEditor`) → builds `ActorContext` via `actorContext(req)`.
2. Governor validates (pure `{Domain}Logic`), then writes inside ONE `withTenant(ctx.tenantId, async (client) => …)` tx, threading `tx = {client, tenantId}` to repo fns (use `runOn` for nestable repos).
3. Emits its `domain.action` event **after the tx commits**.
4. Cross-aggregate reactions listen on the bus; only a Workflow calls governors directly.

## Bootstrap order (Phase 3, in `index.js` after mountHandlers)
`BaseGovernor.configure({ ledger })` → `scanActions()` → import `conversation-bindings` → `scanResolvers()`. Order matters.

## Size & naming
- N5 (nbr15, 150-line cap) applies to `apps/api/**/*.ts` — extract `{Domain}Logic.ts` before a governor grows past it; per-file `arch-audit-ignore: N5` only as a sanctioned exception.
- Names follow [cross-stack-naming.md](cross-stack-naming.md): the domain noun matches governor, events, entity-ref, and conversation kind.
