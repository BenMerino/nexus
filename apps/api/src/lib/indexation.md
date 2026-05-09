# Journal indexation — source of truth

Which journals are indexed in which scholarly sources (Scopus, WoS, SciELO, DOAJ) is the foundation of Nexus's "Publications by Year" stacked chart and any downstream quality/coverage metric. This doc explains how that truth is assembled — source by source, including why each path was chosen and what it can't tell us.

## The canonical table

`indexed_journals` (schema in [db-schema.js](db-schema.js)):

```
issn_l TEXT, source TEXT, journal_name TEXT, added_at TIMESTAMPTZ
PRIMARY KEY (issn_l, source)
```

Every row asserts: "the journal with this ISSN is indexed in this source." Seeding replaces the full row set per source (DELETE + INSERT). `last_seeded_at` is derived via `MAX(added_at) GROUP BY source`; no schema migration needed.

Reads go through two helpers in [indexed-journals.js](indexed-journals.js):

- `indexationForIssn(issn)` → list of sources — used at record ingest via `tagIndexationForRecord`.
- `getIndexationMap()` → `Map<issn, source[]>` — used by the backfill.

## The registry

[indexation-sources.js](indexation-sources.js) is the single list of sources. Every other module (UI, API, stats, seed orchestrator) derives from it. Shape:

```
{ id: "Scopus"|"WoS"|"SciELO"|"DOAJ", seedKind: "auto"|"openalex"|"manual", aliases, seedFn }
```

`seedKind` drives the admin UI: `auto` and `openalex` get a "Re-seed" button; `manual` gets a file upload. Currently all four sources resolve to non-manual paths (see below); the `manual` branch is kept for future sources that lack an API.

## Tag model that makes all this work

Journals are tagged per-ISSN, not per-journal. A journal with both print and online ISSNs produces **two sibling `(category='journal', ext_id=<issn>)` rows** per record (see [normalize-tags.js](normalize-tags.js)). This matters because external indexes key on different ISSNs:

- SciELO articlemeta → online ISSN
- OpenAlex `issn_l` → print ISSN (convention, not rule)
- Elsevier Serial Title → either
- WoS/Scopus CSVs → both columns (our `extractEntries` reads every column containing "issn")

Without siblings, a SciELO lookup against our tags would miss every journal whose canonical ISSN-L is its print form. We learned this the hard way — see "SciELO" below.

Sibling tags require that count queries use `COUNT(DISTINCT doi_record_id) GROUP BY value` (journal name), not `GROUP BY ext_id`, to avoid double-counting. See `getTopJournals` in [public-stats.js](public-stats.js).

Sibling backfill for existing records lives in [../scripts/backfill-issn-siblings.js](../scripts/backfill-issn-siblings.js).

## Per-source truth paths

### WoS — OpenAlex flag

- **Signal:** `is_core` on `api.openalex.org/sources/issn:<ISSN>`
- **Covers:** SCIE + SSCI + AHCI + ESCI rolled up
- **Seeder:** [seeders/openalex-flags.js](seeders/openalex-flags.js) (shared with DOAJ)
- **Why OpenAlex:** They maintain this mapping and expose it freely. Clarivate's MJL downloads are per-index XLSX requiring manual stitching; JCR covers only journals with a JIF (drops most AHCI/ESCI).
- **Known limits:** OpenAlex refreshes from Clarivate on a lag (weeks to months). Newly added ESCI journals may not flip to `is_core: true` immediately.

### DOAJ — OpenAlex flag

