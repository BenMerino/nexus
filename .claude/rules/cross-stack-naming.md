# Cross-Stack Naming (Nexus)

Adapted from Zincro's S20–S22. Zincro syncs API events ↔ a CLI catalog ↔ a multi-app DataType union; **Nexus has no CLI and one web app**, so only the event-ownership and domain-noun rules carry over. Keeps the API event surface and the per-domain naming aligned. Applies to `apps/api/src/services/EventBus.ts` and new domains.

## EVENT-OWNERSHIP
EventBus channels are `<domain>.<action>` — lowercase domain, camelCase action. **Exactly one file emits any given channel** (`PublicationGovernor` emits `publication.*`, never `author.*`). New events register their typed payload in `GovernorEventMap` (`apps/api/src/services/EventBus.ts`). The domain noun must match the governor name, the conversation entity-kind, and the entity-ref grammar in [id-taxonomy](id-taxonomy.md).

## DOMAIN NOUN CANON
Every domain has exactly one canonical singular noun used everywhere — dir (`services/{domain}/`), governor (`{Domain}Governor`), events (`{domain}.*`), entity-ref (`{domain}:<id>`), conversation kind. The canon list lives in [docs/DGA_DESIGN.md](../../docs/DGA_DESIGN.md) §Domain noun canon; a new domain requires a row there before any file is named.

## FILE NAMING
- PascalCase for class/manifest files: `{Domain}Governor.ts`, `{Domain}Actions.ts`, `{Domain}ResolverTools.ts`, `{Domain}Workflow.ts`, `{Domain}Validator.ts`, `{Domain}Types.ts`.
- kebab/camel for pure-logic helpers: `{domain}-logic.ts` or `{Domain}Logic.ts` (match the dir's existing choice).
- The legacy data layer keeps its `lib/db-<domain>.js` names ([db-layer](db-layer.md)); governors import those repos rather than renaming them mid-migration.

## Before naming any new file, event, or domain
Consult [docs/DGA_DESIGN.md](../../docs/DGA_DESIGN.md). The audit (N-series) enforces size + data-layer rules at commit; naming is review-enforced against the canon.
