# Handoff — `tags` → entity-model migration (DGA Step 4+)

**Status as of 2026-06-01.** Pick up here. Full doctrine in `docs/DGA_DESIGN.md`; cross-session notes in agent memory `dga-migration.md`. This doc is the concrete "what's done / what's next / how to verify."

## Big picture
Dissolving the generic `tags` EAV table into first-class entities + edges so `tags` can be dropped. Strategy: **additive, dual-write, reconciliation-gated, reader-by-reader** — never a big-bang. Each reader is migrated only after a diff proves the entity-based result matches the tag-based one; `tags` is dropped last.

## DONE & LIVE (all verified, prod healthy)
- **Step 0** — `doi_records` → `publications` + a `doi_records` compat VIEW. 3 writers repointed to `publications`; ~22 readers ride the view. (migration `004`)
- **Step 1** — entity + edge tables (migration `005` + `db-schema-entities.js`): `authors`(orcid), `venues`(issn_l + `in_wos/in_scopus/in_doaj/in_scielo` flags), `institutions`(ror), `authorship`, `published_in`, `affiliation`(pub↔author↔institution).
- **Step (added)** — `affiliated_with`(pub↔institution, DIRECT) (migration `006`). Two distinct institution relationships now modeled: `affiliation` = author-career (ORCID-required, from JSON); `affiliated_with` = institutional-output (any ROR, ORCID-or-not, from institution tags). graph-builder + collaboration counts need the latter.
- **Step 2/3** — backfill (`scripts/backfill-entities.js`, set-based, idempotent, **self-merging**) + dual-write on ingest (`src/lib/db-entities.js syncRecordEntities`, wired into `store.js` + `store-openalex.js`).
- **Step 4 readers migrated:**
  - `public-stats.js getTopJournals` → venues+published_in (venue_type='journal').
  - `portfolio.js getResearcherWorks` + `getExistingCoauthors` → authorship.
  - **`db.js` personal-scope filter (N1!)** — `getAllRecords/getAllTags/getRecordByDoi/getSubmissions` → authorship-by-orcid. **Verified: correct sets, no leak, admin unaffected.**
- **Institution synonym merges** — `mergeInstitution(fromId,intoId)` in `db-entities.js`; `applyInstitutionMerges()` in `scripts/merge-institution-synonyms.js`, run at the end of every backfill (idempotent).

## Reconciliation gate — THE safety mechanism
`scripts/reconcile-entities.js` — READ-ONLY, compares OLD(tags) vs NEW(entities) per tenant; exits non-zero on drift. Run via:
```
railway ssh --service Nexus "cd /app/apps/api && node scripts/reconcile-entities.js"
```
**Current state: ALL 5 ZERO-DRIFT** — authors 126540, venues 11821, institutions 17829, affiliation 526289, affiliated_with 281107.
Backfill: `railway ssh --service Nexus "cd /app/apps/api && node scripts/backfill-entities.js"` (idempotent; re-run anytime; it re-merges institutions).

## How to run things (no local DATABASE_URL)
The DB host is `*.railway.internal` (only resolves inside Railway). Run scripts via `railway ssh --service Nexus "cd /app/apps/api && node scripts/<x>.js"`. The container has the full repo at `/app`; app runs `node dist/index.js`. Deploy = push to `main` (Railway auto-builds; `tsc` compiles `src/**` + copies `.sql` to `dist/`). Wait ~90s, confirm `railway deployment list --service Nexus`.

## graph-builder rebuild — ✅ CUT OVER (2026-06-01). `/api/graph` now reads entities, not tags.

### Cutover complete (committed, live)
`handlers/graph.js` now calls `buildGraphFromEntities`. The legacy `buildGraph` (tags) stays in `graph-builder.js` purely as the diff baseline until `tags` is dropped. **Gate: `scripts/diff-graph-entities.js` reports ZERO structural drift** — every DOI connects to the identical set of real venues & institutions in both graphs (run with `node --max-old-space-size=4096`; the default 2 GB OOMs).

