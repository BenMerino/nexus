# lib/ — backend modules

Shared modules for DB access, data fetching, normalization, and scope/auth. Import from `api/` routes.

## Data pipeline order

A DOI flows through these in order:

1. **`fetchers.js`** — fetch from all four sources in parallel via `Promise.allSettled`. Sources: CrossRef, OpenAlex, Semantic Scholar, DataCite. Each fetcher returns a normalized shape (`title`, `authors`, `journal`, `issnL`, etc.) or `null`.
2. **`normalize.js`** — merge the four source responses into one canonical `doi_record`. **Merge rule: first-non-null priority.** The first source with a value wins — later sources don't overwrite. Do not propose "last-source-wins" or "vote-based" merge strategies without discussing first.
3. **`normalize-authors.js`** — deduplicate authors across sources (by ORCID where available, by normalized name otherwise). Produces the `affiliations` JSON array stored on `doi_records`.
4. **`normalize-tags.js`** — extract tag rows to insert into the `tags` table.

## Tag taxonomy

Tag `category` values:

- `author` — ORCID in `ext_id` when available.
- `journal` — ISSN in `ext_id`. **One tag per ISSN**, not per journal. A journal with print + online ISSNs produces two sibling tag rows. Counts must use `COUNT(DISTINCT doi_record_id) GROUP BY value` (the display name), not by `ext_id`, to avoid inflated counts.
- `institution` — ROR in `ext_id`.
- `publisher`, `type`, `venue`, `year` — value-only.
- `indexed_in` — `value` names the source (Scopus, WoS, SciELO, DOAJ, etc.), `ext_id` holds the ISSN-L. See `lib/indexation-sources.js`.

## Indexation sources

Which journals are indexed where (Scopus / WoS / SciELO / DOAJ) is assembled from three different upstreams:

- **WoS, DOAJ** — OpenAlex flags (`is_core`, `is_in_doaj`) from `api.openalex.org/sources/issn:<issn>`.
- **SciELO** — articlemeta ISSN list (`articlemeta.scielo.org/api/v1/journal/identifiers/`). OpenAlex's `is_in_scielo` flag is unreliable for this source; do not use it.
- **Scopus** — Elsevier Serial Title API (`api.elsevier.com/content/serial/title/issn/<issn>`), requires `ELSEVIER_API_KEY`.

All four seed through one orchestrator and write to the canonical `indexed_journals` table. Full source-by-source rationale, quotas, and taxonomy in [indexation.md](indexation.md).

When proposing a new indexation source, read that doc first — several upstream paths we evaluated (doaj.org/csv, Clarivate MJL, JCR XLSX, GitHub/Kaggle mirrors) were rejected for reasons specific to this codebase.

## Scope + auth

- **`scope.js`** — `requireScope`, `isPersonalScope`. Every read-path API calls `requireScope`.
- **`auth.js`** — session cookie, role checks.
- **`db.js`** — `getAllTags(scope)` is the main branch point between personal and admin views.

For the full scope/role semantics, see [../ARCHITECTURE.md](../ARCHITECTURE.md).
