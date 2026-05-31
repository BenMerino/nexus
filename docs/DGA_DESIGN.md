# DGA Design — Nexus domains, governors, events, refs

The canonical domain model for Nexus's Deterministic Governor Architecture. **Domain-first**: bounded contexts derived from the CRIS mission, then tables mapped under them (schema is malleable). Produced by a 4-lens decomposition → reconciliation → adversarial stress-test against the one-writer invariant, verified against the live `apps/api` tree. Doctrine: [.claude/rules/governor-patterns.md](../.claude/rules/governor-patterns.md).

**12 domains:** 6 write-aggregate Governors · 2 Workflows · 2 Resolvers · 1 Composer · 1 Dispatcher.

The decision rule throughout: a **Governor** exists only for an aggregate with an **independent write lifecycle**. Derived state is not an aggregate (→ Resolver/projection). Pure reads → Resolver/Composer. Cross-aggregate orchestration → Workflow. Outbound side effects → Dispatcher.

## Governors (sole writer per aggregate)

| Governor | Domain | Owns | Tables |
|---|---|---|---|
| **CatalogGovernor** | `catalog` | The canonical scholarly paper + everything re-derived from one fetch+merge (facets, citations, concepts) + the immutable submission receipt. Aggregate root = the paper (by DOI), **not** the submission. | `doi_records` *(rename → `publications`)*, `submissions` *(immutable owned receipt)*, `tags` WHERE category≠`indexed_in`, `doi_citations_by_year`, `doi_concepts`, **`record_indexation`** *(new derived projection — see Schema changes)* |
| **TagCurationGovernor** | `tagCuration` | Editorial entity-resolution: variant→canonical synonyms (incl. ROR-resolved institutions) + dismissed merge-candidate pairs. Independent admin clock; read by Catalog at store time; mutates Catalog facets only via a `tag.merged` event. | `tag_synonyms`, `tag_dismissed_pairs` |
| **IndexationReferenceGovernor** | `indexationRef` | Admin-seeded authority list of which journals (by ISSN-L) are indexed in WoS/Scopus/DOAJ/SciELO. Replace-per-source lifecycle. Emits `indexation.updated`. | `indexed_journals` |
| **ProjectGovernor** | `project` | Funded research projects (título/financiamiento/montos/dates) + investigator roster (child, wholesale-replaced, CASCADE, soft-linked to users by value). Independent admin CRUD. Feeds the Claustro resolver but is a distinct aggregate. | `projects`, `project_investigators` |
| **UserGovernor** | `user` | Identity/authorization principals: credentials, role, `tenant_admin` capability, ORCID binding, tenant membership, roster org fields. **Cross-tenant — no-RLS read exception.** | `users` |
| **TenantGovernor** | `tenant` | Institution-as-territory: tenant tree (name/ROR/slug/parent_id/branding) + theming + `tenant.*` config keys. **Cross-tenant — no-RLS read exception.** | `tenants`, `theme_tokens` *(add `tenant_id`)*, `settings` WHERE key LIKE `tenant.%` |

## Workflows (only role that calls governors directly; own no table)
- **IngestionWorkflow** (`ingestion`): per-DOI deterministic ingest — MetadataProviders (4 APIs) → normalize/merge → `CatalogGovernor` → derive `record_indexation` from `IndexationReferenceGovernor`. Per-DOI `withTenant` (one bad DOI never rolls back a batch). **Two entrypoints, identical write shape:** `store.js#fetchAndStore` (manual/roster DOI) and `store-openalex.js#storeNormalizedRecord` (bulk OpenAlex). Emits `ingestion.completed`.
- **OnboardingWorkflow** (`onboarding`): institutional onboarding across User + Tenant + Catalog + Ingestion — roster CSV → provision users → resolve ORCIDs → per-author bulk ingest. Emits `roster.imported`. Logic ← `roster-import`, `roster-ingest`, `roster-resolve`, `ror-resolve`, `seed-users`.

