/**
 * Animated single-line family (`animatedLine`, also used for
 * sparklines). Multi-line lives in `animated-cartesian-multiline.ts`;
 * area variants in `animated-cartesian-areas.ts`. Shared edge-neighbor
 * / yDom plumbing in `animated-curve-helpers.ts`.
 *
 * Per-quantity clocks: xs follow the cursor (`alphaInstant`), raw
 * values smooth over `alphaShort`, the y-axis domain breathes over
 * `alphaScale`. Per frame, `primitives()` rebuilds the y-scale from
 * the eased domain so peaks entering/leaving the window glide rather
 * than flash.
 */

import { cs } from './svg-parts.js';
import type { Primitive } from './chart-primitive.types.js';
import type { CartesianLayout } from './chart-primitives-cartesian.js';
import { lerpNumber, lerpNumberArray, type AnimatedFamily } from './animated-family.js';
import { smoothPoints } from './curve-sampling.js';
import { bucketAggregates } from '../../architect/place-atoms.js';
import { appendHoverRails } from './animated-curves-rails.js';
import { clipPolylineX } from './curve-edge-neighbors.js';
import { linearScale } from './scales.js';
import {
    type EdgePtState,
    lerpEdgePt,
    makeEdgePt,
    projectEdgePt,
} from './animated-curve-helpers.js';

/* Single import surface for chart-families: keep the multi-line
 * re-export here so call sites that historically imported both from
 * this file stay valid. */
export { animatedMultiLine, type MultiLineState } from './animated-cartesian-multiline.js';

export interface LineState {
    xs: number[];
    /** Raw values per visible point. Projected through eased yS at
     *  primitive build time. */
    vs: number[];
    values: number[];
    labels: string[];
    color: string;
    plotYR: [number, number];
    yDomMin: number;
    yDomMax: number;
    leadPt?: EdgePtState;
    tailPt?: EdgePtState;
}

export const animatedLine: AnimatedFamily<LineState> = {
    sample(chart, layoutRaw) {
        const layout = layoutRaw as CartesianLayout;
        const c = cs(chart);
        const en = chart.__edgeNeighbors;
        if (chart.atoms && chart.__placements && chart.atoms.length === chart.__placements.length) {
            const aggs = bucketAggregates(chart.atoms, chart.__placements);
            const plotW = layout.xR[1] - layout.xR[0];
            const toPx = (xNorm: number) => layout.xR[0] + xNorm * plotW;
            return {
                xs: aggs.map(b => toPx(b.xCenter)),
                vs: aggs.map(b => b.value),
                values: aggs.map(b => b.value),
                labels: aggs.map(b => b.startISO),
                color: c.primary,
                plotYR: layout.yR,
                yDomMin: layout.yDom.min,
                yDomMax: layout.yDom.max,
                leadPt: makeEdgePt(en?.left, layout),
                tailPt: makeEdgePt(en?.right, layout),
            };
        }
        const data = chart.data as any[];
        return {
            xs: data.map((_d, i) => layout.pointAt(i)),
            vs: data.map((d) => d.value ?? 0),
            values: data.map((d) => d.value ?? 0),
            labels: layout.labels,
            color: c.primary,
            plotYR: layout.yR,
            yDomMin: layout.yDom.min,
            yDomMax: layout.yDom.max,
            leadPt: makeEdgePt(en?.left, layout),
            tailPt: makeEdgePt(en?.right, layout),
        };
    },
    lerp(prev, target, phase) {
        const dRef = { value: 0 };
        return {
            state: {
                xs: lerpNumberArray(prev.xs, target.xs, phase.alphaInstant, dRef),
                vs: lerpNumberArray(prev.vs, target.vs, phase.alphaShort, dRef),
                values: target.values,
                labels: target.labels,
                color: target.color,
                plotYR: target.plotYR,
                yDomMin: lerpNumber(prev.yDomMin, target.yDomMin, phase.alphaScale, dRef),
                yDomMax: lerpNumber(prev.yDomMax, target.yDomMax, phase.alphaScale, dRef),
                leadPt: lerpEdgePt(prev.leadPt, target.leadPt, phase.alphaInstant, phase.alphaShort, dRef),
                tailPt: lerpEdgePt(prev.tailPt, target.tailPt, phase.alphaInstant, phase.alphaShort, dRef),
            },
            maxDelta: dRef.value,
        };
    },
    primitives(state, layoutRaw) {
        if (state.xs.length < 2) return [];
        const layout = layoutRaw as CartesianLayout;
        const yS = linearScale([state.yDomMin, state.yDomMax], [state.plotYR[1], state.plotYR[0]]);
        const ys = state.vs.map(yS);
        const rawPoints: { x: number; y: number }[] = [];
        const leadProj = projectEdgePt(state.leadPt, yS, state.xs, ys, 'left');
        const tailProj = projectEdgePt(state.tailPt, yS, state.xs, ys, 'right');
        if (leadProj) rawPoints.push(leadProj);
        for (let i = 0; i < state.xs.length; i++) rawPoints.push({ x: state.xs[i], y: ys[i] });
        if (tailProj) rawPoints.push(tailProj);
        const points = clipPolylineX(smoothPoints(rawPoints), layout.xR[0], layout.xR[1]);
        const out: Primitive[] = [
            { kind: 'polyline', points, strokeWidth: 1.5, color: state.color, data: undefined },
        ];
        appendHoverRails(out, state.xs, state.plotYR, (i) => ({
            idx: i, label: state.labels[i], value: state.values[i],
        }));
        return out;
    },
};
