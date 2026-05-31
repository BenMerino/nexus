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
import type { CartesianLayout } from './chart-primitives-cartesian.js';
import { xAxisLabelLayout } from './ChromeXAxisBand.js';
import { valueLabelElements } from './chrome-value-labels.js';
import { annotationElements, annotatedIndices } from './chrome-annotations.js';
import {
    coarserTiersFor,
    groupByTier,
    parentPeriodKey,
} from './chart-tier-groups.js';

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
        const plotW = layout.xR[1] - layout.xR[0];
        const baseLeadingEdgeXs = baseData.map((d: any, i: number) => {
            if (typeof d?.__xStart === 'number') {
                return layout.xR[0] + Math.max(0, Math.min(1, d.__xStart)) * plotW;
            }
            return layout.positionAt(i).x;
        });
        const baseTrailingEdgeXs = baseData.map((d: any, i: number) => {
            if (typeof d?.__xEnd === 'number') {
                return layout.xR[0] + Math.max(0, Math.min(1, d.__xEnd)) * plotW;
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
        baseBand = {
            kind: 'x-axis-band',
            labels: layout.labels,
            range: layout.xR,
            xAt: baseXAt,
            y: layout.yR[1],
            keys: baseKeys,
            leadingEdgeXs: baseLeadingEdgeXs,
            trailingEdgeXs: baseTrailingEdgeXs,
            plotYR: layout.yR,
            ...(annAnchors && annAnchors.length ? { anchors: annAnchors } : {}),
        };
        elements.push(baseBand);
        /* Hierarchical X-axis tiers: when buckets carry calendar
         *  metadata, render coarser context rows beneath the base labels. */
        const tiers = coarserTiersFor(chart.__foldUnit);
        for (let tierIdx = 0; tierIdx < tiers.length; tierIdx++) {
            const tierUnit = tiers[tierIdx];
            const groups = groupByTier(chart, layout, tierUnit);
            if (groups.length === 0) continue;
            const tierY = layout.yR[1] + (tierIdx + 1) * 14;
            /* Semantic anchors: labels marking the start of a coarser
             *  period. The decimator MUST keep these whenever they fit,
             *  so users always see e.g. "May W1" even when surrounding
             *  W2/W3/W4 would crowd. */
            const anchors: number[] = [];
            for (let i = 1; i < groups.length; i++) {
                if (parentPeriodKey(groups[i].key, tierUnit) !== parentPeriodKey(groups[i - 1].key, tierUnit)) {
                    anchors.push(i);
                }
            }
            elements.push({
                kind: 'x-axis-band',
                labels: groups.map(g => g.label),
                keys: groups.map(g => g.key),
                range: layout.xR,
                xAt: (i: number) => groups[i].centerX,
                y: tierY,
                leadingEdgeXs: groups.map(g => g.startX),
                trailingEdgeXs: groups.map(g => g.endX),
                plotYR: layout.yR,
                anchors,
            });
        }
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
        });
    } else {
        elements.push({
            kind: 'y-axis',
            domain: layout.yDom,
            range: [layout.yR[1], layout.yR[0]],
            x: layout.margin.left,
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
