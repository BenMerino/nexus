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
import type { DatumStatus } from '../../architect/fold-atoms.js';
import { appendHoverRails } from './animated-curves-rails.js';
import { linearScale } from './scales.js';
import { curveSegmentsFor } from './curve-segments.js';
import { appendMarkers } from './curve-markers.js';
import { resolveBucketStyle, resolveStatuses } from './datum-status-style.js';
import {
    type EdgePtState,
    lerpEdgePt,
    makeEdgePt,
} from './animated-curve-helpers.js';

/* Single import surface for chart-families: keep the multi-line
 * re-export here so call sites that historically imported both from
 * this file stay valid. */
export { animatedMultiLine, type MultiLineState } from './animated-cartesian-multiline.js';

export interface LineState {
    xs: number[];
    /** Raw values per visible point. Projected through eased yS at
     *  primitive build time. Undefined buckets carry a finite
     *  placeholder (last-defined/0) so array-lerp never NaN-poisons;
     *  `defined[i]` is the truth, never `vs[i]`. */
    vs: number[];
    values: number[];
    labels: string[];
    /** Per-bucket start ISO — rides the rail hit payload as `__startISO`
     *  so a plot click resolves the bucket's calendar period (same drill
     *  contract as bars). Empty string when non-atomic/categorical. */
    isos: string[];
    /** Per-bucket semantic status (post statusOverrides) — drives dash +
     *  marker. Discrete: pass-through in lerp. */
    statuses: DatumStatus[];
    /** Per-bucket presence — `false` ⇒ gap (curve breaks, no marker). */
    defined: boolean[];
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
        if (chart.__buckets && chart.__buckets.length > 0) {
            const aggs = chart.__buckets;
            const plotW = layout.xR[1] - layout.xR[0];
            const toPx = (xNorm: number) => layout.xR[0] + xNorm * plotW;
            return {
                xs: aggs.map(b => toPx(b.xCenter)),
                vs: aggs.map(b => b.value),
                values: aggs.map(b => b.value),
                /* Formatted labels (`chart.data` is built from the same
                 *  canonical sequence, so index i aligns) — raw startISO
                 *  leaked ISO dates into the hover tooltip. */
                labels: aggs.map((b, i) => layout.labels[i] ?? b.startISO),
                isos: aggs.map(b => b.startISO),
                statuses: resolveStatuses(aggs.map(b => b.status), chart.statusOverrides, aggs.map(b => b.startISO)),
                defined: aggs.map(b => b.defined),
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
            /* Missing (value == null) → finite placeholder so lerp stays
             *  NaN-free; `defined` carries the truth. */
            vs: data.map((d) => d.value ?? 0),
            values: data.map((d) => d.value ?? 0),
            labels: layout.labels,
            isos: data.map((d) => typeof d.__startISO === 'string' ? d.__startISO : ''),
            statuses: resolveStatuses(
                data.map((d) => (d.__status as DatumStatus) ?? (d.status as DatumStatus) ?? 'observed'),
                chart.statusOverrides,
            ),
            defined: data.map((d) => d.value != null && d.__defined !== false && d.defined !== false),
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
                isos: target.isos,
                statuses: target.statuses,
                defined: target.defined,
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
    primitives(state, layoutRaw, chart) {
        if (state.xs.length < 2) return [];
        const layout = layoutRaw as CartesianLayout;
        const yS = linearScale([state.yDomMin, state.yDomMax], [state.plotYR[1], state.plotYR[0]]);
        const ys = state.vs.map(yS);
        const pres = chart.presentation;
        const dashByBucket = state.statuses.map(st => resolveBucketStyle(st, pres).dash);

        const out: Primitive[] = [];
        const segments = curveSegmentsFor(
            state.xs, ys, state.defined, dashByBucket, yS,
            state.leadPt, state.tailPt, layout.xR[0], layout.xR[1],
        );
        for (const seg of segments) {
            out.push({ kind: 'polyline', points: seg.points, strokeWidth: 1.5, color: state.color, dash: seg.dash, data: undefined });
        }
        appendMarkers(out, state.xs, ys, state.statuses, state.defined, state.color, layout.xR[0], layout.xR[1]);
        appendHoverRails(out, state.xs, state.plotYR, (i) => ({
            idx: i, label: state.labels[i], value: state.values[i], __startISO: state.isos[i] || undefined,
        }), ys);
        return out;
    },
};
