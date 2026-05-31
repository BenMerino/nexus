# Anti-Patterns (NEVER DO)

The known bad paths. Each maps to an invariant in `.claude/rules/hard-rules.md`.

## 1. Scope bypass (N1)
- **NEVER** read tenant data without `requireScope` — no hand-rolled `WHERE tenant_id = …`, no trusting a client-supplied tenant id.
- **NEVER** gate a tenant-management write on `role` alone — honor `tenant_admin` (use `requireEditor`). The frontend `isEditor()` must mirror the backend gate.
- **NEVER** hardcode a tenant id.

## 2. Editing the dead tree (N2)
- **NEVER** edit root `api/`, `lib/`, `public/`, or `legacy/` — those don't deploy. The live tree is `apps/api/` + `apps/web/`. A whole feature was once "shipped" into root `lib/` and did nothing.
- **NEVER** change schema with an inline `ALTER` / `addMissingColumns()` — add a numbered `apps/api/src/db/migrations/NNN_*.sql`.

## 3. Token bypass (N3)
- **NEVER** hardcode a hex color in chart or component code — map to a semantic token (`--primary`, `--journal`, `--ok`…).
- **NEVER** reference `--chart-N` — it doesn't exist; it silently falls through to a hex fallback.
- **NEVER** hardcode `px`/`rem` in CSS — use `var(--space-*)`/`var(--radius-*)`. Exceptions: `0`, `100%`, `100vh/vw`, `1px` borders, `@keyframes`.

## 4. Fat handlers / leaked data layer (N4)
- **NEVER** write SQL inline in `handlers/*.js` — put named queries in `lib/db*.js`.
- **NEVER** import a DB driver or use a secret in frontend code — the browser reaches data only via `fetch('/api/...')`.
- **NEVER** import `@vercel/postgres` — use the local `lib/sql.js` wrapper.

## 5. FOUC / theme (N6)
- **NEVER** remove the `vite.config.ts` no-FOUC boot script when refactoring HTML.
- **NEVER** statically import `shell-mount.tsx` — it runs `mount()` on import; use the lazy import.
- **NEVER** gate a page's data fetch on `window.load` — use `DOMContentLoaded`/immediate (the "works on reload" bug).

## 6. File size (N5)
- **NEVER** dodge the 150-line limit by compressing (one-lining `useMemo`/`if`, stripping comments). Refactor — extract a cohesive chunk into a sibling file.

## 7. Lossy ID normalization (HEURISTICS H-001)
- **NEVER** normalize an external ID (ISSN, ORCID, ROR) to a single canonical form on store — keep every sibling and match the full set. Different sources key on different ISSNs.

## 8. Mixed language (N7)
- **NEVER** introduce Spanish UI chrome. Exempt: proper nouns, stored DB data, and CSV column matchers. When translating data-bound labels, flag the migration — don't silently desync.
