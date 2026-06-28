import React from 'react';
import { BaseBox } from '../primitives/BaseBox.js';
import { BaseText } from '../primitives/BaseText.js';
import { ChartRender } from './ChartRender.js';
import { LegibilityAlert } from './LegibilityAlert.js';
import { QueryToggleBar } from './QueryToggleBar.js';
import { useChartFeatureToggles } from './FeatureToggleGroup.js';
import { WindowRangeControl, GranularityControl, FeatureToggleControl, PeriodPickerControl } from './ChartHeaderControls.js';
import { coarserPeriods } from './chart-tier-groups.js';
import { LiveBadge } from '../composed/LiveBadge.js';
import { DrillBreadcrumbChip } from './DrillBreadcrumbChip.js';
import { foldOpensFiner } from '../../architect/fold-atoms.js';
import { gateFoldUnitToggles } from './chart-foldunit-gate.js';
import { rangeValueFromQuery, windowPatchFromRange, periodKeyLabel, shortRangeLabel, emptyRangeValuesFor } from './chart-range-window.js';
import { narrowQueryToPeriod } from '../../architect/graph-drilldown.js';
import type { GraphDirective, GraphQuery } from '../../architect/graph-composer.types.js';
import type { ToggleSpec } from '../../architect/replayable-directive.js';

/* ── ChartBody ───────────────────────────────────────────────
 * Renders the title row (title + range chip + toggles + LiveBadge) and
 * the chart canvas via the family-router. Time navigation:
 *   - COARSE: the DateRangePicker chip (presets + custom dates) commits
 *     whole windows via `onWindowChange`; a picked range that IS a
 *     calendar period carries its `periodKey` identity.
 *   - FINE: click-to-drill (bar/period → its sub-periods; breadcrumb
 *     drills out) + the granularity pills.
 * The continuous windowDays slider stays removed — arbitrary windows
 * produced partial edge buckets; the resolver snaps picked windows to
 * whole buckets instead. Extracted from GraphRender to keep that file
 * under the NBR-15 ceiling. The renderer above (GraphRender) handles the
 * resolved directive (post-fold, post-morph) and passes it here.
 * ──────────────────────────────────────────────────────────── */

export interface ChartBodyProps {
    chart: GraphDirective;
    resolved: GraphDirective;
    container: { width: number; height: number };
    legibility: 'ok' | 'tight' | 'illegible';
    axesOverride?: string;
    onBucketClick?: (idx: number, label: string, totalBuckets: number, daysPerBucket: number, atomKeyRange?: [number, number], periodKey?: string) => void;
    onToggle?: (toggleId: string, value: string) => void;
    /** Pie-isolate, radar-series-isolate, etc. — fired when a primitive
     *  with a `series` or `label` payload is clicked. ChartRender
     *  routes the click to whichever toggle key matches the primitive. */
    onToggleSeries?: (key: string) => void;
    onWindowChange?: (window: { windowDays: number | null; asOf: string | null; periodKey?: string }) => void;
    isLoading: boolean;
    error?: string | null;
    t: string;
    isLive?: boolean;
    /** Show the live/paused badge. Off by default — the badge is opt-in
     *  chrome, not something every live-wired chart should advertise. A
     *  host that wants it passes `showLive`; `isLive` still drives the
     *  active/paused state when shown. */
    showLive?: boolean;
    /** Drill breadcrumbs from `useDirectiveController` — when non-empty,
     *  a "← Back" chip + trail renders in the title row. The chart is
     *  the right owner of this chrome: putting the chip outside the card
     *  (as a sibling row above) makes the whole segment grow vertically
     *  whenever drill state appears. Inside the title row it's a peer
     *  of the toggle pills + LiveBadge and changes no card geometry. */
    breadcrumbs?: { label: string }[];
    onDrillUp?: () => void;
}

