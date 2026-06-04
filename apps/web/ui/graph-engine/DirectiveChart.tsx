import React, { useEffect, useRef, useMemo } from 'react';
import { GraphRender } from './GraphRender.js';
import { useDirectiveController } from '../../architect/useDirectiveController.js';
import { narrowQueryToBucket, narrowQueryToPeriod, narrowQueryToAtomRange, windowLabel } from '../../architect/graph-drilldown.js';
import { getSeriesPalette } from './svg-color-schemes.js';
import type { GraphDirective, GraphQuery } from '../../architect/graph-composer.types.js';

/* Normalize a multi-series directive's `colorScheme.seriesColors` so the MARKS
 * and the TOOLTIP read the SAME palette. The geometry families fall back to
 * getSeriesPalette() when seriesColors is absent, but the hover tooltip falls
 * back to a single `primary` — so a server directive that ships `series` but no
 * seriesColors (cadence, byIndex) renders multi-colored bars with a flat-colored
 * tooltip. Stamping the engine's own default palette here (nexus-owned seam, no
 * engine edit) makes both sides agree. Charts that already carry seriesColors,
 * or are single-series, pass through untouched. */
function withSeriesColors(d: GraphDirective): GraphDirective {
    const series = (d as { series?: string[] }).series;
    if (!series || series.length === 0) return d;
    const cs = (d as { colorScheme?: { seriesColors?: string[] } }).colorScheme;
    if (cs?.seriesColors && cs.seriesColors.length > 0) return d;
    const palette = getSeriesPalette();
    const seriesColors = series.map((_, i) => palette[i % palette.length]);
    return { ...d, colorScheme: { ...(cs ?? {}), seriesColors } } as GraphDirective;
}

/* ── DirectiveChart ─────────────────────────────────────────
 * THE single, blessed way to render a chart in Nexus. Pages wrap their
 * directive seed in this component; no page touches <GraphRender> directly.
 *
 * It branches on whether the seed is REPLAYABLE (carries `query`):
 *
 *   • query-LESS (legacy snapshot, e.g. the stacked "Publicaciones por año"):
 *     render a BARE <GraphRender>. There is nothing to recompose, no stream to
 *     subscribe, no query toggle — the controller can only add overhead and
 *     identity churn. The legend toggle is handled ENTIRELY inside the engine
 *     (`useToggleFilters`), byte-for-byte like Zincro: deselecting a series is a
 *     pure render-time weight tween, no reload. The seed is memoized at the
 *     call-site, so its identity is already stable.
 *
 *   • query-FULL (replayable): the controller owns the directive in state and
 *     drives slider/recompose/stream/drill. Wrapping is what makes those work.
 *
 * Splitting into two child components keeps hooks unconditional — each child
 * calls its own hooks every render; only WHICH child mounts varies. (A single
 * component calling useDirectiveController conditionally would violate the
 * rules-of-hooks.) To reset a chart, the page remounts via React `key`.
 * ──────────────────────────────────────────────────────────── */

export interface DirectiveChartProps {
    /** The directive seed. Memoize at the call-site so identity is stable. */
    seed: GraphDirective;
    isLive?: boolean;
}

export function DirectiveChart({ seed }: DirectiveChartProps) {
    // Normalize seriesColors so marks + tooltip share one palette (see
    // withSeriesColors). Memoized so a stable seed keeps a stable identity —
    // the controller treats a new seed object as a reseed.
    const normalized = useMemo(() => withSeriesColors(seed), [seed]);
    // query-less → bare engine render (no controller layer); else → controller.
    return normalized.query ? <ControlledChart seed={normalized} /> : <GraphRender chart={normalized} />;
}

/** The controlled path — only for replayable seeds. Owns the directive in
 *  state via the controller and wires slider/recompose/stream/drill. */
function ControlledChart({ seed }: { seed: GraphDirective }) {
    const ctrl = useDirectiveController<GraphDirective, GraphQuery>(seed);

    // Replayable seed that arrived WITHOUT atoms (server gave a pre-folded
    // snapshot): pull the all-time atom set once so the slider folds locally —
    // what the old ReplayChart did on mount. Seeds with atoms skip this.
    const loadedRef = useRef(false);
    useEffect(() => {
        if (loadedRef.current) return;
        if (ctrl.directive.query && !ctrl.directive.atoms) {
            loadedRef.current = true;
            ctrl.refetch();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Drill: translate a bucket/cell/period click into a child query, then push
    // it onto the controller's breadcrumb stack. No-op when the click doesn't
    // narrow (helpers return null).
    const handleBucketClick = (
        idx: number,
        _label: string,
        totalBuckets: number,
        daysPerBucket: number,
        atomKeyRange?: [number, number],
        periodKey?: string,
    ) => {
        const cur = ctrl.directive.query;
        if (!cur) return;
        let child: GraphQuery | null = null;
        if (periodKey) {
            child = narrowQueryToPeriod(cur, periodKey);
        } else if (atomKeyRange) {
            const anchorISO = ctrl.directive.atoms?.[0]?.iso ?? '';
            child = narrowQueryToAtomRange(cur, atomKeyRange[0], atomKeyRange[1], anchorISO);
        } else {
            child = narrowQueryToBucket(cur, idx, totalBuckets, daysPerBucket);
        }
        /* Breadcrumb label is derived from the CHILD WINDOW (windowLabel), not
         *  the raw clicked axis text (`_label`) — the latter mixed formats
         *  ("1986-05-01" base-row vs bare "Q1" tier-row) and could repeat. A
         *  child that doesn't narrow is already rejected (helpers return null),
         *  so every pushed crumb reflects a real, consistently-labelled descent. */
        if (child) ctrl.drillDown(child, windowLabel(child));
    };

    /* Re-normalize on EVERY controller directive — not just the seed. A
     * refetch/recompose/slider/drill/stream push replaces ctrl.directive with a
     * fresh SERVER directive that lacks seriesColors, so normalizing only the
     * seed makes colors flash on first paint then revert to flat/black once the
     * controller swaps in a refetched directive. */
    const chart = useMemo(() => withSeriesColors(ctrl.directive), [ctrl.directive]);

    return (
        <GraphRender
            chart={chart}
            onToggle={ctrl.setToggle}
            onWindowChange={({ windowDays, asOf }) => ctrl.setQueryFields({ windowDays, asOf: asOf ?? undefined })}
            onBucketClick={handleBucketClick}
            isLoading={ctrl.isLoading}
            error={ctrl.error}
            isLive={ctrl.isLive}
            breadcrumbs={ctrl.breadcrumbs}
            onDrillUp={ctrl.drillUp}
        />
    );
}
