# Handoff — Chart Controller Parity (full Zincro machinery)

**Goal:** Every chart in nexus — present and future — routes through one blessed,
controller-owned path (Zincro's `useDirectiveController` + a single wrapper
component), so directive identity is always stable. This kills the legend-toggle
"reload" bug at the root and makes the inline-build-and-pass pattern impossible.

**Root cause of the reported bug (verified):** the graph *engine* is byte-identical
to Zincro and correct. The break is at the page layer — `tenant.tsx:63` calls
`buildTenantCharts()` **inline in render** (no `useMemo`), so a toggle-driven
re-render produces a fresh `GraphDirective`. New `chart.data` identity →
`useToggleFilters` re-seeds `activeSet` to all-active → deselection discarded =
"reload". (Same latent hazard in portfolio-velocity/cadence, filtered-charts, charts.)

**Decision:** Full Zincro parity (controller + wrapper + server composer migration
+ WS stream bridge + drill + persistence). Multi-session, additive, one phase at a
time, route URLs never change.

---

## What nexus ALREADY has (verified — do NOT recreate)

Byte-identical Zincro ports already sitting in `apps/web/architect/`, currently unused:
- `directive-controller-logic.ts` (95) — applyPersisted/sameQuery/applyToggleToQuery/nextPersisted/isAtomicVisibleWindowPatch
- `replayable-directive.ts` (83) — BaseQuery/ToggleSpec/ReplayableDirective/RecomposeResponse
- `stream-key.ts` (42), `stream-patch.ts` (74), `directive-stream-bridge.ts` (62, skeleton)
- `directive-toggle-persistence.ts` (23), `graph-drilldown.ts` (173)
- `graph-composer.types.ts` (295) — GraphDirective/GraphQuery with query/toggles/persistKey/streamKey/asOf/windowDays/atoms
- `GraphRender.tsx` (186) — already accepts onToggle/onWindowChange/onBucketClick/isLive/breadcrumbs/onDrillUp

Server today:
- `POST /api/architect/recompose` → `src/lib/architect-replay.js` (atoms; only `publications` kind)
- `GET /api/architect/charts` → `src/services/architect/StatComposer.ts` (4 kinds, scope-narrowed)
- `GET /api/architect/timeline-span/:tenantId/:kind`

## What's MISSING (the actual work)

1. `useDirectiveController.ts` — the hook itself. **Not present.** Zincro's is 297 lines → exceeds N5 (150) → must split.
2. A single blessed wrapper component (`<DirectiveChart>`) — **not present.**
3. Call-site refactor — 7 sites build directives client-side and pass to `<GraphRender>`.
4. WS layer — `isLive`/`directive.patch` is **greenfield** (no WebSocket/SSE anywhere in nexus).
5. Server composer migration — kinds currently built client-side (tenant-builders, etc.) so toggles can recompose against the DB.

## Constraints that shape the layout

- **N5 (≤150 lines)** applies to all ported `.ts/.tsx`. The 297-line controller splits into:
  `useDirectiveController.ts` (state + public API surface) + `directive-controller-stream.ts`
  (the bridge subscribe/onMessage/patch effects) + reuse the existing pure-logic file.
