---
paths:
  - "apps/api/src/lib/db*.js"
  - "apps/api/src/lib/sql.js"
  - "apps/api/src/db/**"
description: N4 data layer — the sql wrapper, per-domain db modules, migrations, no inline SQL in handlers.
---

# DB Layer (N4)

All SQL lives in `apps/api/src/lib/`; handlers stay thin (auth/scope → lib call → JSON). The frontend never touches a driver — only `fetch('/api/...')`.

## The `sql` wrapper (`lib/sql.js`)
A drop-in for `@vercel/postgres`'s tagged-template `sql`, backed by a long-lived `pg.Pool`. Don't import `@vercel/postgres` (that's the dead tree).
- `` sql`SELECT * FROM t WHERE id = ${id}` `` → `{ rows, rowCount }`. Interpolations become `$1,$2…` params — safe.
- `sql.query(text, params)` — for dynamically-built SQL (IN-list expansion).
- `db.query(text, params)` — raw, for DDL.
- Connection: `POSTGRES_URL`/`DATABASE_URL`. Internal Railway hosts (`*.railway.internal`) = plain TCP; external = SSL with `rejectUnauthorized:false`. (Internal host only resolves *inside* Railway — local scripts need the public proxy URL.)

## Per-domain modules
One file per concern, named `db-<domain>.js` (`db-users.js`, `db-projects.js`, `db-portfolio.js`, `db-list.js`, `db-indexes.js`) plus `db.js` (core records/tags + scope narrowing) and `db-schema*.js`. Add named query functions here; call them from handlers. Don't inline SQL in `handlers/*.js`.

## Migrations
- `apps/api/src/db/migrations/NNN_*.sql`, applied on boot by `runMigrations()` (`src/db/migrate.js`) from `index.js`. Current: `000_baseline`, `001_onboarding_roster`, `002_roster_orcid_backfill`.
- Schema changes = **a new numbered migration file**, never an inline `ALTER` / `addMissingColumns()` in app code (N2 hazard — and it won't run deterministically).
- All entity tables carry `tenant_id`; every query joins through a tenant-scoped table.

## Tag model gotcha
`tags` rows are emitted **one per ISSN**, not per journal (print + online siblings). Count "papers per journal" with `COUNT(DISTINCT doi_record_id)` grouped by name, not `ext_id`. Never normalize an external ID to one form on store — match the full sibling set (HEURISTICS H-001).
