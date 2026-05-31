---
paths:
  - "apps/api/handlers/**"
  - "apps/api/src/lib/scope.js"
  - "apps/api/src/lib/auth.js"
  - "apps/api/src/lib/db.js"
description: N1 scope/role enforcement — requireScope, requireRole, requireEditor, personal-scope narrowing.
---

# Scope Model (N1)

Every handler that reads tenant data gates on scope; every write gates on role/capability. This is the only fatal-error boundary in Nexus.

## The three gates (`apps/api/src/lib/`)
- **`requireScope(req, res)`** (`scope.js`) → `{ tenantId, orcid, ror, role, userId, username, tenantAdmin }` or sends 401 and returns null. Use for **reads**. The returned scope is what you pass to db functions — never hand-roll a `WHERE tenant_id`.
- **`requireRole(req, ...roles)`** (`auth.js`) → session or null. Use for **role-gated writes** (e.g. superadmin-only).
- **`requireEditor(req)`** (`auth.js`) → session or null. Passes for `secretary/director/admin/superadmin` **OR** `tenant_admin === true`. Use for tenant-management writes (projects, indices).

Pattern: `const scope = await requireScope(req, res); if (!scope) return;` then call a `lib/db*.js` function with `scope`.

## tenant_admin is a capability, not a role
`users.tenant_admin` (boolean) is separate from `role`. `role` = data scope; `tenant_admin` = admin capability over the user's **own** tenant only. One person can be `role=academic` (personal scope) AND `tenant_admin` (e.g. Héctor Quinteros). Anywhere you gate "can manage X for this tenant," honor `tenant_admin`, not just role.

## Personal vs admin scope (the branch that changes everything)
`isPersonalScope(scope)` is true for a non-admin with an ORCID. Personal-scope reads in `db.js` narrow to: the user's own author tag (`category='author' AND ext_id=orcid`), their home institution (`ext_id=ror`), and journals on their own papers — **no co-authors, no external institutions**. Admin/superadmin see the full tenant graph.

- The same page renders radically different data by role — that's intended, not a bug (HEURISTICS H-008).
- Co-author data under personal scope must bypass the tag query (`lib/portfolio-coauthors.js`).
- A user's ORCID with **no** matching author tag → no ego, degraded explorer (HEURISTICS H-007).

## Roles
`superadmin` (all tenants, switchable) · `admin` (full tenant, imports/users) · `director`/`academic` (personal scope with ORCID). Enforced at the API layer; the narrowing happens in `db.js`.