### Foundational fixes that unblocked it (migration 007 + backfills, all RAN on prod tenant 1)
- **`indexed_in` → `venues.in_*` flags.** Those flags were all-FALSE; now backfilled (`scripts/backfill-venue-flags.js`, 138 venues: wos 135/scopus 136/doaj 23/scielo 2), dual-written on ingest (`db-entities.js syncVenueFlags`). Graph emits 4 per-source nodes instead of 250 per-ISSN nodes (`verify-indexed-flags.js`: onlyOLD=0, onlyNEW=164 recovered sibling-ISSN edges — documented improvement). `venue-flags.js` holds the source→flag map.
- **ISSN-less venue identity (migration `007`).** `venues.issn_l` made NULLABLE + `name_key TEXT` with `UNIQUE(name_key, tenant_id)` as the venue identity; legacy `UNIQUE(issn_l,tenant)` dropped. `scripts/backfill-venues-namekey.js` fills name_key, inserts the ~4.9k ISSN-less venues (conferences/books/repos), and **merges venues sharing an ISSN** (EPL/RIVAR/Brazilian-surgery split — the VenueGovernor.merge op as backfill). Dual-write moved to `db-venues-sync.js` (name-key upsert).
- **`venue_type` is journal|non-journal ONLY** (`entity-venue-type.js`; repository is NOT a venue type). **`publications.is_repository` (migration 007)** is the per-paper repository-deposit signal the graph excludes on — because a preprint/repository deposit is essentially a duplicate of the published paper. (preprint↔published *dedup* proper is future PublicationGovernor domain.) Backfilled from repository tags; dual-written.
- **Per-DOI structural gate** (`diff-graph-entities.js`): replaced a brittle pattern-classifier with the provable invariant — canonicalize each venue to its ISSN-cluster and each institution to its post-merge ROR, then assert every DOI's connected-entity SET is identical. Cause-agnostic; catches real drift, ignores node-id relabels from sanctioned merges/collapses.

### DGA framing (per user direction + DGA_DESIGN.md §17-19)
Venue identity — including minting a name-keyed synthetic id for an ISSN-less venue, merging duplicates, and (future) fetching a missing ISSN — is **VenueGovernor** territory (`upsert`/`merge`/a `resolveIdentity` action). The backfill scripts are the proto-implementations; wrap them into `services/catalog/VenueGovernor.ts` in the DGA pass. The graph is the **Statistician** resolver reading venues.

### Superseded blocker note (kept for history — NOW RESOLVED)
- **Foundational fix for `indexed_in`** (was: 250 per-ISSN nodes off `indexed_in` tags; handoff originally said "→ venues.in_* flags" but those flags were **all FALSE / never backfilled**). Now:
  - `src/lib/venue-flags.js` — the one source→flag map (`Scopus→in_scopus`, `WoS→in_wos`, `DOAJ→in_doaj`, `SciELO→in_scielo`).
  - `scripts/backfill-venue-flags.js` — sets `venues.in_*` from `indexed_in` tags via **journal name-key join** (an `indexed_in` ISSN may be any sibling of the venue). **RAN on prod tenant 1: 138 venues flagged (wos 135 / scopus 136 / doaj 23 / scielo 2).** Idempotent.
  - `db-entities.js syncVenueFlags` — dual-writes the flags on every ingest (ORs in, never clears).
  - `scripts/verify-indexed-flags.js` — proved the flag-derived `indexed_in` edges reproduce the old per-ISSN-tag edges: `onlyOLD=0`, `onlyNEW=164`. The 164 are **legit sibling-ISSN coverage** (real WoS/Scopus journals — Calidad en la educación, Maderas, J. Molecular Liquids — whose papers carried the *other* sibling ISSN, so the old per-paper-ISSN tags under-marked them). A documented improvement, not drift.
