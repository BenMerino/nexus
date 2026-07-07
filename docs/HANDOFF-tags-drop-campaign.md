# Campaign — retire `tags` (drop the EAV table) + full DGA resolution. ✅ COMPLETE 2026-06-02.

## ✅ DONE — `tags`, `tag_synonyms`, `tag_dismissed_pairs` DROPPED (migration 008, verified)
Every reader+writer migrated to the entity model (authors/venues/institutions + authorship/published_in/affiliation/affiliated_with + publications.type/is_repository + venues.in_* flags), each cluster diff-gated. DGA layer built: Statistician resolver, StatComposer (+`/api/architect/charts`), `@nexus/shared` types, AuthorGovernor.claim, entity institution-merge (replaced synonyms). Synonym/tag-manager UI retired. Migration 008 dropped the 3 tag tables; schema-creation/indexes/`db.js` tag code removed; dead files deleted (legacy graph-builder.js, institution-detail.js, node-detail-helpers.js). **Verified post-drop: tables gone (`to_regclass`=null), dashboard/graph healthy on entities.** Backup of 1.45M tag rows at `/tmp/tags-backup-20260602.json` (local) if ever needed. The `doi_records` compat VIEW was deliberately KEPT (independent of tags; ~26 readers use it — repointing to `publications` is separate future work). RLS rollout also remains future.

**As of 2026-06-02.** Companion to `HANDOFF-tags-migration.md` (Steps 0–4 + graph-builder cutover, DONE). Sequenced plan to migrate every `tags` reader/writer, wrap reads in DGA Governors/Resolvers, route stats through a backend Composer feeding the EXISTING shared render engine, and finally **DROP `tags`/`tag_synonyms`/`tag_dismissed_pairs`**. Surveyed via 5 agent passes + DB grounding + Zincro reference ([[zincro-dga-reference]]).

## ⟶ FULL-RESOLUTION decision (2026-06-02, approved): follow Zincro's shape, scoped to what Nexus needs.
**Corrected frontend reality** (I was wrong earlier that there's "no render layer" — I'd only counted `.js`, missed `.tsx`/`architect/`): **Nexus ALREADY has the unified render pipeline.** `apps/web/ui/graph-engine/GraphRender.tsx` is a universal renderer (4 family dispatchers: cartesian/radial/polar/grid; canvas marks + SVG chrome; D3; ~19 chart types, zero per-chart code). Typed `GraphDirective`/`GraphQuery` specs in `apps/web/architect/`. Builders (`chart-builders.ts`/`dashboard-builders.ts`/`tenant-builders.ts`) already emit those specs = the Composer seed. Replay/atom loop exists (`architect-replay.js` + `/api/architect/recompose`, but only `kind:'publications'`). So the render half is ~80% built; this campaign does NOT rebuild it.

