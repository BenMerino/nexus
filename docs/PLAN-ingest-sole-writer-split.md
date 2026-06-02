# Plan — split the ingest write so each governor is its table's sole writer

**Goal.** Close the one-writer-rule violation: today `PublicationGovernor.upsert` → `syncRecordEntities` writes the `authors`, `venues`, and `institutions` tables itself. Per `DGA_DESIGN.md:35`, the IngestionWorkflow must resolve Author/Venue/Institution **as governor steps** (each the sole writer of its own table), then PublicationGovernor links only the **edges** (its aggregate's children). Behavior-neutral — same SQL, same order, proven by the existing diff-gate (`scripts/verify-governor-wrap.js`).

**Non-goal (explicitly deferred).** `withTenant`/RLS atomicity. The ingest stays on the plain `sql` pool (handoff §1 rule). Adding a transaction now would couple two concerns and break the byte-for-byte diff-gate. Ownership decomposition only.

**Event restraint (the elegance call).** Entity governors do NOT emit per-row events on bulk ingest (would be 10–15× `author.upserted` per DOI with zero listeners — ceremony, not elegance; event-sourcing is "a targeted choice, not a default", governor-patterns.md). Ingest-time entity upserts are quiet; `publication.upserted` + `ingestion.completed` already mark "this DOI changed". The entity governors keep emitting on STANDALONE meaningful writes (claim, merge).

## Table → owner (the invariant being established)
| Table | Sole writer | Method |
|---|---|---|
| `authors` | AuthorGovernor | `upsertFromTags` |
| `venues` (+ in_* flags) | VenueGovernor | `upsertFromTags` / `applyRecordFlags` |
| `institutions` | InstitutionGovernor | `upsertFromTags` |
| `publications` row + `authorship`/`published_in`/`affiliation`/`affiliated_with` + `is_repository` | PublicationGovernor | `upsert` (row) + `linkEdges` |

## Repo split (lib/, N4 — SQL stays here, governors call these)
**db-entities.js** — split `syncRecordEntities` into:
- `upsertAuthors(tenantId, tags)` — the `authors` INSERT loop (lines 26–33's INSERT part only).
- `upsertInstitutions(tenantId, tags, record)` — the `institutions` INSERTs from institution tags (49–56) AND the institution INSERT inside `syncAffiliations` (89–91).
- `linkRecordEdges(recordId, tenantId, record, tags)` — the 4 DELETEs + all edge INSERTs (`authorship`, `published_in`, `affiliated_with`, `affiliation`), looking up entity ids by natural key (orcid/name_key/ror) that the entity-upserts above already wrote. Includes the venue-flag OR (`syncVenueFlags`) — wait: flags are a VENUE-table write → belongs to VenueGovernor, see below.

**db-venues-sync.js** — split `syncVenues` into:
- `upsertVenues(tenantId, tags)` — the `venues` INSERT/ON CONFLICT only (no `published_in`, no `is_repository`).
- venue `published_in` edge + `publications.is_repository` move into `linkRecordEdges` (they're publication-aggregate writes).
- `applyRecordVenueFlags(recordId, tenantId, sources)` — the existing `syncVenueFlags` UPDATE (a `venues`-table write) → VenueGovernor owns it.

## Governor methods
- `AuthorGovernor.upsertFromTags(ctx, tags)` → `upsertAuthors`.
- `VenueGovernor.upsertFromTags(ctx, tags)` → `upsertVenues`; `applyRecordFlags(ctx, recordId, sources)` → `applyRecordVenueFlags`.
- `InstitutionGovernor.upsertFromTags(ctx, tags, record)` → `upsertInstitutions`.
- `PublicationGovernor.upsert(ctx, input)` → `upsertRecord` (row) + `linkRecordEdges` (edges). NO entity-table writes.

## Workflow (the one governor-to-governor seam)
`IngestionWorkflow.run(ctx, input)` order — MUST match current `syncRecordEntities` order for diff-neutrality:
1. `publicationGovernor.upsert` writes the paper ROW first (need recordId) — but edges last.
   → restructure: split `PublicationGovernor.upsert` into `upsertRow` (returns id) + `linkEdges`.
2. `authorGovernor.upsertFromTags(ctx, tags)`
3. `venueGovernor.upsertFromTags(ctx, tags)`
4. indexation: `venueGovernor.applyRecordFlags(ctx, recordId, indexationForIssn(record.issnL))`
5. `institutionGovernor.upsertFromTags(ctx, tags, record)`
6. `publicationGovernor.linkEdges(ctx, recordId, record, tags)` — all edge tables, by natural key.
7. emit `ingestion.completed`.

**Ordering proof obligation:** current order is authors→authorship, venues→published_in, flags, institutions→affiliated_with, affiliations. New order does ALL entity upserts first, THEN all edges. Edge inserts use `ON CONFLICT DO NOTHING` and look up by natural key, so result is identical as long as every entity exists before its edge — which the new order guarantees (entities in steps 2–5, edges in step 6). The `DELETE`s (edge replacement) move to the top of `linkEdges`.

## Gate
`node scripts/verify-governor-wrap.js 25` — re-ingest, assert zero drift on authors/venues/institutions/all 4 edge tables. Same gate as §1; this refactor must keep it green.

## Files touched
- `src/lib/db-entities.js`, `src/lib/db-venues-sync.js` (repo split)
- `src/services/catalog/{AuthorGovernor,VenueGovernor,InstitutionGovernor,PublicationGovernor}.ts`
- `src/services/ingestion/IngestionWorkflow.ts`
- `src/lib/store.js` (passes tags/record to the workflow; it already has them)
- `DGA_DESIGN.md` (mark the violation closed)
