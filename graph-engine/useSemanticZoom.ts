import { useMemo } from 'react';
import { MARGIN } from './svg-parts.js';
import { isCartesian } from './cartesian-render.js';
import { isRadial } from './radial-render.js';
import { isPolar } from './polar-render.js';
import type { GraphDirective } from '../../architect/graph-composer.types.js';
import type { ContainerDimensions, FamilyConstraints, ZoomLevel, ZoomState, LegibilityStatus, ToggleFilter } from './graph-spatial.types.js';

/* ── Semantic Zoom Engine ────────────────────────────────────
 * Computes DPR (data-to-pixel ratio), zoom level, and
 * legibility status from container dimensions + data count.
 *
 * DPR = N / W_avail
 * maxPoints = floor(W_avail / minElementWidth)
 * Zoom levels: 0=raw, 1=weekly, 2=monthly, 3=quarterly
 * ──────────────────────────────────────────────────────────── */

const CONSTRAINTS: Record<string, FamilyConstraints> = {
    'bar':            { minElementWidth: 8,  minPlotWidth: 80, minPlotHeight: 40 },
    'stacked-bar':    { minElementWidth: 8,  minPlotWidth: 80, minPlotHeight: 40 },
    'waterfall':      { minElementWidth: 8,  minPlotWidth: 80, minPlotHeight: 40 },
    'distribution':   { minElementWidth: 8,  minPlotWidth: 80, minPlotHeight: 40 },
    'area':           { minElementWidth: 3,  minPlotWidth: 80, minPlotHeight: 40 },
    'stacked-area':   { minElementWidth: 3,  minPlotWidth: 80, minPlotHeight: 40 },
    'line':           { minElementWidth: 3,  minPlotWidth: 80, minPlotHeight: 40 },
    'sparkline':      { minElementWidth: 2,  minPlotWidth: 40, minPlotHeight: 20 },
    'scatter':        { minElementWidth: 6,  minPlotWidth: 80, minPlotHeight: 40 },
    'bubble':         { minElementWidth: 6,  minPlotWidth: 80, minPlotHeight: 40 },
    'pie':            { minElementWidth: 12, minPlotWidth: 60, minPlotHeight: 60 },
    'donut':          { minElementWidth: 12, minPlotWidth: 60, minPlotHeight: 60 },
    'gauge':          { minElementWidth: 12, minPlotWidth: 60, minPlotHeight: 60 },
    'progress-ring':  { minElementWidth: 12, minPlotWidth: 60, minPlotHeight: 60 },
    'radar':          { minElementWidth: 8,  minPlotWidth: 60, minPlotHeight: 60 },
    'heatmap':        { minElementWidth: 10, minPlotWidth: 80, minPlotHeight: 40 },
    'treemap':        { minElementWidth: 10, minPlotWidth: 80, minPlotHeight: 40 },
    'funnel':         { minElementWidth: 10, minPlotWidth: 80, minPlotHeight: 40 },
};
const FALLBACK: FamilyConstraints = { minElementWidth: 8, minPlotWidth: 80, minPlotHeight: 40 };

function resolveZoomLevel(n: number, maxPts: number): ZoomLevel {
    if (n <= maxPts) return 0;
    const ratio = n / maxPts;
    if (ratio <= 2) return 1;
    if (ratio <= 4) return 2;
    return 3;
}

export function useSemanticZoom(
    container: ContainerDimensions,
    chart: GraphDirective,
    filters: ToggleFilter[],
): { zoom: ZoomState; legibility: LegibilityStatus } {
    return useMemo(() => {
        const fc = CONSTRAINTS[chart.type] || FALLBACK;
        const isCart = isCartesian(chart.type);
        const mL = isCart ? MARGIN.left : 0;
        const mR = isCart ? MARGIN.right : 0;
        const mT = isCart ? MARGIN.top : 0;
        const mB = isCart ? MARGIN.bottom : 0;
        const wAvail = container.width - mL - mR;
        const hAvail = container.height - mT - mB;

        const visibleCount = filters.length > 0
            ? filters.filter(f => f.active).length
            : (chart.data as any[]).length;
        const n = chart.rawPointCount ?? visibleCount;

        const maxPoints = Math.max(1, Math.floor(wAvail / fc.minElementWidth));
        const dpr = n / Math.max(1, wAvail);
        const level = resolveZoomLevel(n, maxPoints);

        let legibility: LegibilityStatus = 'ok';
        if (isRadial(chart.type) || isPolar(chart.type)) {
            if (Math.min(wAvail, hAvail) < fc.minPlotWidth) legibility = 'illegible';
            else if (Math.min(wAvail, hAvail) < fc.minPlotWidth * 1.5) legibility = 'tight';
        } else {
            if (wAvail < fc.minPlotWidth || hAvail < fc.minPlotHeight) legibility = 'illegible';
            else if (wAvail < fc.minPlotWidth * 1.5) legibility = 'tight';
        }

        return { zoom: { level, dpr, maxPoints, compressed: level > 0 }, legibility };
    }, [container.width, container.height, chart, filters]);
}
