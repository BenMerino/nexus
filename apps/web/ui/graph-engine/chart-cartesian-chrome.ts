/**
 * SVG chrome builder for cartesian charts — axes (linear or band),
 * hierarchical tier rows under the X axis, and threshold lines.
 * Extracted from `chart-primitives-cartesian.ts` so the layout file
 * stays focused on scales + the drag resolver.
 */

import type { GraphDirective } from '../../architect/graph-composer.types.js';
import { defaultInteraction } from '../../architect/graph-composer.types.js';
import type { ChartChrome, ChromeElement } from './chart-chrome.types.js';
import { niceDomain } from './scales.js';
import { periodKeyFor } from '../../architect/graph-drilldown.js';
import { foldOpensFiner } from '../../architect/fold-atoms.js';
import { type CartesianLayout, isCurve } from './chart-primitives-cartesian.js';
import { xAxisLabelLayout } from './ChromeXAxisBand.js';
import { valueLabelElements } from './chrome-value-labels.js';
import { annotationElements, annotatedIndices } from './chrome-annotations.js';

export function cartesianChrome(chart: GraphDirective, layout: CartesianLayout): ChartChrome {
    const t = chart.type;
    if (t === 'sparkline') return { elements: [] };

    const elements: ChromeElement[] = [];
    /* Base x-axis band — captured so value labels + sub-annotations can
     *  reuse its decimation. Undefined for scatter/bubble (linear x). */
    let baseBand: Extract<ChromeElement, { kind: 'x-axis-band' }> | undefined;

    /* X-axis: labels along the bottom of the plot rect. */
    if (t === 'scatter' || t === 'bubble') {
        const data = chart.data as any[];
        const xVals = data.map((d: any) => d.x);
        const xDom = niceDomain(Math.min(...xVals), Math.max(...xVals));
        elements.push({
            kind: 'x-axis-linear',
            domain: xDom,
            range: layout.xR,
            y: layout.yR[1],
        });
    } else {
        const baseData = chart.data as any[];
        /* Stable per-bucket key for the base row — globally-unique React
         *  keys via `__startISO`; falls back to index when ISO is missing. */
        const baseKeys = layout.labels.map((_, i) => {
            const iso = baseData[i]?.__startISO as string | undefined;
            return iso ?? `idx-${i}`;
        });
        /* Drill identity per base label: the calendar period the bucket
         *  belongs to (`2024-03` for a month bucket, `2020s` for a decade).
         *  Raw `baseKeys` must not double as drill keys — a month bucket's
         *  key is its start DATE, which would parse as a day period.
         *  Stamped only when the period actually OPENS (foldOpensFiner —
         *  the same predicate gating plot clicks): a day label with
         *  daily-only atoms has nothing inside, so no key ⇒ the tap target
         *  renders inert and the cursor never advertises a drill that
         *  would land on a one-bucket view. Tier rows below are always
         *  coarser than the base fold, so they always stamp. */
        const hasHourly = (chart.atoms ?? []).some(a => typeof a.hour === 'number' && a.hour > 0);
        const baseOpens = foldOpensFiner(chart.__foldUnit, hasHourly);
        const basePeriodKeys = layout.labels.map((_, i) => {
            if (!baseOpens) return undefined;
            const iso = baseData[i]?.__startISO as string | undefined;
            return iso ? periodKeyFor(iso, chart.__foldUnit) ?? undefined : undefined;
        });
        const plotW = layout.xR[1] - layout.xR[0];
        /* Divider edges per bucket. For BARS the bucket is the band
         *  (`positionAt`). For CURVES (line/area) the points use a
         *  point-scale that pins the endpoints at the plot edges — a
         *  different x-model than the band — so band edges would be
         *  OFFSET from the point a label sits on, and `clearsDividers`
         *  (which tests the label's point-center against its bucket
         *  edges) wrongly drops labels near the offset boundaries. For
         *  curves we instead build each point's bucket from the MIDPOINTS
         *  to its neighbours, so edges and label centers share one model. */
        const isCurveX = isCurve(chart.type);
        const baseLeadingEdgeXs = baseData.map((d: any, i: number) => {
            if (typeof d?.__xStart === 'number') {
                return layout.xR[0] + Math.max(0, Math.min(1, d.__xStart)) * plotW;
            }
            if (isCurveX) {
                const c = layout.pointAt(i);
                return i > 0 ? (layout.pointAt(i - 1) + c) / 2 : c;
            }
            return layout.positionAt(i).x;
        });
        const baseTrailingEdgeXs = baseData.map((d: any, i: number) => {
            if (typeof d?.__xEnd === 'number') {
                return layout.xR[0] + Math.max(0, Math.min(1, d.__xEnd)) * plotW;
            }
            if (isCurveX) {
                const c = layout.pointAt(i);
                return i < baseData.length - 1 ? (c + layout.pointAt(i + 1)) / 2 : c;
            }
            const pos = layout.positionAt(i);
            return pos.x + pos.width;
        });
        /* Base labels sit at the geometric center of each bucket's
         *  visible span — keeps each label glued to its bar even when
         *  window-edge buckets get clipped. */
        const baseXAt = (i: number): number => {
            const d = baseData[i] as any;
            if (typeof d?.__xStart === 'number' && typeof d?.__xEnd === 'number') {
                const x0 = layout.xR[0] + Math.max(0, Math.min(1, d.__xStart)) * plotW;
                const x1 = layout.xR[0] + Math.max(0, Math.min(1, d.__xEnd)) * plotW;
                return (x0 + x1) / 2;
            }
            return layout.pointAt(i);
        };
        /* Annotated indices become decimator anchors so an annotated
         *  point's slot survives crowding (value labels + annotations
         *  share this one decimation pass). */
        const annAnchors = chart.annotations ? Array.from(annotatedIndices(chart)) : undefined;
        /* Categorical x: a non-curve bar chart with no temporal fold unit —
         *  its labels are named entities (institutions, journals), not time
         *  samples. Such labels must all render (rotated), never decimate to
         *  first/last. Temporal bars (year/month, carry __foldUnit) keep the
         *  pixel-min-slot decimator. */
        const isCategorical = !isCurveX && !chart.__foldUnit;
        baseBand = {
            kind: 'x-axis-band',
            labels: layout.labels,
            range: layout.xR,
            xAt: baseXAt,
            y: layout.yR[1],
            keys: baseKeys,
            periodKeys: basePeriodKeys,
            leadingEdgeXs: baseLeadingEdgeXs,
            trailingEdgeXs: baseTrailingEdgeXs,
            plotYR: layout.yR,
            ...(isCategorical ? { keepAll: true } : {}),
            ...(annAnchors && annAnchors.length ? { anchors: annAnchors } : {}),
        };
        elements.push(baseBand);
        /* Coarser context (month/year) is NO LONGER stacked as redundant
         *  tier ROWS under the base labels — viewing January at day fold
         *  used to repeat "Jan"/"2026" across every column. The base band
         *  now shows ONLY the smallest bucket (the days), and the coarser
         *  period is selected from the header period picker (ChartBody),
         *  which drives the same period-narrow drill the tier labels did. */
    }

    /* Y-axis: tick values along the left edge of the plot rect. */
    if (t === 'scatter' || t === 'bubble') {
        const data = chart.data as any[];
        const yVals = data.map((d: any) => d.y);
        const yDom = niceDomain(Math.min(...yVals), Math.max(...yVals));
        elements.push({
            kind: 'y-axis',
            domain: yDom,
            range: [layout.yR[1], layout.yR[0]],
            x: layout.margin.left,
            gridX: layout.xR,
        });
    } else {
        elements.push({
            kind: 'y-axis',
            domain: layout.yDom,
            range: [layout.yR[1], layout.yR[0]],
            x: layout.margin.left,
            gridX: layout.xR,
        });
    }

    if (chart.thresholds) {
        for (const th of chart.thresholds) {
            elements.push({
                kind: 'threshold-line',
                y: layout.yS(th.value),
                xRange: layout.xR,
                color: th.color,
                label: th.label,
            });
        }
    }

    /* Value labels + sub-annotations share ONE decimation pass (the base
     *  band's, with annotated indices forced as anchors above). The
     *  annotation suppresses its index's plain value label so the two
     *  don't stack on the same point. Band charts only (scatter/bubble
     *  have no baseBand). */
    if (baseBand) {
        const annotated = annotatedIndices(chart);
        if (chart.annotations?.length) {
            elements.push(...annotationElements(chart, layout));
        }
        if (chart.valueLabels) {
            const { indices } = xAxisLabelLayout(baseBand);
            elements.push(...valueLabelElements(chart, layout, indices, annotated));
        }
    }

    const ix = chart.interaction ?? defaultInteraction(t);
    return {
        elements,
        crosshair: {
            xR: layout.xR,
            yR: layout.yR,
            mode: ix.crosshair,
            transitionMs: ix.transitionMs,
        },
    };
}