- **No telemetry module in nexus.** Zincro's controller imports `apiPost` from `../telemetry`.
  Swap for a thin local `recomposePost(query)` helper using `fetch('/api/architect/recompose')`
  (matches `tenant-replay-chart.tsx`'s existing fetch shape). Do NOT port the telemetry stack.
- **DGA Composer doctrine** ([governor-patterns.md]): directive composition belongs server-side
  (Composer role, no writes). Phase 4 migrates client builders → server composers behind recompose.
- **Build:** `apps/web` is Vite (handles .ts/.tsx directly, no extra config). New controller files
  live under `apps/web/architect/` or `apps/web/ui/graph-engine/` and bundle automatically.
- **N1/scope:** recompose handlers already pass through scope; any new composer kind must keep
  `requireScope` + tenant filter. No cross-scope leakage.

---

## Phases (additive; each independently shippable; route URLs unchanged)

### Phase A — Controller + wrapper (fixes the bug, enforces the invariant)
*Frontend only. No server changes. Builders stay client-side for now.*

1. Port `useDirectiveController.ts`, split for N5:
   - `useDirectiveController.ts` — useState(directive)/isLoading/error/isLive, setToggle,
     setQueryFields, refetch, drillDown, drillUp, breadcrumbs. Imports the existing
     `directive-controller-logic.ts` (already present).
   - `directive-controller-stream.ts` — `subscribeOverBridge`, the bridge `onMessage` effect,
     mount/unmount subscribe/unsubscribe. Returns the wiring the hook composes.
   - Replace `apiPost('/api/architect/recompose', {query})` with a local `recomposePost(query)`
     (`fetch`, JSON, returns directive). No telemetry import.
2. Create `<DirectiveChart>` wrapper (`apps/web/ui/graph-engine/DirectiveChart.tsx`):
   - `useDirectiveController(seed)` → passes `ctrl.directive` + all handlers to `<GraphRender>`.
   - Implements `handleBucketClick` via existing `graph-drilldown.ts` (`narrowQueryToBucket`).
   - This is THE only component pages use. Pages never touch `<GraphRender>` again.
3. Refactor `tenant.tsx`: `const charts = useMemo(() => buildTenantCharts(...), [statsPayload])`,
   render `charts.map(c => <DirectiveChart key={c.persistKey ?? i} seed={c} />)`. Retire
   `tenant-replay-chart.tsx` (controller subsumes its window/toggle logic).
4. Refactor the other 6 call-sites (portfolio-velocity, portfolio-cadence, filtered-charts,
   charts, dashboard-server-charts) to memoize their seed and render `<DirectiveChart>`.
5. Give each seed a stable `persistKey` (chart identity) so wrapper keys are stable.

**Exit criterion (the original bug):** deselect WoS on the UTalca stacked bar → segments fade
over ~280ms, no remount, deselection persists. Verify via `/run` or the `verify` skill on
`npm run dev:web` (port 9000).

### Phase B — Server composer migration + ENDPOINT UNIFICATION (DGA Composer role)
*Backend. Move directive construction server-side so toggles recompose against the DB,
AND reconcile the two disconnected server paths into one registry.*

**Decision (2026-06-02): unify both endpoints behind one `recompose-registry`.**
Goal = one server path mirroring the one client path. Today there are two:
- `/api/architect/charts` (GET, **scope-gated**, `StatComposer` → pre-folded snapshots)
- `/api/architect/recompose` (POST, **anonymous tenant-public**, `architect-replay.js` → atoms)

A single registry dispatches every chart `kind`. **Hard firewall on the auth boundary:**
each kind declares an `access: 'public' | 'scoped'` class. The public POST endpoint
REFUSES scoped kinds (404/400, never reads scoped data); the scoped GET endpoint runs
under `requireScope`. The dispatch enforces this per-kind — never trust the caller's
endpoint choice alone. A public kind physically cannot reach scoped reads.

6. For each client-built kind (tenant year/type/journal/collab/country, portfolio velocity/cadence),
   add a server composer behind `/api/architect/recompose` (extend `architect-replay.js`'s `KINDS`
   or, preferably, a new `GraphComposer` service under `src/services/architect/` per DGA, with a
   `recompose-registry` dispatch by `query.kind`). Each composer: `requireScope` → read repo →
   build `ServerGraphDirective` → return. No writes (Composer role).
7. Attach `streamKey = streamKeyFromQuery(query)` to every replayable directive on emit.
8. Pages fetch the seed from the server (or SSR) instead of `buildTenantCharts`; client builders
   become a thin fallback or are retired once every caller moves (separate cleanup pass — grandfather).

**Exit criterion:** a toggle that changes `windowDays`/`metric` recomposes server-side and swaps
the directive in state with no remount.

### Phase C — WS stream bridge (greenfield; lights up isLive/patch)
*New subsystem. The controller's isLive/directive.patch paths are already ported but dormant.*

9. Server: a `StreamRegistry` service + WS endpoint that accepts `stream.subscribe {query}`,
   computes the directive, emits `directive.value`, and on Governor invalidation events emits
   `directive.patch`. (This is where the DGA EventBus meets the client.)
10. Client: a `WebSocketConnector` that calls `setStreamBridge({isConnected,send,onMessage})` at
    boot. Once connected, controllers subscribe and `isLive` flips true; HTTP recompose stays the
    fallback. `stream-patch.ts`/`stream-key.ts`/`directive-stream-bridge.ts` already present.

**Exit criterion:** a Governor write (e.g. ingestion) pushes a `directive.patch`; an open chart
updates live with `isLive` badge, no client poll.

### Phase D — Drill + persistence polish
11. Wire `onBucketClick` drill end-to-end on time-series charts (breadcrumbs already in controller).
12. Confirm `persistKey` localStorage round-trips per chart; verify N7 (English chrome) on any new UI.

---

## Risks / watch-items
- **N5 splits**: the controller and any composer >150 lines must extract, not compress.
- **activeSet re-seed**: even with the controller, if a seed's `chart.data`/`series` identity churns,
  `useToggleFilters` re-seeds. Phase A's memoization + controller-owned state must guarantee the
  directive passed to `GraphRender` is referentially stable across toggle re-renders.
- **Telemetry**: do not port `../telemetry`. Local `recomposePost` only.
- **Grandfather**: keep client builders until every caller is moved; delete in a separate pass.
- **Scope/RLS**: every new server composer kind keeps `requireScope` + tenant filter (N1).
```
