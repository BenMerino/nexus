# Plan: Atom-Based Replay Backend (interactive tenant charts)

Goal: make the newer graph-engine's interactive controls — **time-range slider,
query toggles, feature overlays, drill-down** — actually work on the tenant
charts (and reusable elsewhere). Today these are dormant: the engine supports
them, but no backend or wiring drives them anywhere in Nexus.

## Why this is a real build, not a flag

The engine is **atom-based**. A chart is built from finest-grain "atoms"
(one per day), folded into buckets at render time; the slider/toggles mutate a
`GraphQuery` and re-fetch. None of the services that feed this exist in `apps/api`.

### Backend pieces — current status

| Piece | Status | Contract |
|---|---|---|
| Atom source (`GraphDirective.atoms`) | ❌ missing | `Atom { key, label, iso?, hour?, value, weight?, [series] }` (fold-atoms.ts:61) |
| Timeline span | ❌ missing | `GET /api/architect/timeline-span/:tenantId/:kind` → `{ earliest, today, totalDays }` (useTimelineSpan.ts:23) |
| Recompose (replay) | ❌ missing | `POST /api/architect/recompose` ← `GraphQuery` → fresh `GraphDirective` |
| Kind→builder registry | ❌ missing | server dispatch on `query.kind` |
| User UI prefs | ❌ missing | `GET/PUT /api/user-ui-prefs/:scopeKey` (useUserUiPref.ts:23) |
| Legacy static graph/metadata | ✅ exists | not replay-aware |

## Phased plan (each phase independently shippable + verifiable)

### Phase 1 — Safe wins now (no replay needed)
- Add missing `xLabel`/`yLabel` on heatmap, collab, donut in `tenant-builders.ts`.
- Verifiable immediately on `/t/utalca`. Ships value while the rest is built.

### Phase 2 — Timeline span endpoint
- `GET /api/architect/timeline-span/:tenantId/:kind`.
- For the tenant publications "kind": min/max `published` date in `doi_records`
  scoped to tenant → `{ earliest, today, totalDays }`.
- Verify: curl returns correct span for utalca.

### Phase 3 — One atom builder + recompose endpoint
- Define ONE `kind` first: `tenant-publications-timeline`.
- Builder: given `{ tenantId, windowDays, asOf, foldUnit }`, query doi_records,
  emit daily `Atom[]` (key = hours-since-anchor, iso, value = pub count).
- `POST /api/architect/recompose` dispatches by `kind` → builder → `GraphDirective`
  with atoms. Start with the year/timeline chart only.
- Verify: POST a query with windowDays=365 vs null → different atom sets.

### Phase 4 — Wire the tenant page
- `buildYearChart` directive gains `query: { kind, tenantId, windowDays, asOf }`
  + a `windowDays` toggle + (optionally) other toggles.
- `tenant.tsx` passes `onWindowChange`/`onToggle` that POST to recompose and
  swap the directive. Reuse Zincro's directive-controller logic if present
  (`architect/directive-controller-logic.ts`), else a thin local controller.
- Verify: slider appears on the year chart and dragging re-renders real data.

### Phase 5 — User UI prefs (feature toggles persistence)
- `GET/PUT /api/user-ui-prefs/:scopeKey` backed by a `user_ui_preferences`
  table (migration). Enables trendline/MA feature toggles to persist.
- Verify: toggle a feature, reload, it sticks.

### Phase 6 — Extend to remaining charts + drill-down
- Add builders/queries for type/journal/collab/country as warranted.
- Drill-down (`onBucketClick`, breadcrumbs) last — heaviest, optional.

## Decisions to confirm
- **Public vs auth**: the tenant page is PUBLIC (anonymous). Recompose for it
  must be an unauthenticated, tenant-scoped, read-only endpoint (rate-limited).
  UI-prefs (Phase 5) only make sense for logged-in users — skip on public page.
- **Scope of kinds**: start with publications-timeline only; expand on demand.
- **Reuse vs reimplement** the client controller from architect/ if it's intact.

## Data precision finding (verified 2026-05-25)

`doi_records.published` precision across the corpus:
- **full YYYY-MM-DD: 26,392 (99.99%)** · year-only: 2 · missing: 1

So atoms can carry real `iso` dates at **day resolution** — the engine folds to
day/week/month/year honestly, no synthetic-date hacks. The current year-only
charts are purely an artifact of the query slicing `SUBSTRING(published,1,4)`;
the fix is to read the full date. The 3 non-full rows are filtered out.

## STATUS (re-verified 2026-06-03 — earlier "paused" status was stale)

The 2026-05-25 pause note below is **superseded**: later, undocumented work
solved the stacked blocker AND built all of Phase 5. Verified state today:

Done + deployed:
- White charts fixed (palette tokens in shared.css).
- Backend live: `GET /api/architect/timeline-span/:tenantId/:kind`,
  `POST /api/architect/recompose` via a **kind registry**
  (`apps/api/src/services/architect/recompose-registry.ts`) with three kinds:
  `publications` (flat atoms), `publications.byIndex` (**per-series atoms** —
  WoS/Scopus/SciELO/DOAJ siblings, `public-stats-atoms.js:49-87`), and
  `publications.cadence`.
- **The "stacked blocker" is SOLVED.** `publications.byIndex` already emits the
  per-series atom shape (`atom[seriesKey]`) the stacked renderer needs
  (`place-atoms.ts` `seriesValues`). It just renders via one-shot `RecomposeChart`
  with no slider/toggles wired — the data is ready, the controller wiring isn't.
- **Phase 5 is DONE**: migration `010_user_ui_prefs.sql`, `GET/PUT
  /api/user-ui-prefs/:scopeKey`, `db-ui-prefs.js`, and the `useUserUiPref` hook
  all exist and are live.

Actual remaining work (see this session's plan):
- **A. Toggle builder** — Nexus has NO `graph-toggles.ts`; port Zincro's
  `rangeToggle`/`granularityToggle`/`rangeAndGranularityToggles` (types
  `ToggleSpec`/`GraphQuery` + `eligibleFoldUnits` already exist locally). Adds
  the granularity/fold pills (today only a hand-built range toggle exists).
- **B. Wire the stacked byIndex chart** through the controlled `DirectiveChart`
  path (give it `query` + toggles) instead of `RecomposeChart` → slider on the
  UTalca year chart.
- **C. New temporal sources** — citation velocity is still a static directive;
  needs a citations-by-day atom builder + kind. Type-by-year heatmap can gain
  year↔decade fold toggles.
- **D. Persist toggle/feature state** via the existing `useUserUiPref` (auth
  pages only — public tenant page is anonymous).
- **PREREQUISITE for the velocity score**: the engine has no flat single-value
  `metric`/`stat` chart type (gauge/progress-ring need an arc max; a raw score
  like 140405.50 has none). The "Citation velocity / 140405.50 / score" block is
  hand-built JSX in `VelocityPanel`, outside the engine — port Zincro's KPI/stat
  type first so it becomes a directive that inherits title + caption mechanics.

## Risk / honesty
- Largest risk is Phase 4 wiring: the engine's `sliderActive` needs
  `windowToggle && tenantId && kind && span && onWindowChange` ALL present and
  the atom/fold contract exactly right, or the slider silently won't show.
- A slider that appears but re-renders identical data is worse than none —
  each phase has a concrete "different input → different output" verification.
