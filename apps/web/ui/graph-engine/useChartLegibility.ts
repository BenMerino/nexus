import { useMemo } from 'react';
import { MARGIN } from './svg-parts.js';
import { isCartesian, isRadial, isPolar } from './chart-families.js';
import type { GraphDirective } from '../../architect/graph-composer.types.js';
import type { ContainerDimensions, LegibilityStatus } from './graph-spatial.types.js';

/* ── Chart Legibility ────────────────────────────────────────
 * Computes how legible the chart will be at the current container
 * size. Three states:
 *   - ok          → render normally
 *   - tight       → border tints amber to warn the user
 *   - illegible   → swap render for `<LegibilityAlert>`
 *
 * Pure: depends only on container + chart type. Replaces the
 * legibility half of the old useSemanticZoom hook (the other half,
 * data compression, has been replaced by the atomic foundation).
 * ──────────────────────────────────────────────────────────── */

interface FamilyConstraints {
    minPlotWidth: number;
    minPlotHeight: number;
}

const CONSTRAINTS: Record<string, FamilyConstraints> = {
    'bar':            { minPlotWidth: 80, minPlotHeight: 40 },
    'stacked-bar':    { minPlotWidth: 80, minPlotHeight: 40 },
    'waterfall':      { minPlotWidth: 80, minPlotHeight: 40 },
    'distribution':   { minPlotWidth: 80, minPlotHeight: 40 },
    'area':           { minPlotWidth: 80, minPlotHeight: 40 },
    'stacked-area':   { minPlotWidth: 80, minPlotHeight: 40 },
    'line':           { minPlotWidth: 80, minPlotHeight: 40 },
    'sparkline':      { minPlotWidth: 40, minPlotHeight: 20 },
    'scatter':        { minPlotWidth: 80, minPlotHeight: 40 },
    'bubble':         { minPlotWidth: 80, minPlotHeight: 40 },
    'pie':            { minPlotWidth: 60, minPlotHeight: 60 },
    'donut':          { minPlotWidth: 60, minPlotHeight: 60 },
    'gauge':          { minPlotWidth: 60, minPlotHeight: 60 },
    'progress-ring':  { minPlotWidth: 60, minPlotHeight: 60 },
    'radar':          { minPlotWidth: 60, minPlotHeight: 60 },
    'heatmap':        { minPlotWidth: 80, minPlotHeight: 40 },
    'treemap':        { minPlotWidth: 80, minPlotHeight: 40 },
    'funnel':         { minPlotWidth: 80, minPlotHeight: 40 },
};
const FALLBACK: FamilyConstraints = { minPlotWidth: 80, minPlotHeight: 40 };

export function useChartLegibility(container: ContainerDimensions | null, chart: GraphDirective): LegibilityStatus {
    return useMemo(() => {
        if (!container) return 'ok';
        const fc = CONSTRAINTS[chart.type] || FALLBACK;
        const isCart = isCartesian(chart.type);
        const wAvail = container.width - (isCart ? MARGIN.left + MARGIN.right : 0);
        const hAvail = container.height - (isCart ? MARGIN.top + MARGIN.bottom : 0);
        if (isRadial(chart.type) || isPolar(chart.type)) {
            const m = Math.min(wAvail, hAvail);
            if (m < fc.minPlotWidth) return 'illegible';
            if (m < fc.minPlotWidth * 1.5) return 'tight';
        } else {
            if (wAvail < fc.minPlotWidth || hAvail < fc.minPlotHeight) return 'illegible';
            if (wAvail < fc.minPlotWidth * 1.5) return 'tight';
        }
        return 'ok';
    }, [container, chart]);
}
