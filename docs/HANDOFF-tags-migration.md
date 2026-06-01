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

## NEXT: rebuild `graph-builder.js` (the linchpin to drop tags) — IN PROGRESS, NOT STARTED IN CODE
graph-builder is a GENERIC 8-category graph; it still reads `tags`. Categories → entity sources:
- author → `authorship`+`authors` · journal/non-journal → `published_in`+`venues` · institution → **`affiliated_with`** (NOT `affiliation` — must match the 281k direct edges) · type → `publications.type` · indexed_in → `venues.in_*` flags · **source → DROP (vestigial: 687 legacy rows, not pipeline-produced)**.

**Recommended approach:** keep the exact `buildGraph` algorithm (node-id scheme, dedup, label upgrade, `buildAffiliations`) but replace the `getAllTags(scope)` data source with an entity-derived stream emitting the SAME `{category,value,ext_id,doi,title,published}` row shape. If the derived rows reproduce the (post-synonym-merge, post-ISSN-collapse) tag rows, the graph is identical by construction.

**CRITICAL gotchas found via diffing (do not skip):**
1. **node-id exactness.** Old node-ids: `canonicalExtId` strips the ROR prefix for institutions but leaves `author` ext_id AS-IS (may be prefixed `https://orcid.org/...`). Entity `authors.orcid` is BARE. → entity-derived author rows must emit `ext_id` in whatever form keeps node-ids stable for the frontend, OR confirm the frontend doesn't care about the exact author node-id string. **Diff node-id SETS per category before cutover.**
2. **preprint/repository exclusion.** Old graph excludes papers tagged `repository` OR `type='preprint'`. The entity-derived stream MUST apply the same exclusion, else extra nodes appear. (This is why a raw entity diff shows thousands of `onlyENTITY` author/institution nodes — they're on excluded preprint papers. Apply the filter and it should converge.)
3. **ISSN collapse** is already baked into `venues` (one venue per journal name-key, smallest ISSN). Old code does it at read-time via `journalCanonIssn`; entity venues already collapsed → don't double-apply.
4. **institution merges** (3) are applied in entities; old graph applied them via read-time synonym fold. Entity side already merged → consistent.
5. Diff harness: build entity `buildGraph` as a PARALLEL function, compare `nodes` (by id) and `edges` (by `source→target`) SET-equality against the live tags `buildGraph` for tenant 1 (admin scope) until ZERO difference. Only then swap `handlers/graph.js` / the export.

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
