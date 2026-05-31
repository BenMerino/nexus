# DGA Design — Nexus domains, governors, events, refs

The canonical names/functions/domains plan for Nexus's Deterministic Governor Architecture. Every later phase keys off this doc. Doctrine: [.claude/rules/governor-patterns.md](../.claude/rules/governor-patterns.md). Adapted in spirit from Zincro — integer tenant ids, Nexus domain nouns, no CLI/multi-app surface.

Tables (14): `tenants`, `users`, `submissions`, `doi_records`, `tags`, `tag_synonyms`, `tag_dismissed_pairs`, `doi_citations_by_year`, `doi_concepts`, `indexed_journals`, `projects`, `project_investigators`, `settings`/`theme_tokens`.

## Domain noun canon

| Domain noun | Dir | Aggregate (tables owned) | Roles | Phase |
|---|---|---|---|---|
| `tag` | `services/tag/` | `tags`, `tag_synonyms`, `tag_dismissed_pairs` | Governor + Resolver | 4 |
| `record` | `services/record/` | `doi_records`, `doi_citations_by_year`, `doi_concepts` | Governor + Resolver | 5 |
| `submission` | `services/submission/` | `submissions` | Governor | 6 |
| `ingestion` | `services/ingestion/` | — (orchestrates) | **Workflow** + Validator | 6 |
| `portfolio` | `services/portfolio/` | (cache only) | Governor(cache) + Resolvers + Composer | 7 |
| `user` | `services/user/` | `users` | Governor | 8 |
| `tenant` | `services/tenant/` | `tenants`, `settings`/`theme_tokens` | Governor | 8 |
| `roster` | `services/roster/` | — (orchestrates) | **Workflow** + Validator | 8 |
| `project` | `services/project/` | `projects`, `project_investigators` | Governor + Resolver | 9 |
| `graph` | `services/graph/` | — (read) | Resolver | 9 |
| `architect` | `services/architect/` | — (read/compose) | Composer | 9 |
| `public` | `services/public/` | — (read, tenant-by-slug) | Resolver | 9 |
| `file` | `services/file/` | — (object storage) | **Dispatcher** | 9 |
| `indexation` | `services/indexation/` | `indexed_journals` | Governor | 9 |

`auth`/`sessions` stays as `lib/auth.js` (HMAC cookie) — the identity source, not governor-ized beyond `user`.

## Governors (sole writer per aggregate) — methods & events

- **TagGovernor** (`tag`): `merge(ctx, fromId, intoId)`, `addSynonym(ctx, …)`, `dismissPair(ctx, a, b)`. Events: `tag.merged`, `tag.synonymAdded`, `tag.dismissed`. Logic ← `normalize-tags`, `synonym-candidates`, `synonym-handlers`, `journal-canon`.
- **RecordGovernor** (`record`): `upsert(ctx, record)`, `delete(ctx, id)`, `setCitationsByYear`, `setConcepts`. Events: `record.upserted`, `record.deleted`. Logic ← `db.js:upsertRecord`, `db-portfolio`, `normalize*`.
- **SubmissionGovernor** (`submission`): `create(ctx, doi, source)`, `markStatus(ctx, id, status)`. Events: `submission.created`, `submission.statusChanged`. Logic ← `store.js`, `db.js`.
- **PortfolioGovernor** (`portfolio`, cache only): `rebuild(ctx, orcid)`. Event: `portfolio.rebuilt`. Logic ← `portfolio-backfill`.
- **UserGovernor** (`user`): `upsert(ctx, user)`, `setOrcid`, `grantTenantAdmin`. Events: `user.created`, `user.orcidMatched`, `tenantAdmin.granted`. Logic ← `db-users`, `seed-users`. **Cross-tenant — no RLS.**
- **TenantGovernor** (`tenant`): `create`, `updateSettings`, `setTheme`. Events: `tenant.created`, `tenant.settingsChanged`. **Cross-tenant — no RLS.**
- **ProjectGovernor** (`project`): `create`, `update`, `delete`, `setInvestigators`. Events: `project.created`, `project.updated`, `project.deleted`. Logic ← `db-projects`, `claustro`.
- **IndexationGovernor** (`indexation`): `upsertJournalFlags(ctx, …)`. Event: `indexation.updated`. Logic ← `indexation-*`, `indexed-*`, `indexed-journals`.

