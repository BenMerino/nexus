# Nexus Architecture

Cross-cutting invariants. If you're working on a specific layer, this doc points you at the right module; it doesn't duplicate what's already in the code.

## Data model

Three tables, all in `lib/db.js`:

- **`submissions`** — inbound DOI submissions with source tracking.
- **`doi_records`** — canonical paper records (title, abstract, citation counts, affiliations JSON, year, open-access flags).
- **`tags`** — normalized facets on a `doi_record`: `category` (author, journal, publisher, type, institution, venue, year, indexed_in), `value` (display string), `ext_id` (canonical identifier — ORCID, ROR, ISSN, etc.), `doi_record_id` FK.

All rows are tenant-scoped via `doi_records.tenant_id` (multi-tenant). Every query joins through `doi_records` to enforce tenant isolation.

## Scope model

Every API that reads data calls `requireScope(req, res)` from `lib/scope.js`. The returned scope has `{ tenantId, orcid, ror, role, userId, username }`.

`isPersonalScope(scope)` returns true when `role !== "superadmin" && role !== "admin" && !!orcid` — i.e. a researcher logged in with an ORCID. This is the critical branch point: personal-scope queries in `lib/db.js:getAllTags` filter to only rows where the tag is:

- the user's own author tag (`category='author' AND ext_id=orcid`), OR
- the user's home institution (`category='institution' AND ext_id=ror`), OR
- any journal tag on one of the user's papers.

Admin/superadmin scope sees all tenant rows unfiltered.

**Consequence:** the graph explorer and dashboard show radically different data depending on role. A personal-scope explorer shows 1 author node (the user), their home institution, and journals — no co-authors, no external institutions. Anything that needs co-author data (like the dashboard's co-author graph preview) bypasses the tag query and calls `lib/portfolio-coauthors.js` directly.

## Role hierarchy

`users.role` values:

| Role | Personal scope? | Sees |
|---|---|---|
| `superadmin` | No | All tenants (`scope.tenantId` switchable). |
| `admin` | No | Full tenant graph. Can run imports, manage users. |
| `director` | Yes (with ORCID) | Personal scope — only their papers + facets. |
| `academic` | Yes (with ORCID) | Personal scope. |

Roles are enforced at the API layer via `requireRole()` from `lib/auth.js`. The scope filtering in `lib/db.js` does the actual data narrowing.

## Auth flow

- **Login:** `POST /api/auth?action=login` with body `{ user, pass }`. Response: `{ ok, user, role }`. Sets cookie `nexus_logged_in=1` + session cookie.
- **Session check:** `GET /api/auth?action=me` returns `{ user, role, tenant, profile, hIndex }`. HTML pages gate on the cookie before loading bundles.
- **Logout:** `GET /api/auth?action=logout` — 302 to `/login.html`.

Session is signed via `makeSessionCookie` (see `lib/auth.js`). Every authenticated endpoint calls `requireScope` (for scope) or `requireRole` (for role gate).

## Frontend bundle map

`build.js` produces six bundles. HTML pages load them via `<script type="module">`:

| HTML page | Bundle | Purpose |
|---|---|---|
| `dashboard.html` | `dashboard-bundle.js` | Role-aware dashboard (researcher vs institutional). |
| `overview.html` | `relationships-bundle.js` | Graph explorer — force-directed D3 view. |
| `collaborators.html` | `collaborators-bundle.js` | Suggested collaborators panel. |
| `tenant.html` | `tenant-bundle.js` | Tenant admin view (authors, graph, sidebar). |
| `admin.html`, `author-import.html`, `explore.html`, `settings.html`, `submit.html`, `tag-manager.html` | `shell-mount-bundle.js` | Shared shell (sidebar + nav + user chrome). Page-specific JS loads separately (e.g. `explore-records.js`). |
| `index.html`, `login.html` | (none) | Static splash / login form. |

`charts-bundle.js` is built but currently unreferenced — carry it along or remove with `build.js` if confirmed dead.

## Graph engine

`graph-engine/` is a self-contained module set for D3-powered visualization. Used by multiple bundles. Contains:

- **Renderers:** cartesian, grid, radial, polar.
- **Force simulation:** shared d3-force setup helpers.
- **Spatial types:** `graph-spatial.types.ts`.
- **Interaction:** drag-range, toggle bar, legibility alerts.
- **Color scales + legends.**

Treat it as a reusable library. Don't reach into its internals from page bundles; import via `graph-engine/index.ts`.
