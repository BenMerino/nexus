---
paths:
  - "apps/web/public/claustro-*.js"
  - "apps/web/public/proyectos.html"
  - "apps/web/public/org-claustro.*"
  - "apps/api/handlers/projects.js"
  - "apps/api/handlers/claustro.js"
  - "apps/api/src/lib/claustro*.js"
description: The Projects + Faculty (claustro) accreditation subsystem — file map, gating, and how the pieces split.
---

# Claustro / Projects Feature

CNA accreditation tooling for UTalca: funded **projects** feed the antecedents the CNA later uses to assign each researcher a **faculty (claustro)** profile. Three surfaces, deliberately split:

| Surface | Where | What |
|---|---|---|
| **Projects** | standalone nav item → `proyectos.html` | manage funded projects (CRUD) |
| **Faculty** | tab on Organization page (`org-scheme.html`, `#claustro`) | read-only classification: program cards + core-faculty table |
| **Accepted indices** | Settings card | which citation indices count as "qualified" (drives the classification) |

## Frontend file map
- **Projects** (`proyectos.html`): `claustro-app.js` (orchestrator: fetch me → gate → load projects), `claustro-projects-ui.js` (filters/list/form open-close), `claustro-form.js` (form template), `claustro-form-bind.js` (form events/collect), `claustro-funding.js` (funding sources + `fmtCLP`), `claustro-render.js` (project cards/stats), `claustro.css`. *(The `claustro-*` filenames are historical — these modules serve the Projects page.)*
- **Faculty tab**: `org-claustro.js` (self-contained: lazy-loads on tab open, renders program cards + roster table; reads `/api/claustro?action=validate-all`), `org-claustro.css`.
- **Indices**: `settings-indices.js` (Settings card; `/api/claustro?action=indices`).

## Backend + gating
- `handlers/projects.js` — list/get via `requireScope`; create/update/delete via **`requireEditor`** (N1: editors *and* `tenant_admin`).
- `handlers/claustro.js` — `validate-all`/`indices` reads via `requireScope`; `PUT indices` via `requireEditor`.
- `src/lib/claustro.js` — classification logic; `claustro-reasons.js` — the per-program reason strings (English, N7). `db-projects.js` — project queries.

## Notes
- Frontend gate `isEditor()` must mirror `requireEditor` (role list **or** `state.me.tenantAdmin`) — they drifted once and blocked a tenant_admin.
- Grade comparisons use stored Spanish data values (`"Doctor"`, `"Magíster"`) — that's DB data, not UI (N7 exempt). UI labels are English.
- Faculty/funding dropdown names were translated (N7); existing rows keep their stored values until a data migration.