## Workflows (only role that calls governors directly)
- **IngestionWorkflow** (`ingestion`): `submitDoi(ctx, doi)`, `refetchAll(ctx)`, `backfill*(ctx)`. Per-DOI `withTenant` (one bad DOI doesn't roll back a batch). Orchestrates `SubmissionGovernor` → fetch (4 sources via the fetch Dispatcher / `fetchers`) → normalize (`normalize*`) → `RecordGovernor` → `TagGovernor` → `IndexationGovernor`. Emits `ingestion.completed`. Replaces `store.js:fetchAndStore`.
- **RosterWorkflow** (`roster`): `importRoster(ctx, csv)`, `resolveOrcids(ctx)`. Orchestrates `UserGovernor` + `TenantGovernor`, then calls `IngestionWorkflow` per resolved ORCID. Emits `roster.imported`. Logic ← `roster-import`, `roster-ingest`, `roster-resolve`, `ror-resolve`.

## Validators (pure decision logic — only where real)
- **IngestionValidator**: DOI shape/dedupe precondition. **RosterValidator**: CSV row + ORCID format. No others (most domains validate inline).

## Resolvers (compound reads; `chartable`/`tableable` flags feed the Composer + Phase C)
- **TagFacetsResolverTools** (`tag`): authors/journals/institutions/venues facets; preserve `isPersonalScope` branch from `db.js:getAllTags`.
- **RecordResolverTools** (`record`): record lookups, node-detail. ← `node-detail-*`, `author-detail`, `institution-detail`.
- **PortfolioResolverTools / VelocityResolverTools / CoauthorResolverTools** (`portfolio`): `chartable: true` + `vizHint` for velocity/cadence/concepts/top-cited (backend handoff to Phase C). ← `portfolio*`, `h-index`, `dashboard-stats`.
- **GraphResolverTools** (`graph`): graph build, org-tree. ← `graph-builder`, `graph-meta`, `org-tree`. CoAuthorGraph stays non-cartesian.
- **ProjectResolverTools** (`project`), **PublicResolverTools** (`public`): public reads wrap `withTenant(tenantIdForSlug, …)`.

## Composer
- **ArchitectComposer** (`architect`): generalize `architect-replay.js` from hardcoded `kind:"publications"` to a `kind → atom-builder` registry so portfolios/tags/concepts add replay kinds. Emits `GraphDirective` (see `apps/web/architect/graph-composer.types.ts`).

## Dispatchers (external side effects)
- **FileDispatcher** (`file`): object-storage presign (`storage.js`) — never streams bytes, mints URLs.
- **FetchDispatcher** (used by IngestionWorkflow): the 4 scholarly APIs (`fetchers`, `openalex`, `fetchers-institution`). Side effects = outbound HTTP.

## Entity refs (`<kind>:<id>`, for audit + conversation-bindings)
`record:<id>`, `submission:<id>`, `tag:<id>`, `project:<id>`, `user:<orcidOrId>`, `tenant:<id>`, `journal:<issn_l>`; child rows: `concept:<recordId>:<conceptId>`, `citationYear:<recordId>:<year>`. Grammar canon: [id-taxonomy](../.claude/rules/id-taxonomy.md).

## Conversation entity-kinds (AI surface, when chat lands)
`record`, `project`, `tag`, `user` register `verifyAccess` + `readSummary`. Others read-only/none.

## Handler → domain map (route URLs unchanged on migration)
`tag-stats`,`claim-paper`→tag · `records`,`records/[id]`,`node-detail`,`graph-metadata`→record · `submit`,`submissions`,`refetch-all`,`backfill-*`,`venue-type-backfill`,`indexation`→ingestion · `portfolio`,`portfolio-backfill`,`dashboard`→portfolio · `roster-actions`,`author-import`,`search-academics`→roster · `projects`,`claustro`→project · `graph`→graph · `architect/*`→architect · `public/[slug]/*`→public · `files`→file · `search`→record/tag resolver · `theme-tokens`→tenant · `auth`→(unchanged).