export function ChartBody({ chart, resolved, container, legibility, axesOverride, onBucketClick, onToggle, onToggleSeries, onWindowChange, isLoading, error, t, isLive, showLive = false, breadcrumbs, onDrillUp }: ChartBodyProps) {
    const allToggles = chart.toggles ?? [];
    const windowToggle = allToggles.find(tg => tg.id === 'windowDays' || tg.field === 'windowDays') as ToggleSpec<GraphQuery> | undefined;
    const otherToggles = allToggles.filter(tg => tg !== windowToggle);
    const tenantId = chart.query?.tenantId;
    const kind = chart.query?.kind;

    /* Feature opt-in state. Scoped per chart kind; stays empty until
     *  useUserUiPref resolves. The set is merged onto BOTH the
     *  pre-fold `chart` (so the toolbar's catalog read carries it for
     *  enrichments downstream) and the post-fold `resolved` (so the
     *  dispatcher filters by it at primitive-compute time). */
    const featureScopeKey = kind ? `chart:${kind}:features` : '';
    const featureToggles = useChartFeatureToggles(featureScopeKey);
    const featuresAvailable = chart.features ?? [];
    const hasFeatures = featuresAvailable.length > 0;
    /* Memoized — a fresh spread per render gives ChartRender a new `chart`
     *  identity every time, recreating its hover/click callbacks and
     *  re-rendering every memoized hit shape even when nothing changed. */
    const chartWithActive = React.useMemo(
        () => hasFeatures ? { ...chart, activeFeatures: featureToggles.activeKinds } : chart,
        [hasFeatures, chart, featureToggles.activeKinds],
    );
    const resolvedWithActive = React.useMemo(
        () => hasFeatures ? { ...resolved, activeFeatures: featureToggles.activeKinds } : resolved,
        [hasFeatures, resolved, featureToggles.activeKinds],
    );

    const q = chart.query as GraphQuery | undefined;
    const windowDays = q?.windowDays ?? null;

    /* daysPerBucket: current fold factor expressed in days. Atoms are
     * hour-resolution (HOURS_PER_DAY keys per day); visible bucket count
     * is `resolved.data.length`. Slider window slice is `windowDays`
     * (or full span when all-time). Cartesian drill-down only attaches
     * when `daysPerBucket > 1` — otherwise we're at finest granularity.
     * Heatmap drill always attaches; its narrowing math is atom-key
     * driven, not bucket-index driven. */
    const visibleBuckets = (resolved.data as unknown[]).length;
    /* Hour-resolution atom keys: span derives from `(lastKey - firstKey + 1) / 24`,
     *  not array length (heatmap atoms are sparse). */
    const atoms = chart.atoms ?? [];
    const totalDays = atoms.length === 0 ? 0 : (atoms[atoms.length - 1].key - atoms[0].key + 1) / 24;
    const visibleAtoms = windowDays != null ? Math.min(windowDays, totalDays) : (totalDays || visibleBuckets);
    /* Gate the granularity toggle to units readable at the CURRENT window, so
     *  the user can't force a fold that over-buckets (e.g. week over 170y). */
    const allGated = gateFoldUnitToggles(otherToggles, visibleAtoms);
    /* The manual foldUnit (auto-bucket / granularity) toggle is no longer a
     *  cramped pill ROW competing with the title — it now rides a popover
     *  (GranularityControl), like the window range and overlays. Split it out
     *  here; the remaining query toggles (e.g. scope) still render as pills. */
    const isFoldUnit = (tg: ToggleSpec<GraphQuery>) => tg.field === 'foldUnit' || tg.id === 'foldUnit';
    const granularityToggle = allGated.find(isFoldUnit) as ToggleSpec<GraphQuery> | undefined;
    const gatedToggles = allGated.filter(tg => !isFoldUnit(tg));
    const daysPerBucket = visibleBuckets > 0 ? visibleAtoms / visibleBuckets : 1;
    const isHeatmap = t === 'heatmap';
    /* Two independent drill paths share this handler, gated separately:
     *  - PLOT bucket clicks: only when the current fold OPENS (drilling a
     *    bucket reveals finer buckets — `foldOpensFiner`, the same
     *    predicate the chrome uses for base-row labels). The old
     *    `daysPerBucket > 1` proxy also blocked day buckets sitting on
     *    hourly atoms, which DO open.
     *  - AXIS label clicks: a tier label ("May" over day bars) is coarser
     *    than the buckets BY CONSTRUCTION, so it can always open — gating
     *    it on the plot's fold made every tier click dead exactly at fine
     *    folds, where tier rows are most useful. Per-label drillability
     *    is decided by the chrome's `periodKeys` (no key ⇒ inert label). */
    const hasHourly = atoms.some(a => typeof a.hour === 'number' && a.hour > 0);
    const plotDrillable = isHeatmap || foldOpensFiner(resolved.__foldUnit, hasHourly);
    const wrappedClick = onBucketClick
        ? (idx: number, label: string, atomKeyRange?: [number, number], periodKey?: string) => onBucketClick(idx, label, visibleBuckets, daysPerBucket, atomKeyRange, periodKey)
        : undefined;

    /* Window controls — two pieces side by side with the other toggles:
     *  - PRESET PILLS: the directive's `windowDays` toggle renders as a
     *    SegmentedPill like any other toggle (selection derived from the
     *    LIVE query, not the composer's stale `current`).
     *  - CUSTOM CHIP: a "Custom" popover that vessels ONLY the two-
     *    calendar date picker. Its label shows the calendar identity
     *    ("May 2026") or the picked span when a non-preset window is
     *    active. */
    const hasRangeChip = atoms.length > 0 && !!onWindowChange && !!q;
    const windowPill = React.useMemo(() => {
        if (!windowToggle || !q) return undefined;
        return { ...windowToggle, current: String(q.windowDays ?? 'null') } as ToggleSpec<GraphQuery>;
    }, [windowToggle, q]);
    /* Range options that OVERSHOOT the data span → the range popover greys them
     *  out + flags them. Pure data-span test; see emptyRangeValuesFor. */
    const emptyRangeValues = React.useMemo(
        () => emptyRangeValuesFor(windowToggle, atoms),
        [windowToggle, atoms],
    );
    const rangeValue = React.useMemo(
        () => (hasRangeChip ? rangeValueFromQuery(q!, []) : null),
        [hasRangeChip, q],
    );
    const isPresetWindow = !!windowToggle?.options.some(o => String(o.value) === String(q?.windowDays ?? 'null'));
    const customLabel = periodKeyLabel(q?.periodKey)
        ?? (rangeValue && !isPresetWindow && rangeValue.preset !== 'all'
            ? shortRangeLabel(rangeValue.start, rangeValue.end)
            : 'Custom');

    /* Header period picker — replaces the stacked month/year tier rows.
     *  Lists the coarser periods visible in the resolved view; picking one
     *  narrows the window to that period (same drill as a tier-label click)
     *  via `narrowQueryToPeriod`, which yields the `{windowDays, asOf,
     *  periodKey}` patch onWindowChange wants. */
    const periodOptions = React.useMemo(() => coarserPeriods(resolved), [resolved]);
    const narrowToPeriod = React.useCallback((periodKey: string) => {
        if (!q || !onWindowChange) return;
        const child = narrowQueryToPeriod(q, periodKey);
        if (child) onWindowChange({ windowDays: child.windowDays ?? null, asOf: child.asOf ?? null, periodKey: child.periodKey });
    }, [q, onWindowChange]);

    // The header row carries the title + drill breadcrumbs (left) and the
    // range chip/toggles/feature controls/live badge (right). Skip it
    // entirely when there is nothing to show — e.g. a hideTitle chart with
    // no toggles — so the host card's own heading isn't trailed by an
    // empty 0.25rem gap.
    const showHeaderRow = (!chart.hideTitle && !!chart.title)
        || (!!breadcrumbs && breadcrumbs.length > 0 && !!onDrillUp)
        || hasRangeChip
        || (periodOptions.length > 1 && !!onWindowChange)
        || (!!granularityToggle && granularityToggle.options.length > 1 && !!onToggle)
        || (gatedToggles.length > 0 && !!onToggle)
        || (featuresAvailable.length > 0 && !!featureScopeKey)
        || (showLive && isLive !== undefined);

    return (
        <>
            {t !== 'sparkline' && showHeaderRow && (
                /* align:start (not center) so a wrapped title+subtitle column
                 * keeps the right-hand controls pinned to the top line. */
                <BaseBox display="flex" direction="row" align="start" justify="between" style={{ marginBottom: 'var(--space-4, 1rem)', gap: 'var(--space-3, 0.75rem)' }}>
                    <BaseBox display="flex" direction="col" style={{ minWidth: 0, gap: '2px' }}>
                        <BaseBox display="flex" direction="row" align="center" density="tight" style={{ minWidth: 0 }}>
                            {/* THE chart card heading — a real title (the card owns it;
                              * hosts no longer draw a heading around the chart). */}
                            {!chart.hideTitle && (
                                <BaseText variant="h3" weight="bold" color="heading" style={{ fontSize: '1.0625rem', lineHeight: 1.3 }}>
                                    {chart.title}
                                </BaseText>
                            )}
                            {breadcrumbs && breadcrumbs.length > 0 && onDrillUp && (
                                <DrillBreadcrumbChip crumbs={breadcrumbs} onUp={onDrillUp} />
                            )}
                        </BaseBox>
                        {!chart.hideTitle && chart.subtitle && (
                            <BaseText variant="detail" color="muted" style={{ minWidth: 0 }}>
                                {chart.subtitle}
                            </BaseText>
                        )}
                    </BaseBox>
                    <BaseBox display="flex" direction="row" align="center" density="tight" controlSize="sm">
                        {periodOptions.length > 1 && onWindowChange && q && (
                            <PeriodPickerControl periods={periodOptions} currentPeriodKey={q.periodKey} onNarrow={narrowToPeriod} />
                        )}
                        {windowPill && onToggle && (
                            <WindowRangeControl
                                toggle={windowPill}
                                onChange={onToggle}
                                emptyValues={emptyRangeValues}
                                customLabel={!isPresetWindow ? customLabel : undefined}
                                customStart={rangeValue?.start}
                                customEnd={rangeValue?.end}
                                maxDate={atoms.length > 0 ? new Date().toISOString().split('T')[0] : undefined}
                                onCustomRange={onWindowChange
                                    /* Custom start+end → a real window: windowPatchFromRange
                                     * converts the picked range to {windowDays, asOf, periodKey}
                                     * (clamps end to today; stamps a calendar periodKey when the
                                     * span IS one). */
                                    ? (start, end) => {
                                        const p = windowPatchFromRange({ preset: 'custom', start, end });
                                        onWindowChange({ windowDays: p.windowDays, asOf: p.asOf ?? null, periodKey: p.periodKey });
                                    }
                                    : undefined}
                            />
                        )}
                        {granularityToggle && granularityToggle.options.length > 1 && onToggle && (
                            <GranularityControl toggle={granularityToggle} onChange={onToggle} />
                        )}
                        {gatedToggles.length > 0 && onToggle && (
                            <QueryToggleBar toggles={gatedToggles} isLoading={isLoading} error={error} onChange={onToggle} />
                        )}
                        {featuresAvailable.length > 0 && featureScopeKey && (
                            <FeatureToggleControl
                                features={featuresAvailable}
                                activeKinds={featureToggles.activeKinds}
                                onChange={featureToggles.setActiveKinds}
                            />
                        )}
                        {showLive && isLive !== undefined && <LiveBadge active={isLive} />}
                    </BaseBox>
                </BaseBox>
            )}
            {legibility === 'illegible'
                ? <LegibilityAlert chart={chartWithActive} />
                : <RenderFamily chart={resolvedWithActive} w={container.width} h={container.height} axesOverride={axesOverride} onBucketClick={wrappedClick} plotDrillable={plotDrillable} onToggleSeries={onToggleSeries} />}
        </>
    );
}

function RenderFamily({ chart, w, h, axesOverride, onBucketClick, plotDrillable, onToggleSeries }: { chart: GraphDirective; w: number; h: number; axesOverride?: string; onBucketClick?: (idx: number, label: string, atomKeyRange?: [number, number], periodKey?: string) => void; plotDrillable?: boolean; onToggleSeries?: (key: string) => void }) {
    return <ChartRender chart={chart} width={Math.max(100, w)} height={Math.max(60, h)} axesOverride={axesOverride} onBucketClick={onBucketClick} plotDrillable={plotDrillable} onToggleSeries={onToggleSeries} />;
}
