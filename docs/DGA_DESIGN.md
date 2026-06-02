# DGA Design — Nexus domains, governors, events, refs

The canonical domain model for Nexus's Deterministic Governor Architecture. **Domain-first**: bounded contexts derived from the CRIS mission, then tables mapped under them (schema is malleable). Produced by a multi-lens decomposition → adversarial stress-test → iterative reasoning against the one-writer invariant, verified against the live `apps/api` tree. Doctrine: [.claude/rules/governor-patterns.md](../.claude/rules/governor-patterns.md).

**The decision rule, applied throughout:** a **Governor** exists only for an aggregate that *something writes independently of the papers it appears on*. Entities with real identity + their own lifecycle (claim/merge/admin-edit) are governed; write-once-at-ingest connections are **edges** owned by the entity they hang off; pure reads are Resolvers/Composers; cross-aggregate orchestration is a Workflow; outbound effects are a Dispatcher. The **actor** (user) and the **scope boundary** (tenant) are **substrate**, not domains.

This model is the product of deliberately dissolving startup shortcuts: the generic `tags` EAV table (it was *ingestion's edge output*, not a domain), `IndexationReference` (a *property of a venue*), the affiliation-institution-as-entity (an *edge value*), and `User`/`Tenant`-as-domains (the *actor* and *boundary* — substrate). What remains is subject-matter only.

---

## Scholarship context — the scholarly record

| Domain | Role | Owns | Key actions | Emits |
|---|---|---|---|---|
| **Publication** (`publication`, in `services/catalog/`) | Governor | the paper (DOI) + `submissions` (immutable receipt) + `doi_citations_by_year` + `doi_concepts` + the **authorship / published-in / affiliation edges** (written once at ingest, no independent lifecycle → children of the publication) | `upsert`, `delete`, `setCitations`, `setConcepts`, `linkAuthorship`, `linkVenue`, `linkAffiliation` | `publication.upserted`, `publication.deleted` |
| **Author** (`author`) | Governor | researcher entity keyed by **ORCID** + academic profile fields (faculty/position/titles/grado) | `upsert`, `merge` (entity resolution), `claim` (bind to a substrate user) | `author.upserted`, `author.merged`, `author.claimed` |
| **Venue** (`venue`) | Governor | journal/venue keyed by **ISSN-L** + indexation flags (WoS/Scopus/DOAJ/SciELO — *a property of the venue*) | `upsert`, `merge`, `setIndexation(source, …)` | `venue.upserted`, `venue.indexationUpdated` |

**Naming note:** the governor is `PublicationGovernor` (named for its aggregate root, like its Author/Venue/Project siblings), living in the `catalog` *context folder*. It owns the publication **and its edges** because those edges are write-once-at-ingest children with no life of their own — not a separate "links" aggregate. The affiliation edge carries the foreign-institution value (ROR+name); the affiliation-institution is **not** a governed entity (Nexus doesn't manage MIT) — only the managed institution (below) is.

## Institution context — the managed organization (the tenant, promoted to a domain)

The university that *owns* a Nexus tenant is not just the `withTenant` scope boundary — it is an organization that **acts**: it provisions members, approves projects, monetizes output, and reports. That gives it an independent write lifecycle → a real domain. (The scope boundary itself stays substrate; this is the *organizational* half.)

| Domain | Role | Owns | Key actions | Emits |
|---|---|---|---|---|
| **Institution** (`institution`) | Governor | the managed org: identity/tree (ROR/slug/parent), members & secretary roles, org policy, config (theme/settings `tenant.*`) | `provision`, `setPolicy`, `assignRole`, `setTheme`, `updateSettings` | `institution.provisioned`, `institution.policyChanged` |
| **Project** (`project`) | Governor | `projects` + `project_investigators` (child, wholesale-replaced) + **approval state** | `create`, `update`, `delete`, `setInvestigators`, `approve`, `reject` | `project.created`, `project.updated`, `project.approved` |
| **Monetization** (`monetization`) `[PLANNED]` | Governor | reward record (academic × paper × amount; accrue→approve→pay) | `accrue`, `approve`, `pay` | `monetization.*` |

## Orchestration — Workflows (the only role that calls governors directly; own no table)

| Domain | Role | Orchestrates |
|---|---|---|
| **Ingestion** (`ingestion`) | Workflow | MetadataProviders (4 APIs) → resolve Author/Venue (upsert by ORCID/ISSN) → PublicationGovernor (paper + edges). **Per-DOI `withTenant`** (one bad DOI never rolls back a batch). Two entrypoints, identical write shape: `store.js#fetchAndStore`, `store-openalex.js#storeNormalizedRecord`. Emits `ingestion.completed`. |
| **Onboarding** (`onboarding`) | Workflow | Institution.provision + members → resolve ORCIDs → Ingestion per author. Emits `roster.imported`. ← `roster-import`, `roster-ingest`, `roster-resolve`, `seed-users`. |
| **Approval** (`approval`) `[PLANNED]` | Workflow | secretary acts (role check via substrate) → Project.approve/reject |

## Read & external — Resolvers / Composer / Dispatcher (own no table)

| Domain | Role | Reads | Job |
|---|---|---|---|
| **Statistician** (`statistician`) | Resolver | Publication + Author + Venue | bibliometric stats: velocity, cadence, h-index, top-cited, concept profile, coauthor graph, org-tree (pure scope-narrowed SELECT). Emits **chartable** `{data, vizHint}` for the Composer. ← `portfolio*`, `h-index`, `dashboard-stats`, `graph-builder`, `org-tree` |
| **Claustro** (`claustro`) | Resolver | Author × Venue(indexation) × Project | CNA core-faculty accreditation; only write is its `claustro.indices.*` config key. ← `claustro.js`, `db-schema-claustro.js` |
| **Reports** (`reports`) `[PLANNED]` | Resolver/Composer | Institution + Project + Publication | automatic institutional reports |
| **Architect** (`architect`) | Composer | the resolvers | **The single chart-invocation seam.** Nexus has **no AI** — so, unlike Zincro, there is **no shape auto-detection / intent inference** (that machinery exists only to guess a chart type from an AI's unpredictable output). Nexus charts come from known code paths with known shapes, so the foundational mechanism is an **explicit chart registry**: `kind → compose(data) → GraphDirective` (generalize `architect-replay.js` beyond `publications`; e.g. `velocity`→line, `cadence`→stacked-bar, `publications`→bar). A resolver returns `{kind, data}`; the registry's compose fn for that `kind` builds the directive deterministically (enrich = colors/thresholds/labels). Frontend just `GraphRender`s it — **no per-chart `buildXChart` scattered in panels**. Also node-detail + unauthenticated public profiles (`withTenant(tenantBySlug)`). |
| **MetadataProviders** (`metadataProviders`) | Dispatcher | — | CrossRef/OpenAlex/SemanticScholar/DataCite + ROR resolution + object-storage presign. Outbound HTTP only. ← `fetchers`, `fetchers-institution`, `openalex`, `ror-resolve`, `storage` |

## Substrate — NOT the DGA (the layer it runs on)
- **Identity / ActorContext** — `lib/auth.js` + `scope.js`: the **user** (the *actor*, threaded as `ctx`), session, login, role. Every governor *consumes* it; none govern it. The DGA introduces **no parallel auth**.
- **Tenancy boundary** — `withTenant` / RLS `app.tenant_id`: the scope every governor runs inside. (The *organizational* half of the tenant is the **Institution** governor; the *boundary* half is substrate.)

---

## Tally
**Built now: 5 Governors** (Publication, Author, Venue, Institution, Project) · **2 Workflows** (Ingestion, Onboarding) · **2 Resolvers** (Statistician, Claustro) · **1 Composer** (Architect — the chart-invocation seam) · **1 Dispatcher** (MetadataProviders).

> **Sole-writer realized (2026-06-02).** The §35 ingest shape is now true in code: `IngestionWorkflow` calls `AuthorGovernor.upsertFromTags` / `VenueGovernor.upsertFromTags` / `InstitutionGovernor.upsertFromTags` (each the sole writer of its own table) → `PublicationGovernor.upsertRow`+`linkEdges` (paper row + edge tables only, linking entities by natural key orcid/name_key/ror) → `VenueGovernor.applyRecordFlags`. Earlier `PublicationGovernor.upsert` wrote the authors/venues/institutions tables itself (a one-writer violation from the behavior-neutral §1 wrap of `syncRecordEntities`); that's closed — the repo split lives in `db-entities.js` (`upsertAuthors`/`upsertInstitutions`/`linkRecordEdges`) + `db-venues-sync.js` (`upsertVenues`/`venuePublishedIn`/`applyRecordVenueFlags`). **Event restraint:** ingest-time entity upserts are quiet (no per-row `author.upserted` × N with no listeners); `publication.upserted`+`ingestion.completed` mark the change. Entity governors still emit on standalone writes (claim/merge). **Remaining §35 deviation:** the per-DOI `withTenant` atomicity is NOT yet in — ingest stays on the plain `sql` pool (pairs with the RLS track); the decomposition above is ownership-only, behavior-neutral (diff-gate `scripts/verify-governor-wrap.js`).

> **Chart invocation (Nexus, AI-less):** charts are NOT hand-built per panel, and there is NO shape auto-detection (Nexus has no AI to guess shapes for). The seam is an **explicit chart registry** — `kind → compose(data) → GraphDirective` — generalizing `architect-replay.js`. A resolver returns `{kind, data}`; the registry builds the directive; the frontend `GraphRender`s it. The current frontend `build{Velocity,Cadence,YearlyBar}Chart` helpers are the **transitional, inline form** of exactly these registry compose-fns; they move into the backend registry when the Statistician resolver lands, so the dashboard and public profiles share one server-side path.
**`[PLANNED]` additive** (designed-for, **not built** until specced — evolve-by-addition): Monetization (Gov), Approval (Workflow), Reports (Resolver), all under the Institution context.

## Schema changes implied (authorized; new numbered migrations)
1. **Rename `doi_records` → `publications`** (the aggregate root is a paper).
2. **Promote entities:** new `authors` (PK ORCID), `venues` (PK ISSN-L) tables; **migrate** existing `tags` rows into these + into explicit **edge tables** `authorship` / `published_in` / `affiliation`. Dissolve the generic `tags` table. Venue absorbs `indexed_journals` indexation flags; the derived per-record `indexed_in` becomes a join over edges + venue flags (no separate projection table needed once edges exist).
3. **Entity resolution replaces synonyms:** `tag_synonyms`/`tag_dismissed_pairs` → `AuthorGovernor.merge` / `VenueGovernor.merge` / `InstitutionGovernor`-style merge state, applied at write time (not folded at read).
4. **Namespace `settings`:** `tenant.*` → Institution, `claustro.indices.*` → Claustro config.
> ⚠️ This is the **largest, highest-risk migration in the repo** — `tags` underpins the graph engine, every facet chart, profiles, and coauthor analysis. Sequenced carefully, gated, and verified per-step (not rushed).

## EventBus catalog (seed)
`publication.upserted/deleted`, `author.upserted/merged/claimed`, `venue.upserted/indexationUpdated`, `institution.provisioned/policyChanged`, `project.created/updated/approved`, `ingestion.completed`, `roster.imported`. One owner per channel.

## Entity refs (`<kind>:<id>`, for audit + conversation-bindings)
`publication:<id>`, `author:<orcid>`, `venue:<issnL>`, `institution:<ror>`, `project:<id>`; child/edge: `concept:<pubId>:<conceptId>`, `citationYear:<pubId>:<year>`, `authorship:<pubId>:<orcid>`. Grammar canon: [id-taxonomy](../.claude/rules/id-taxonomy.md).

## Conversation entity-kinds (AI surface, when chat lands)
`publication`, `author`, `venue`, `project`, `institution` register `verifyAccess` + `readSummary`.

## Handler → domain map (route URLs unchanged on migration)
`tag-stats`,`search`→statistician/author/venue resolvers · `claim-paper`→author(claim)+publication · `records`,`records/[id]`,`node-detail`,`graph-metadata`→publication · `submit`,`submissions`,`refetch-all`,`backfill-*`,`venue-type-backfill`,`indexation`→ingestion/venue · `portfolio`,`portfolio-backfill`,`dashboard`,`graph`→statistician · `roster-actions`,`author-import`,`search-academics`→onboarding · `projects`→project · `claustro`→claustro · `architect/*`,`public/[slug]/*`→architect · `files`→metadataProviders · `theme-tokens`→institution · `auth`→substrate (unchanged).
