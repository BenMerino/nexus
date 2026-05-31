# HEURISTICS.md — hard-won gotchas

Append-only manifest of platform-specific discoveries that aren't (yet) machine-enforced. Each entry: **Context / Why / Do / Don't**.

**Promotion protocol:** when a heuristic becomes a named invariant (`N-`) or an audit check, replace its body here with a one-line pointer. Ported from per-user agent memory on 2026-05-31 so it travels with the repo.

---

## H-001 — One journal tag per ISSN, never normalized
**Context:** `tags` table, journal normalization, any "papers per journal / indexed in X" query.
**Why:** A journal often has print + online ISSNs (e.g. Maderas: 0717-3644 / 0718-221X). External sources key on *different* ISSNs — SciELO uses online, OpenAlex `issn_l` returns print. Storing only ISSN-L silently lost matches (SciELO seeder returned 0 of 143 UTalca journals).
**Do:** Emit one `(category='journal', …, ext_id=<issn>)` row per entry in OpenAlex's `issn[]` array. Count "papers per journal" with `COUNT(DISTINCT doi_record_id)` grouped by journal *name* (siblings would double-count by `ext_id`).
**Don't:** Normalize an external ID to a single canonical form on store — match against the full sibling set instead.

## H-002 — OpenAlex already exposes indexation flags
**Context:** "is journal X indexed in WoS/Scopus/SciELO/DOAJ" features.
**Why:** `/sources/issn:<issn>` returns `is_core` (WoS Core), `is_in_doaj`, `is_in_scielo`. A planned 3-seeder architecture (articlemeta + DOAJ CSV + Clarivate MJL) was deleted once we found OpenAlex covers 3 of 4. Only Scopus needs a manual CSV.
**Do:** Before adding a seeder, external feed, or manual-upload flow for indexation metadata, check the OpenAlex source record first. Default assumption: if it's public indexation metadata, OpenAlex has it.

## H-003 — `shell-mount.tsx` is a side-effect import
**Context:** Frontend bootstrap; the sidebar React mount.
**Why:** `shell-mount.tsx` runs `mount()` at top level on import. A static import from the wrong place runs `mount()` before `#sidebar-mount` exists → the sidebar silently fails to render for everyone.
**Do:** Reach it only via the lazy `import("../shell-mount")`. Keep side-effect-free theme helpers in `spa/theme-config.ts` so config pages can import them without triggering the mount.

## H-004 — Gate frontend startup on DOMContentLoaded, not `window.load`
**Context:** Per-page bootstrap scripts (bundled deferred ES modules).
**Why:** `window.load` waits for *every* sub-resource (fonts, preloaded chunks). On a cold first visit it fires late enough that the page looks broken and the user reloads — the classic "works on reload" bug. A deferred module already runs after the DOM is parsed.
**Do:** `if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();` (matches `admin-indexation.js`).

## H-005 — `scrollbar-gutter: stable` kills content jitter
**Context:** `.main` scroll container with a centered/`max-width` `.view`.
**Why:** On first paint the lists are empty (no scrollbar); when data loads the content overflows, the vertical scrollbar appears and steals width, shifting the whole content area sideways while the sidebar (its own grid column) stays put.
**Do:** Reserve the gutter permanently on the scroll container so width is constant from first paint.

## H-006 — No-FOUC needs cached theme tokens pre-paint
**Context:** Light/dark + the 7 configurable surface tokens (N6).
**Why:** Mode is chosen pre-paint, but the configured `--bg`/`--fg` come from an async `/api/theme-tokens` fetch — so a customized palette flashed from CSS baseline to configured value after first paint.
**Do:** `loadThemeTokens` caches the response in `localStorage['nexus.theme-tokens']`; the boot script applies the active mode's surface tokens before any style computation. First-ever visit still flashes once (empty cache). Keep the boot script's slug list in sync with `SURFACE_TOKEN_KEYS`.

## H-007 — Ego/coauthor styling needs a matching author tag
**Context:** Graph explorer; `egoAuthorId` resolved from `me.profile.orcid`.
**Why:** Many users have an `orcid` but **no** matching `author` tag (no papers under that ORCID in the corpus). With no match there's no ego — coauthor layer and focus-path silently degrade to "everyone is just an author."
**Do:** When ego/coauthor styling is missing, first check whether the logged-in user's ORCID actually has tags in the corpus before assuming a code bug. There is no hardcoded primary user.

## H-008 — Personal vs admin scope show different graphs (by design)
**Context:** `requireScope` → `isPersonalScope` branch in `lib/db.js` queries.
**Why:** Personal scope (non-admin + ORCID) filters to the user's own author tag, home institution, and journals on their papers — no co-authors, no external institutions. Admin/superadmin sees the full tenant graph. So the same page renders radically different data by role.
**Do:** Anything needing co-author data under personal scope must bypass the tag query (e.g. `lib/portfolio-coauthors.js` directly). Don't "fix" a sparse personal-scope graph as if it were a bug.

## H-009 — Stacked charts have no replay slider yet
**Context:** Atom-based interactive charts (time slider) ported from Zincro's graph-engine.
**Why:** The slider is wired only to plain-bar charts. UTalca's "Publications by Year" is stacked (WoS/Scopus/SciELO/DOAJ); the publications atoms carry only a flat `value`, so the stacked renderer finds no per-series fields and bars vanish — hence the slider is restricted to plain bars.
**Do:** To finish, emit a per-series recompose variant (per-day counts per index; data is per-record via `indexed_in` tags). Atom key MUST be hours-since-anchor (`dayIdx*24`) — the engine's span math divides by 24. (Work paused; see `docs/replay-backend-plan.md`.)

---

### Promoted to invariants (see `.claude/rules/hard-rules.md`)
- *Shipping into the dead root `api/`/`lib/`/`public/` tree* → **N2 (Live Tree Only)**.
- *Inventing `--chart-N` / hardcoding chart hex* → **N3 (Token-Sourced Styling)**.
