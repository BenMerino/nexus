import React from 'react';
import { BaseBox } from '../primitives/BaseBox.js';
import { BaseText } from '../primitives/BaseText.js';
import { ChartRender } from './ChartRender.js';
import { useTimelineSpan } from './useTimelineSpan.js';
import { LegibilityAlert } from './LegibilityAlert.js';
import { QueryToggleBar } from './QueryToggleBar.js';
import { FeatureToggleGroup, useChartFeatureToggles } from './FeatureToggleGroup.js';
import { LiveBadge } from '../composed/LiveBadge.js';
import { ChartRangeSlider } from './ChartRangeSlider.js';
import { periodKeyFor } from '../../architect/graph-drilldown.js';
import { DrillBreadcrumbChip } from './DrillBreadcrumbChip.js';
import { MARGIN } from './svg-parts.js';
import type { GraphDirective, GraphQuery } from '../../architect/graph-composer.types.js';
import type { ToggleSpec } from '../../architect/replayable-directive.js';

/* ── ChartBody ───────────────────────────────────────────────
 * Renders the title row (title + toggles + LiveBadge), the chart
 * canvas via the family-router, and the optional ChartRangeSlider
 * below. Extracted from GraphRender to keep that file under the
 * NBR-15 ceiling and to keep the slider/family composition in one
 * place. The renderer above (GraphRender) handles the resolved
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
    const span = useTimelineSpan(tenantId, kind);

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
    const asOf = q?.asOf ?? null;
    const sliderActive = !!windowToggle && !!tenantId && !!kind && !!span && !!onWindowChange;

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
    const daysPerBucket = visibleBuckets > 0 ? visibleAtoms / visibleBuckets : 1;
    const isHeatmap = t === 'heatmap';
    const drillable = isHeatmap || daysPerBucket > 1.001;
    const wrappedClick = drillable && onBucketClick
        ? (idx: number, label: string, atomKeyRange?: [number, number], periodKey?: string) => {
            /* Derive the calendar periodKey HERE, where the post-fold `resolved`
             *  directive carries the real __foldUnit. DirectiveChart can't: it
             *  holds the raw controller seed, whose __foldUnit is undefined
             *  (the fold is computed at render). `label` is the bucket's
             *  __startISO for time charts, so periodKeyFor maps it to the
             *  decade/year/month key the drill then narrows to exactly. */
            const fu = resolved.__foldUnit;
            const pk = periodKey ?? (fu ? periodKeyFor(label, fu) : null) ?? undefined;
            onBucketClick(idx, label, visibleBuckets, daysPerBucket, atomKeyRange, pk);
        }
        : undefined;

    // The header row carries the title + drill breadcrumbs (left) and the
    // toggles/feature controls/live badge (right). Skip it entirely when there
    // is nothing to show — e.g. a hideTitle chart with no toggles — so the host
    // card's own heading isn't trailed by an empty 0.25rem gap.
    const showHeaderRow = (!chart.hideTitle && !!chart.title)
        || (!!breadcrumbs && breadcrumbs.length > 0 && !!onDrillUp)
        || (otherToggles.length > 0 && !!onToggle)
        || (featuresAvailable.length > 0 && !!featureScopeKey)
        || isLive !== undefined;

    return (
        <>
            {t !== 'sparkline' && showHeaderRow && (
                <BaseBox display="flex" direction="row" align="center" justify="between" style={{ marginBottom: '0.25rem', gap: 'var(--space-3, 0.75rem)' }}>
                    <BaseBox display="flex" direction="row" align="center" density="tight" style={{ minWidth: 0 }}>
                        {!chart.hideTitle && (
                            <BaseText variant="detail" weight="semibold" style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {chart.title}
                            </BaseText>
                        )}
                        {breadcrumbs && breadcrumbs.length > 0 && onDrillUp && (
                            <DrillBreadcrumbChip crumbs={breadcrumbs} onUp={onDrillUp} />
                        )}
                    </BaseBox>
                    <BaseBox display="flex" direction="row" align="center" density="tight">
                        {otherToggles.length > 0 && onToggle && (
                            <QueryToggleBar toggles={otherToggles} isLoading={isLoading} error={error} onChange={onToggle} />
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
            {sliderActive && (
                <ChartRangeSlider
                    span={span!}
                    windowDays={windowDays}
                    asOf={asOf}
                    leftMarginPx={MARGIN.left}
                    rightMarginPx={MARGIN.right}
                    onWindowChange={onWindowChange}
                    disabled={isLoading}
                />
            )}
        </>
    );
}

function RenderFamily({ chart, w, h, axesOverride, onBucketClick, onToggleSeries }: { chart: GraphDirective; w: number; h: number; axesOverride?: string; onBucketClick?: (idx: number, label: string, atomKeyRange?: [number, number], periodKey?: string) => void; onToggleSeries?: (key: string) => void }) {
    return <ChartRender chart={chart} width={Math.max(100, w)} height={Math.max(60, h)} axesOverride={axesOverride} onBucketClick={onBucketClick} onToggleSeries={onToggleSeries} />;
}
