import React from 'react';
import { BaseBox } from '../primitives/BaseBox.js';
import { BaseText } from '../primitives/BaseText.js';
import { ChartRender } from './ChartRender.js';
import { LegibilityAlert } from './LegibilityAlert.js';
import { QueryToggleBar } from './QueryToggleBar.js';
import { FeatureToggleGroup, useChartFeatureToggles } from './FeatureToggleGroup.js';
import { LiveBadge } from '../composed/LiveBadge.js';
import { DrillBreadcrumbChip } from './DrillBreadcrumbChip.js';
import { eligibleFoldUnits } from '../../architect/fold-atoms.js';
import type { GraphDirective, GraphQuery } from '../../architect/graph-composer.types.js';
import type { ToggleSpec } from '../../architect/replayable-directive.js';

/* Strip a foldUnit toggle's options down to the units that bucket READABLY
 * for the current visible span (eligibleFoldUnits: 3–120 buckets). Without
 * this a user could force e.g. "week" over a 170-year window → ~9k buckets,
 * crippling the fold/render. Non-foldUnit toggles pass through untouched, and
 * a foldUnit toggle keeps 'auto' (always eligible) plus whatever fits — so the
 * fine rungs reappear as the user narrows the window. */
function gateFoldUnitToggles<T extends ToggleSpec<GraphQuery>>(toggles: T[], visibleDays: number): T[] {
    if (!Number.isFinite(visibleDays) || visibleDays <= 0) return toggles;
    const eligible = new Set(eligibleFoldUnits(visibleDays).map(String));
    return toggles.map(tg => {
        if (tg.field !== 'foldUnit' && tg.id !== 'foldUnit') return tg;
        const options = tg.options.filter(o => eligible.has(o.value));
        return { ...tg, options } as T;
    });
}

/* ── ChartBody ───────────────────────────────────────────────
 * Renders the title row (title + toggles + LiveBadge) and the chart
 * canvas via the family-router. Time navigation is pure click-to-drill
 * (click a bar/period → its sub-periods; breadcrumb drills out) plus the
 * granularity pills — the continuous windowDays range slider was removed
 * (arbitrary windows produced partial edge buckets + incoherent drills).
 * `onWindowChange` is retained on the prop surface for callers but no
 * longer drives a slider. Extracted from GraphRender to keep that file
 * under the NBR-15 ceiling. The renderer above (GraphRender) handles the resolved
 * directive (post-fold, post-morph) and passes it here.
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
    onWindowChange?: (window: { windowDays: number | null; asOf: string | null }) => void;
    isLoading: boolean;
    error?: string | null;
    t: string;
    isLive?: boolean;
    /** Drill breadcrumbs from `useDirectiveController` — when non-empty,
     *  a "← Back" chip + trail renders in the title row. The chart is
     *  the right owner of this chrome: putting the chip outside the card
     *  (as a sibling row above) makes the whole segment grow vertically
     *  whenever drill state appears. Inside the title row it's a peer
     *  of the toggle pills + LiveBadge and changes no card geometry. */
    breadcrumbs?: { label: string }[];
    onDrillUp?: () => void;
}

export function ChartBody({ chart, resolved, container, legibility, axesOverride, onBucketClick, onToggle, onToggleSeries, onWindowChange, isLoading, error, t, isLive, breadcrumbs, onDrillUp }: ChartBodyProps) {
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
    const chartWithActive = featuresAvailable.length > 0
        ? { ...chart, activeFeatures: featureToggles.activeKinds }
        : chart;
    const resolvedWithActive = featuresAvailable.length > 0
        ? { ...resolved, activeFeatures: featureToggles.activeKinds }
        : resolved;

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
    const gatedToggles = gateFoldUnitToggles(otherToggles, visibleAtoms);
    const daysPerBucket = visibleBuckets > 0 ? visibleAtoms / visibleBuckets : 1;
    const isHeatmap = t === 'heatmap';
    const drillable = isHeatmap || daysPerBucket > 1.001;
    const wrappedClick = drillable && onBucketClick
        ? (idx: number, label: string, atomKeyRange?: [number, number], periodKey?: string) => onBucketClick(idx, label, visibleBuckets, daysPerBucket, atomKeyRange, periodKey)
        : undefined;

    return (
        <>
            {t !== 'sparkline' && (
                <BaseBox display="flex" direction="row" align="center" justify="between" style={{ marginBottom: '0.25rem', gap: 'var(--space-3, 0.75rem)' }}>
                    <BaseBox display="flex" direction="row" align="center" density="tight" style={{ minWidth: 0 }}>
                        <BaseText variant="detail" weight="semibold" style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {chart.title}
                        </BaseText>
                        {breadcrumbs && breadcrumbs.length > 0 && onDrillUp && (
                            <DrillBreadcrumbChip crumbs={breadcrumbs} onUp={onDrillUp} />
                        )}
                    </BaseBox>
                    <BaseBox display="flex" direction="row" align="center" density="tight">
                        {gatedToggles.length > 0 && onToggle && (
                            <QueryToggleBar toggles={gatedToggles} isLoading={isLoading} error={error} onChange={onToggle} />
                        )}
                        {featuresAvailable.length > 0 && featureScopeKey && (
                            <FeatureToggleGroup
                                scopeKey={featureScopeKey}
                                features={featuresAvailable}
                                activeKinds={featureToggles.activeKinds}
                                onChange={featureToggles.setActiveKinds}
                                isLoading={isLoading || featureToggles.status === 'loading'}
                                foldUnit={resolved.__foldUnit}
                            />
                        )}
                        {isLive !== undefined && <LiveBadge active={isLive} />}
                    </BaseBox>
                </BaseBox>
            )}
            {legibility === 'illegible'
                ? <LegibilityAlert chart={chartWithActive} />
                : <RenderFamily chart={resolvedWithActive} w={container.width} h={container.height} axesOverride={axesOverride} onBucketClick={wrappedClick} onToggleSeries={onToggleSeries} />}
        </>
    );
}

function RenderFamily({ chart, w, h, axesOverride, onBucketClick, onToggleSeries }: { chart: GraphDirective; w: number; h: number; axesOverride?: string; onBucketClick?: (idx: number, label: string, atomKeyRange?: [number, number], periodKey?: string) => void; onToggleSeries?: (key: string) => void }) {
    return <ChartRender chart={chart} width={Math.max(100, w)} height={Math.max(60, h)} axesOverride={axesOverride} onBucketClick={onBucketClick} onToggleSeries={onToggleSeries} />;
}