**Real gaps to close (the "full" part):**
1. **Shared spec channel**: `GraphDirective`/`GraphQuery` types live in `apps/web/architect/` only; backend `architect-replay.js` is untyped JS duck-typing the shape. `packages/shared` exists but is EMPTY. → move the spec types to `@nexus/shared`, import from both apps. Now backend Composers emit type-checked specs.
2. **Backend Statistician resolver + Composer**: today builders run client-side off raw `/api` JSON. Move stat computation into a backend **Statistician resolver** (entity-backed) and a small **Composer** that emits `GraphDirective`s server-side (generalize `architect-replay`'s `kinds` registry beyond `publications`). Frontend just `GraphRender`s. This is the Zincro `Resolver→Composer→GraphRender` shape — built on Nexus's existing engine.
3. **DGA data layer**: every `tags` reader → Statistician resolver (reads) or VenueGovernor (venue/synonym writes), per [[zincro-dga-reference]] patterns (Resolver class + `{Domain}ResolverTools.ts` manifest, auto-discovered; repos wrap `lib/db-*` for now, `withTenant` in the RLS phase).

**Build order (each step diff-gated + committed):**
- **P0** Tier-1 reader migrations to entities (below) — pure data correctness, independent of DGA wrapping. (dashboard-stats DONE pending diff.)
- **P1** Move `GraphDirective`/`GraphQuery`/`graph-data.types` → `packages/shared` (`@nexus/shared`); repoint `apps/web/architect` + builders to import from there. No behavior change; unlocks typed backend specs.
- **P2** `Statistician.ts` resolver (`src/services/catalog/`) wrapping the migrated entity reads (getSummary/topJournals/collaborations/recent/byYear/portfolio/org-tree) + `StatisticianResolverTools.ts` manifest. Handlers delegate; routes unchanged.
- **P3** Backend Composer: generalize `architect-replay` into a `kind→compose(data)→GraphDirective` registry emitting `@nexus/shared` specs from the Statistician; migrate the 3 client builders to consume server specs (or keep client builders but typed from shared — decide per chart).
- **P4** VenueGovernor (`merge`=synonym UI replacement, `setIndexation`=flags) — folds in the backfill scripts; retires the synonym subsystem + indexed_in/venue-type tag writes (Tier 2).
- **P5** Stop writing tags (insertTag/deleteTagsForRecord) once nothing reads them; **DROP** migration `008` + `doi_records` view via a Zincro-style read-only compat-shim if any consumer still needs the old shape.

Below = the per-reader entity-migration detail (P0), unchanged by the above.

## Entity model (the target every reader moves to)
Tenant-scoped; edges FK `publications(id)`.
- `authors(id, orcid, name, tenant_id)` UNIQUE(orcid,tenant) · `venues(id, issn_l NULLABLE, name, name_key, venue_type∈{journal,non-journal}, in_wos/in_scopus/in_doaj/in_scielo, tenant_id)` UNIQUE(name_key,tenant) · `institutions(id, ror, name, tenant_id)` UNIQUE(ror,tenant)
- `authorship(pub,author)` · `published_in(pub,venue)` · `affiliation(pub,author,inst)` [author-career] · `affiliated_with(pub,inst)` [DIRECT, superset — graph/collab use this]
- `publications`: `type`, `is_repository` (per-paper exclusion signals), `citation_count`, `open_access`, `journal` (denorm name).
- Normalizers: `normOrcid`/`normRor` (strip URL prefix), `journalNameKey` (`journal-canon.js`).

## STATUS 2026-06-02 — P0+P1+P2+P3 DONE & VERIFIED (full-resolution); only P4+P5 (the actual DROP) remain
- **P1** `@nexus/shared` types-only pkg (graph-data.types moved + re-exported; web Vite + API tsc + both Railway deploys green).
- **P2** Statistician resolver (`services/catalog/Statistician.ts` + manifest, scanner "Discovered 5 resolvers"); dashboard delegates.
- **P3** StatComposer (`services/architect/StatComposer.ts`, `GET /api/architect/charts`) — backend `kind→compose→GraphDirective` over the Statistician, typed via @nexus/shared. DGA Resolver→Composer→GraphRender chain exists end-to-end.
- **P4 (mostly done)**: (a) synonym-confirm applies the entity merge at write-time (`mergeInstitutionSynonym` in `db-institution-merge.js`; idempotent-verified). (b) **DECIDED: tag-manager page RETIRED** — deleted tag-manager.html/js, admin-tag-manager.js, the admin.html card, the shell-sidebar nav link, and backend synonym libs (synonym-handlers/synonym-candidates/ror-resolve) + dead getTagStatsPage. (c) `/api/tag-stats` repointed to the ENTITY graph (`tag-stats-entities.js`, {category,value,count}) for its 2 live consumers (explore-tags cloud, author-import) — **the last frontend tag READERS**. h-index action was dead, dropped.
- **P4 indexed_in write DONE**: ingest (store.js/store-openalex.js) no longer writes `indexed_in` tags — `syncVenueFlags(recordId, tenantId, sources)` takes sources from `indexationForIssn(record.issnL)` directly (verified `0140-7007 → [WoS,Scopus]`). Live write path is off indexed_in.
- **NEXT: P5 (DESTRUCTIVE — explicit go-ahead before DROP TABLE):** (1) repoint 2 superadmin one-shots (`handlers/indexation` reconcile → rebuild venue flags; `venue-type-backfill` → retire, superseded by syncVenues). (2) stop the CORE tag write: remove extractTags→insertTag loop + deleteTagsForRecord from store.js/store-openalex.js (entities already dual-written); resolveByExtId → entity or delete. (3) migration `008_drop_tags.sql`: DROP tags + tag_synonyms + tag_dismissed_pairs + doi_records view; drop db-indexes tag indexes. (4) remove dead code: institution-detail.js, node-detail-helpers.js, legacy graph-builder.js + getAllTags, indexed-backfill.tagIndexationForRecord. **Final gate: `grep -rn "FROM tags|JOIN tags|INSERT INTO tags|getAllTags|tag_synonyms|tag_dismissed" apps/api/{src,handlers}` empty before migration.**

### (historical) P0 reader migration — DONE & VERIFIED, live on prod
Every `tags` READER now reads entities, each diff-gated (scripts/diff-*.js, all green; only deltas are the proven sibling-ISSN recovery + merge survivors):
- dashboard-stats, db-list (+ search/records/[id]/portfolio handlers), node-detail-resolvers + author-detail (via new `lib/entity-detail.js`), public-authors, org-tree, auth-helpers, public-graph, claustro, portfolio-coauthors + portfolio.findCollaborators.
- **AuthorGovernor.claim** built (`services/catalog/AuthorGovernor.ts`, 2nd governor) — claim now writes the authorship EDGE, not just a tag.
- Shared helpers: `lib/stats-scope.js` (scopedPubFilter/personalPaperFilter), `lib/entity-detail.js`, `scripts/entity-diff-helpers.js`.
- **Proven equivalences (reuse):** affiliations-JSON ROR filter == `affiliation` edge (1947=1947); `indexed_in` tag == `venues.in_*` flag (claustro 18=18).
- **Bugs the migration caught:** `SUBSTRING(...) AS year` (prod), claim→authorship gap, aggregateAuthors duplicate-tag over-count.
- **LEFTOVER reader:** `graph-meta.js` (builds `category:ext_id` node-metadata) — deferred to P2, do it from `entityGraphRows`.
- **DEAD code (left untouched):** `lib/institution-detail.js`, `lib/node-detail-helpers.js` — only node-detail-resolvers is handler-wired.

## P1 — surgical scope (decided 2026-06-02): move ONLY the data-shape contract, re-export for back-compat
DON'T move the whole `apps/web/architect/graph-composer.types.ts` web — `GraphDirective` drags a huge cone of FRONTEND render-runtime types (`fold-atoms`, `place-atoms`, `__buckets`, `seriesWeights`, `graph-features`, …) the backend must never see, and it's imported by ~30 graph-engine files. The clean cut: **move only `graph-data.types.ts`** (pure `GraphDataPoint`/`StackedGraphDataPoint`/`ChartData` — zero deps, exactly what a backend Composer emits) into `@nexus/shared`, then **re-export it from the old `apps/web/architect/graph-data.types.ts` path** so the ~30 importers need ZERO changes. Build wiring needed (verify all three): (1) `packages/shared/package.json` name `@nexus/shared` + a tsconfig; (2) web is Vite with NO tsconfig/alias today — add a Vite `resolve.alias` for `@nexus/shared` (or rely on the npm-workspace symlink); (3) API tsc `paths` for `@nexus/shared`; (4) Railway builds both — confirm the shared pkg builds/resolves in CI before relying on it. A broken `@nexus/shared` resolution takes down the web build, so wire + verify in isolation first.

## Grounded facts (decide once, apply everywhere)
- **Zero name-only entities** (tenant 1): every author tag has a bare ORCID, every institution tag a `https://ror.org/`-prefixed ROR. → the detail-page `value`-path branches (`papersByTag(cat, null, value)`, `tagAggregate` value-paths) never hit real data; the **ext_id/orcid/ror entity joins are fully sufficient**. Don't build name-only fallbacks.
- **`source` tag = vestigial** (3 values: Crossref 338 / DOAJ 48 / "indexed" 301 pubs). No domain (DGA_DESIGN §"deliberately dissolving startup shortcuts": `source` was ingestion provenance, not a domain). `publications.source_indices` is **100% NULL** (never populated). **Decision: DROP the source dimension** from `dashboard-stats.getByYearAndSource` → publications-per-year only. If provenance-by-year is ever wanted, it's a future Publication property, not a resurrected tag.
- **Synonyms: 28 rows, institution-only. `tag_dismissed_pairs`: 0 rows.** → synonym subsystem is purely institution entity-resolution (already mirrored by `mergeInstitution` in entities); dismissed-pairs can be **discarded** (no data, no entity analog needed).
- **ISSN-sibling / venue collapse**: venues are keyed by `name_key` (siblings already collapsed, ISSN-dups merged). Journal reads must join `venues` by name_key (NOT issn) and filter `venue_type='journal'`. Don't re-collapse.
- **Personal scope**: `category='author' AND ext_id=scope.orcid` → `id IN (SELECT publication_id FROM authorship s JOIN authors a ON a.id=s.author_id WHERE a.orcid=normOrcid(scope.orcid) AND a.tenant_id=…)`. This single rewrite recurs in ~17 sites.
- **DGA ownership**: `dashboard-stats`/`portfolio*`/`org-tree`/`h-index`/`graph-meta`/`public-*` → **Statistician resolver** (reads Publication+Author+Venue). `claustro` → Claustro resolver. node/author/institution-detail → Statistician/architect node-detail. Synonym curation → **InstitutionGovernor.merge** (replaces `tag_synonyms`). For THIS campaign migrate the lib functions in place (additive); the Governor/Resolver wrapping is the later DGA pass — don't block the tags-drop on it.

---

## ⟶ DGA-FIRST decision (2026-06-02, approved)
Migrate readers **into Governors/Resolvers**, not legacy `lib` SQL — do the tags-drop and the DGA build in ONE pass (no double migration). Verified the foundation is real & running in prod: `dist/src/services/*` compiles & ships, `index.js` bootstraps the DGA, **ProjectGovernor is the one working example** (handler delegates, route URL unchanged, governor wraps the existing `lib/db-projects` repo + adds validate→write→emit→ledger; reads are pass-through). The rest of the design (`Statistician`/`VenueGovernor`/`Author`/`Publication`) is named in DGA_DESIGN.md but **not built**. Frontend is 15 bespoke pages, 43 direct `fetch('/api')`, no shared render layer — out of scope here (the Architect/chart-registry unification is a separate effort).

**Per-cluster two-step (each step its own commit):**
1. **Migrate the read to entities** in `lib/` — the diff-gated, correctness-critical part (same rigor as the graph cutover). Keep the function signature so the handler is untouched.
2. **Wrap in the DGA role** — a `Statistician` resolver (pure reads, per ProjectGovernor's pass-through style) for stats/portfolio/org-tree/graph-meta/public-*; `VenueGovernor.merge`/`setIndexation` for the venue + synonym work. Handler delegates to the service; route URL unchanged.

Build the Statistician as `src/services/catalog/Statistician.ts` (+ `StatisticianResolverTools.ts` manifest, auto-discovered by resolver-scanner). It absorbs ~10 reader files — but build it incrementally, one cluster of methods at a time, so each is diff-gated before the next.

## TIER 1 — read-path migration (diff-gated). Does NOT enable DROP alone, but clears all readers.
Migrate one cluster at a time; each gets a read-only diff script comparing OLD (tags) vs NEW (entities) per tenant; cut over only at zero/explained drift; commit per cluster. **Already migrated (skip):** `portfolio.getResearcherWorks/getExistingCoauthors`, `db.getAllRecords/getSubmissions` (personal path), `public-stats.getTopJournals/getPublicationTypes/getTypeByYear`.

### Cluster A — personal-scope author filter (the 17-site sweep, LOW risk)
One rewrite, applied everywhere `tags WHERE category='author' AND ext_id=orcid` is used as a paper-id filter. Sites: `db-list.js` (getRecordsPage, getSubmissionsPage, searchRecordsPage), `handlers/search.js`, `handlers/records/[id].js`, `handlers/claim-paper.js`, `handlers/portfolio.js`, `db.js getAllTags` (until tag-stats dies), `auth-helpers.js` (countPapersByOrcid, researcherNameByOrcid → `authors.name`), `node-detail-resolvers.paperDetail`, `dashboard-stats` personal branches. **Diff**: per known ORCID, paper-id SET equality OLD vs NEW (incl. a no-match ORCID = 0). Gotcha: normalize scope.orcid (may arrive prefixed).

### Cluster B — Statistician stats (`dashboard-stats.js`, the big one)
- getSummary → counts via authorship/authors; getTopJournals → venues+published_in (venue_type='journal', group name_key); getRecentPapers → published_in venue name; getCollaborations → `affiliated_with`+institutions; getCountries → already JSON, no change; **getByYearAndSource → DROP source dim** (publications-per-year).
- **Diff**: per scope, compare each chart's `{key:count}` map. Gotcha: `affiliated_with` (direct) vs `affiliation` (author-mediated) — collaborations historically merged all institution tags → use `affiliated_with` (matches the tag set; it's the direct-edge superset).

### Cluster C — node/author/institution detail
`node-detail-helpers.js` (papersByTag → ext_id entity joins; tagLabel → authors/institutions/venues.name; `extIdVariants` becomes unnecessary once joins use normOrcid/normRor), `node-detail-resolvers.js` (tagAggregate, journalDetail by name_key, paperDetail), `author-detail.js` (citationStats/papersAll via authorship), `institution-detail.js` (via affiliated_with), `public-authors.js` (aggregateAuthors — keep the ROR-affiliation JSON filter; swap the author enumeration to authors+authorship). **Diff**: for a sample of ext_ids per category, compare papers list + aggregate (count/citations/journals). Drop the dead value-path branches (no name-only data).

### Cluster D — coauthor / collaborator graph + misc resolvers
`portfolio.findCollaborators` + `portfolio-coauthors.buildCoauthorGraph` (authorship self-join for co-authors; `affiliation`+institutions for coauthor affiliation; keep doi_concepts), `claustro.js` (indexed_in → `venues.in_*`), `graph-meta.js` (rebuild `category:ext_id` aggregates from entities, preserve tag-id key format), `public-graph.js` (author→authorship+authors, institution→affiliated_with+institutions), `org-tree.js` (author paper-count → authorship group by author). **Diff**: coauthor sets + edge weights; claustro counts; graph-meta per-tag aggregates.

---

## TIER 2 — what actually enables DROP (write-path + synonym UI). Heavier, product-facing.

### T2.1 — indexed_in live-write → venue flags
`indexed-backfill.js tagIndexationForRecord` (called every ingest from `store.js`/`store-openalex.js`) writes `indexed_in` tags. Entity side `syncVenueFlags` (db-entities.js) already sets `venues.in_*`, but it reads the just-written indexed_in tags. **Repoint**: have the ingest set venue flags directly from `indexationForIssn(issnL)` (the source the tags came from), drop the tag write. `handlers/indexation.js` reconcile (clears+rebuilds indexed_in tags) → rebuild venue flags instead (run `backfill-venue-flags.js`).

### T2.2 — venue-type backfill
`handlers/venue-type-backfill.js` (UPDATE/INSERT journal↔repository tags) → already covered by `syncVenues`/`db-venues-sync.js` (venue_type + is_repository). Retire the handler or repoint to re-running the venue backfill.

### T2.3 — synonym subsystem → InstitutionGovernor.merge
Live admin UI (`tag-manager.html/js`, `admin-tag-manager.js`, `explore-tags.js`) → `handlers/tag-stats.js` actions: `tags` (grouped stats), `synonyms`/`candidates`/`confirm`/`dismiss`/`delete-synonym`, `ror-lookup`/`ror-resolve`. Backed by `synonym-candidates.js`, `synonym-handlers.js`, `tag_synonyms`, `tag_dismissed_pairs`, `ror-resolve.js`.
- `tag_synonyms` (28 inst rows) is already applied to entities via `mergeInstitution`. Repoint `confirm` → `mergeInstitution(fromRorInst, intoRorInst)` (it exists in db-entities.js); the candidates view reads from `institutions` (similar names, no shared ROR) instead of tags. `dismiss`/`tag_dismissed_pairs` → discard (0 rows) or a tiny inst-merge-veto table.
- The `tags` (grouped-count) action of tag-stats → either retire the page or repoint to entity counts (authors/venues/institutions grouped by name). **This is the one genuine product decision** — confirm whether the tag-manager admin page stays (repoint) or goes.

### T2.4 — core tag-write shim
`db.js insertTag`/`deleteTagsForRecord` (every ingest, dual-write era) + `resolveByExtId` (reads tags for canonical name). Once all readers are off tags (Tier 1) and T2.1–2.3 done, **stop writing tags**: remove the `extractTags`→insertTag calls from `store.js`/`store-openalex.js` (entities already dual-written via `syncRecordEntities`/`syncVenues`). `resolveByExtId` → entity lookup or delete. Also `backfill-ext-ids.js`, `backfill-decode.js`, `ror-resolve.js` tag deletes become no-ops/removed.

---

## STEP 5 — DROP (destructive, hard checkpoint)
Only after NOTHING reads or writes tags (grep `FROM tags|JOIN tags|INSERT INTO tags|getAllTags|tag_synonyms|tag_dismissed` = clean across `apps/api/src` + `handlers`). New migration `008_drop_tags.sql`: drop `tags`, `tag_synonyms`, `tag_dismissed_pairs`, and the `doi_records` compat VIEW (confirm no readers via grep first — separate check). Drop `db-indexes.js` tag indexes. Keep `backfill-entities.js`/reconcile as historical. RLS rollout (per migration-handoff) is independent.

## Verification discipline (every cluster)
Read-only diff script per cluster, run `railway ssh --service Nexus "cd /app/apps/api && node scripts/diff-<x>.js"` (large graphs need `--max-old-space-size=4096`). Compare SETS/maps OLD vs NEW per tenant; zero or explained drift before cutover. Commit + push per cluster (Railway auto-deploys; tags stays live & dual-written so half-migrated is safe indefinitely). N5 ≤150 lines/file — extract, don't compress.

## Open product decision (only one)
T2.3: does the **tag-manager admin page** stay (repoint its grouped-tag view + synonym curation to entities + InstitutionGovernor.merge) or get retired? Everything else is mechanical + grounded.