- **Signal:** `is_in_doaj` on the same OpenAlex endpoint
- **Seeder:** same file as WoS, same walk
- **Why OpenAlex:** We originally built a seeder that fetched [doaj.org/csv](https://doaj.org/csv) (24 MB, ~35k journals) and loaded the whole thing. That bloats the canonical table with 99%+ journals we'll never match. The OpenAlex flag is the same truth, scoped to journals we actually care about.

### SciELO — articlemeta (OpenAlex fallback rejected)

- **Signal:** ISSN present in [articlemeta.scielo.org/api/v1/journal/identifiers/](https://articlemeta.scielo.org/api/v1/journal/identifiers/) — paginates ~2,258 codes at 1,000 per page
- **Seeder:** [seeders/scielo-articlemeta.js](seeders/scielo-articlemeta.js)
- **Why NOT OpenAlex:** OpenAlex has an `is_in_scielo` field, but we verified it under-reports. Specific case: *Maderas. Ciencia y tecnología* (print 0717-3644, online 0718-221X) is a UTalca flagship confirmed in the Chilean SciELO collection (`articlemeta.scielo.org/api/v1/journal/?collection=chl&issn=0718-221X`); OpenAlex returns `is_in_scielo: false` for both ISSNs. Full probe: see the April 2026 investigation in conversation memory.
- **Why it works now:** Sibling ISSN tags mean we match SciELO's online ISSNs even though our primary ext_id is the print form.

### Scopus — Elsevier Serial Title API

- **Signal:** `GET https://api.elsevier.com/content/serial/title/issn/<ISSN>` — 200 = in Scopus, 404 = not in Scopus. The STANDARD view returns `coverageEndYear`; a current-year value indicates active indexation vs. discontinued.
- **Seeder:** [seeders/scopus-elsevier.js](seeders/scopus-elsevier.js)
- **Auth:** Requires `ELSEVIER_API_KEY` env var (in Vercel production and local `.env.local`). Key generated at [dev.elsevier.com](https://dev.elsevier.com) from an institutional IP; full data access assumes the institution has a Scopus subscription (UTalca does).
- **Quota:** 20,000 requests / rolling 7 days. Current UTalca corpus is 272 distinct journal ISSNs — ~1.3% of quota per seed.
- **Why API, not XLSX:** Elsevier publishes the Scopus source list as a monthly XLSX download, but the CDN URL rotates per release and the XLSX requires a parser dependency. The API is symmetric with the OpenAlex path and has no extra dependency.
- **Alternatives considered and rejected:** OpenAlex exposes no Scopus flag; stale GitHub/Kaggle mirrors of the XLSX (dhimmel/scopus, community Kaggle sets) drift quickly; Wikidata's P1156 Scopus IDs are incomplete.

## The orchestrator

[indexation-seed.js](indexation-seed.js) exposes two entry points, both invoked from [../api/indexation.js](../api/indexation.js):

- `runSeed(sourceId, { csv? })` — per-source. Used by Scopus, SciELO, and any future CSV source.
- `runOpenAlexSeed()` — runs the shared WoS+DOAJ walk against OpenAlex `/sources/issn:` once. Clears and backfills `indexed_in` tags for both.

Each path is: replace rows in `indexed_journals` for that source → clear `indexed_in` tags for that source → run `backfillIndexationTags()` to re-derive tags from the canonical table. Same contract whether the upstream was OpenAlex, Elsevier, or SciELO.

A maintenance action, `POST /api/indexation?action=reconcile`, wipes all `indexed_in` tags and rederives from the canonical table. Safe to run any time; idempotent.

## What downstream reads

- `lib/public-stats.js` → `getYearByIndexation` — stacked bar chart at `/t/{tenant}`. Filters through `listSourceIds()` from the registry; adding a source to the registry makes it chart-eligible automatically.
- `lib/indexed-backfill.js` → `tagIndexationForRecord` — called by both stores ([store.js](store.js), [store-openalex.js](store-openalex.js)) so newly ingested DOIs pick up indexation at write time without waiting for a full backfill.

## Historical context

An earlier writer path (`tagIndexedInFromOpenAlex`) pulled `indexed_in` arrays from OpenAlex's raw `/works/` JSON and wrote tags directly, bypassing `indexed_journals`. That produced PubMed tags we couldn't trace back to any canonical list, plus DOAJ/SciELO tags based on OpenAlex's (unreliable) flags. That path was retired April 2026; `indexed_journals` is now sole truth.

## Adding a new source

1. Add entry to `SOURCES` in [indexation-sources.js](indexation-sources.js).
2. Write a seeder in `lib/seeders/` that returns `{ count }` and writes to `indexed_journals` via `replaceIndex(sourceId, entries)`. Or build the seed function inline via `makeCsvSeeder` if it's CSV.
3. Wire into the registry row's `seedFn` (or leave null and handle via a group orchestrator like `runOpenAlexSeed`).
4. Run `runSeed(sourceId)` once against the live DB to populate.

No changes needed to the admin UI, the chart, or the stats layer — they all read through the registry.