## Resolvers (compound reads; own no table; `chartable`/`tableable` feed Architect + Phase C charts)
- **PortfolioResolver** (`portfolio`): researcher/tenant derived analytics — publication portfolio, citation velocity/forecast, cadence, top-cited, h-index, concept profile, coauthor graph, org tree. Pure scope-narrowed SELECT over Catalog+User. ← `portfolio*`, `h-index`, `dashboard-stats`, `graph-builder`, `org-tree`. (No PortfolioGovernor — no cache table exists; correctly rejected.)
- **ClaustroResolver** (`claustro`): CNA core-faculty accreditation classifier — core users (grado/horas) × 5yr indexed publications (Catalog) × project roles (Project), gated by accepted-indices config. Pure read (`getClaustroForTenant`, `validateProgram`). Its only write is the `claustro.indices.*` config key it parameterizes (config, not an aggregate). ← `claustro.js`, `db-schema-claustro.js`. *(This domain was missing from the first design — caught by the stress-test.)*

## Composer
- **ArchitectComposer** (`architect`): turns resolved Catalog/Portfolio data into `GraphDirective` chart/graph specs + node-detail resolutions; serves unauthenticated public-profile reads by tenant slug (wraps `withTenant(tenantBySlug)`). Generalize `architect-replay.js` from hardcoded `kind:"publications"` to a `kind → atom-builder` registry. Emits `GraphDirective` (`apps/web/architect/graph-composer.types.ts`).

## Dispatcher (external side effects; owns no local table)
- **MetadataProvidersDispatcher** (`metadataProviders`): the external anti-corruption boundary — CrossRef/OpenAlex/SemanticScholar/DataCite + ROR resolution + object-storage presign. Outbound HTTP only; hands raw payloads to normalize. ← `fetchers`, `fetchers-institution`, `openalex`, `ror-resolve`, `storage`.

## Schema changes implied (you authorized; new numbered migrations)
1. **Rename `doi_records` → `publications`** — the aggregate root is a paper, not a "DOI record." (Touches every reader; do via migration + a grandfathering pass.)
2. **Extract `tags WHERE category='indexed_in'` → `record_indexation(record_id, source)`** — `indexed_in` is *derived* state (a projection of `indexed_journals` ∩ a record's ISSN), not a Catalog facet. Rebuilt by `IndexationReferenceGovernor` on `indexation.updated` and at ingest. Leaves `tags` single-owner (Catalog).
3. **Namespace `settings` by owner** — `tenant.*` keys → Tenant; `claustro.indices.*` → Claustro config. (Shared k/v table with two writers today.)

## Cross-tenant / no-RLS exceptions
`users` and `tenants` are read cross-tenant by auth *before* scope is known (`scope.js` reads `getUserById`/`listTenants` pre-scope). Both keep their governors but **no RLS**; isolation stays in the governor + auth. All other tenant-scoped tables get RLS (per the rollout phase).

## EventBus catalog (seed)
`catalog.recordUpserted`, `catalog.recordDeleted`, `tag.merged`, `tag.synonymAdded`, `tag.dismissed`, `indexation.updated`, `project.created/updated/deleted`, `user.created`, `user.orcidMatched`, `tenantAdmin.granted`, `tenant.settingsChanged`, `ingestion.completed`, `roster.imported`. One owner per channel (the domain's governor/workflow).

## Entity refs (`<kind>:<id>`, for audit + conversation-bindings)
`publication:<id>` (was record), `submission:<id>`, `tag:<id>`, `project:<id>`, `user:<orcidOrId>`, `tenant:<id>`, `journal:<issn_l>`; child: `concept:<recordId>:<conceptId>`, `citationYear:<recordId>:<year>`, `recordIndexation:<recordId>:<source>`. Grammar canon: [id-taxonomy](../.claude/rules/id-taxonomy.md).

## Conversation entity-kinds (AI surface, when chat lands)
`publication`, `project`, `tag`, `user` register `verifyAccess` + `readSummary`. Others read-only/none.

## Handler → domain map (route URLs unchanged on migration)
`tag-stats`→catalog(facets) · `claim-paper`→catalog · `records`,`records/[id]`,`node-detail`,`graph-metadata`→catalog · `submit`,`submissions`,`refetch-all`,`backfill-*`,`venue-type-backfill`→ingestion · `indexation`→indexationRef · `portfolio`,`portfolio-backfill`,`dashboard`→portfolio · `roster-actions`,`author-import`,`search-academics`→onboarding · `projects`→project · `claustro`→claustro · `graph`→portfolio · `architect/*`→architect · `public/[slug]/*`→architect · `files`→metadataProviders · `search`→catalog/tagCuration resolver · `theme-tokens`→tenant · `auth`→(unchanged).
```