- **Entity graph builder, built as a PARALLEL function (handoff approach #5):**
  - `src/lib/graph-assemble.js` — `assembleGraph(rows, {synonymMap, journalCanonIssn})` extracted from the old builder; **shared** by both paths so node-id/dedup/label-upgrade/preprint-exclusion are identical by construction. (`journalCanonIssn` omitted for entities — venues already collapse siblings, gotcha #3.)
  - `src/lib/entity-graph-rows.js` — `entityGraphRows(scope)` emits the `{category,value,ext_id,doi,title,published}` shape from `authorship`/`published_in`/`affiliated_with`/`publications.type` + venue `in_*` flags. (gotcha #1 RESOLVED: author ext_ids in tags are ALL bare → `authors.orcid` matches directly; institution tags all ROR-prefixed → `canonicalExtId` strips → matches bare `institutions.ror`.)
  - `src/lib/graph-builder-entities.js` — `buildGraphFromEntities(scope)`.
  - `src/lib/graph-builder.js` — refactored to call `assembleGraph`; now also exports `loadSynonymMap`, `affiliationsFromNodes` (reused by the entity path). **Behaviorally unchanged; still the live path.**
  - `scripts/diff-graph-entities.js` — gate. Run with **`node --max-old-space-size=4096`** (building both ~240k-node graphs OOMs the 2 GB default). Asserts only `source`/`indexed_in` differ.

### THE BLOCKER (diff result, tenant 1, admin) — a foundational gap, NOT a graph bug
`OLD nodes=238735 edges=849429` vs `NEW nodes=241180 edges=888836`. Beyond the expected `source` (3 dropped) and `indexed_in` (250 per-ISSN → 4 per-source) deltas, **real drift**:
- **onlyOLD `non-journal`: 4676 nodes / 9405 edges.** **onlyOLD `repository` papers leak into NEW: +5587 doi, +1587 author, +~192 institution nodes.**
- **Root cause:** the entity model only stores venues **WITH an ISSN**. But **17,253 of 20,573 `non-journal` tags and 7,879 of 9,132 `repository` tags have NULL ISSN** (conferences, books, institutional repos: arXiv/Apollo/AgEcon, theses, + some garbage rows). `venueKeyToIssn` skips `!ext_id`, so `venues` has only **429 non-journal, 0 repository** rows. Therefore (a) ISSN-less non-journal nodes are absent, and (b) the **repository→exclude signal lives only in the `repository` tag** — with no entity representation, the entity graph fails to exclude those papers (verified: 100% of the +5587 extra DOIs carry a repository/preprint tag).
- Verified `publications` has `journal`/`venue`/`type` columns but **no `venue_type`/repository flag** — the repository signal is nowhere in entities today.

### NEXT — close the gap via the **VenueGovernor** (the DGA owner; per DGA_DESIGN.md §15-19)
Doctrine answer to "who owns this": **`VenueGovernor`** (a Governor, keyed today by ISSN-L, owns `upsert`/`merge`/`setIndexation`, emits `venue.upserted`/`venue.indexationUpdated`). A venue is a governed aggregate with its own lifecycle, independent of the papers on it — so **assigning identity to an ISSN-less venue is a `VenueGovernor.upsert` write, and fetching a missing ISSN is a Governor write (a `resolveIdentity` action).** NOT a Resolver (no writes), NOT under Publication (the `published_in` *edge* is Publication's child; the *venue entity* is its own aggregate, §19). The graph itself is the **Statistician Resolver** reading venues — that's this cutover.
Concrete steps (additive, gated):
1. **New migration:** `venues.issn_l` NULLABLE + a `name_key` column with `UNIQUE(name_key, tenant_id)` so an ISSN-less venue has a stable synthetic identity; `venue_type` already carries `repository`/`non-journal`.
2. **Backfill ALL** `journal`/`non-journal`/`repository` tags (with OR without ISSN) into `venues` + `published_in`, keyed by `name_key` when ISSN absent. (~95% are genuinely ISSN-less → synthetic identity; the fetchable minority is the Governor's secondary `resolveIdentity`/ISSN-fetch path via MetadataProviders.)
3. **Re-run `diff-graph-entities.js`** → expect non-journal nodes to reproduce exactly and the repository papers to be excluded (venue_type='repository' now in entities) → only `source`/`indexed_in` deltas remain.
4. **Only then** swap `handlers/graph.js` to `buildGraphFromEntities` (route URL unchanged). Wrap the venue writes as `VenueGovernor` and the graph as the `Statistician` resolver per DGA_DESIGN.md.

### Gotchas still relevant for the NEXT step
- **node-id exactness** (gotcha #1) — RESOLVED for author/institution (see above). For ISSN-less non-journal nodes the old node-id is `non-journal:<resolved name>` (no ext_id); the synthetic venue must emit a row whose `value`=that name and `ext_id`=null so `assembleGraph` keys it identically. Diff per group after backfill.
- **preprint/repository exclusion** (gotcha #2) — the WHOLE POINT of the blocker. Exclusion needs `venue_type='repository'` reachable from entities; the migration above makes it so.
- **OOM:** always run the diff harness with `--max-old-space-size=4096`.
- **Don't** double-apply ISSN collapse (gotcha #3) or institution merges (gotcha #4) — both already baked into entities.

## AFTER graph-builder
- Remaining readers (each diffed): `dashboard-stats.js` (6 queries: summary/byYearAndSource/collaborations/countries/topJournals/recentPapers), `public-graph.js`, `node-detail-resolvers.js` (+`node-detail-helpers extIdVariants`), `portfolio.js findCollaborators`.
- Wrap migrated readers as entity **Governors** + **Statistician resolver** (the DGA payoff; see DGA_DESIGN.md).
- **Step 5 (DESTRUCTIVE, HARD CHECKPOINT):** only after NOTHING reads `tags` — drop `tags`/`tag_synonyms`/`tag_dismissed_pairs` + the `doi_records` compat view. New migration.
- **RLS rollout:** entity tables are tenant-scoped + written via `withTenant` (dual-write) so they can arm RLS early; per-table plumb→permissive→FORCE for the rest. `users`/`tenants` are the no-RLS cross-tenant exception.

## Invariants to preserve (don't regress)
- **N1 personal-scope** (`scope.js isPersonalScope`): non-admin+orcid sees ONLY own papers. Verified on the entity path; keep it that way (diff paper-id sets incl. a no-match ORCID = 0).
- **nbr15**: every `apps/api/**` source file ≤150 lines (extract, don't compress).
- **Two journal-count semantics** and the **two institution relationships** — don't conflate.
- Dual-write keeps entities consistent with new ingests; `tags` remains the live source for unmigrated readers, so the half-migrated state is safe indefinitely.
