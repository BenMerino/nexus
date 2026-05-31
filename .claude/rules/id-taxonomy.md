# ID Taxonomy (Nexus)

Adapted in spirit from Zincro's S23. Zincro uses ULIDs with composite PKs; **Nexus does not** — Nexus entities are integer `SERIAL` PKs with an `INTEGER tenant_id`. This rule documents the *actual* Nexus classes and the **entity-ref grammar** governors use for audit logs and conversation-bindings. Read when writing migrations or new entity types. Applies to `apps/api/src/db/migrations/**` and `apps/api/src/services/**`.

## Entity classes (what Nexus has today)

### Class A — tenant business entities
`id SERIAL PRIMARY KEY` + `tenant_id INTEGER REFERENCES tenants(id)`. The row is unique by its serial id; tenant scope is a column (and, post-RLS, an `app.tenant_id` policy). Examples: `doi_records`, `submissions`.

### Class B — child / junction tables (composite PK, no own serial)
PK is the parent key plus a discriminator; tenant inherited via the parent. Examples: `doi_concepts (doi_record_id, concept_id)`, `doi_citations_by_year (doi_record_id, year)`. `tags` is unique by `(category, value, tenant_id)` (one row **per ISSN**, not per journal — see [db-layer](db-layer.md) tag gotcha).

### Class C — auth / system / config
Framework-shaped, out of scope. Examples: `users`, `tenants`, `theme_tokens` (`key TEXT PRIMARY KEY`).

## Entity-ref grammar (audit + conversation-bindings)
A governor's `logToLedger` and the conversation `registerEntityKind` need a stable string ref for any row. Grammar: **`<kind>:<id>`** — lowercase singular kind, then the entity's own id. Composite/child rows join parts with `:`.
- `publication:1247`, `author:0000-0002-…`, `venue:2049-3630`, `institution:03e8d3c79`, `project:42`
- child: `concept:1247:C2779…`, `citationYear:1247:2024`

Kinds are the singular domain noun (matches the EventBus domain and the conversation entity-kind). Register each new kind's grammar in [docs/DGA_DESIGN.md](../../docs/DGA_DESIGN.md) §Entity refs.

## Enforcement
- New tenant-scoped tables carry `tenant_id INTEGER` and (post-RLS) get a policy. Do not invent UUID/ULID ids — stay on `SERIAL` to match the existing schema and the integer `tenant_id` that the GUC casts `::int`.
- Schema changes = **a new numbered migration** (`src/db/migrations/NNN_*.sql`), never inline `ALTER`/`addMissingColumns()` (N2 hazard). NB: `db-schema.js` currently violates this with `safe("ALTER … ADD COLUMN IF NOT EXISTS")` — a pre-existing debt; new work uses migrations.
