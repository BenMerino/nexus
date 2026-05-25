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

## STATUS (paused 2026-05-25)

Done + deployed:
- White charts fixed (palette tokens in shared.css).
- Backend live: `GET /api/architect/timeline-span/:tenantId/:kind`,
  `POST /api/architect/recompose` (publications kind, day→hour-key atoms).
- Slider wired on PLAIN-bar publications charts via `tenant-replay-chart.tsx`
  (loads all-time atoms once, folds locally).

Paused here. Known gap: the slider is attached only to plain-bar charts.
**UTalca's year chart is STACKED (WoS/Scopus/SciELO/DOAJ)** so it has NO slider —
flat-value atoms empty the stacked series. To finish: add a per-series recompose
variant emitting per-day counts per index (data is per-record via `indexed_in`
tags, date-joinable), so stacked charts get a working slider with series intact.
Then resume phases 5 (user-ui-prefs) and 6 (other charts, drill-down).

## Risk / honesty
- Largest risk is Phase 4 wiring: the engine's `sliderActive` needs
  `windowToggle && tenantId && kind && span && onWindowChange` ALL present and
  the atom/fold contract exactly right, or the slider silently won't show.
- A slider that appears but re-renders identical data is worse than none —
  each phase has a concrete "different input → different output" verification.
