/**
 * Animated single-area family (`animatedArea`). Stacked-area lives in
 * `animated-cartesian-stacked-area.ts`; line variants in
 * `animated-cartesian-lines.ts`. Shared edge-neighbor / yDom plumbing
 * is in `animated-curve-helpers.ts`.
 */

import { cs } from './svg-parts.js';
import type { Primitive } from './chart-primitive.types.js';
import type { CartesianLayout } from './chart-primitives-cartesian.js';
import { lerpNumber, lerpNumberArray, type AnimatedFamily } from './animated-family.js';
import type { DatumStatus } from '../../architect/fold-atoms.js';
import { appendHoverRails } from './animated-curves-rails.js';
import { buildCurveSegments, type SegPoint } from './curve-segments.js';
import { resolveBucketStyle, resolveStatuses } from './datum-status-style.js';
import { linearScale } from './scales.js';
import {
    type EdgePtState,
    lerpEdgePt,
    makeEdgePt,
    projectEdgePt,
} from './animated-curve-helpers.js';

/* Re-export stacked-area from the chart-families router's perspective.
 * Splitting the family modules but keeping a single import surface for
 * call sites that historically imported both from this file. */
export { animatedStackedArea, type StackedAreaState } from './animated-cartesian-stacked-area.js';

export interface AreaState {
    /** Pixel-space x positions (cursor-tied → alphaInstant). */
    xs: number[];
    /** Raw values per point (alphaShort). Projected to pixel ys per
     *  frame at primitive build time via the eased yS. */
    vs: number[];
    /** Same as `vs` — kept for the hover-rail data callback. Identical
     *  content; separate field because the hover rail receives values
     *  by index whereas the curve consumes them through the scale. */
    values: number[];
    labels: string[];
    /** Per-bucket status (dash) + presence (gap). */
    statuses: DatumStatus[];
    defined: boolean[];
    baseY: number;
    color: string;
    strokeColor: string;
    plotYR: [number, number];
    /** Current y-axis domain (alphaScale). Per frame the family
     *  rebuilds yS = linearScale([yDomMin, yDomMax], [yR[1], yR[0]])
     *  so the axis breathes smoothly while xs/vs settle on faster
     *  clocks. */
    yDomMin: number;
    yDomMax: number;
    /** Off-window edge neighbors. See EdgePtState. */
    leadPt?: EdgePtState;
    tailPt?: EdgePtState;
}

export const animatedArea: AnimatedFamily<AreaState> = {
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
                labels: aggs.map(b => b.startISO),
                statuses: resolveStatuses(aggs.map(b => b.status), chart.statusOverrides, aggs.map(b => b.startISO)),
                defined: aggs.map(b => b.defined),
                baseY: layout.yR[1],
                color: c.fill,
                strokeColor: c.primary,
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
            statuses: resolveStatuses(
                data.map((d) => (d.__status as DatumStatus) ?? (d.status as DatumStatus) ?? 'observed'),
                chart.statusOverrides,
            ),
            defined: data.map((d) => d.value != null && d.__defined !== false && d.defined !== false),
            baseY: layout.yR[1],
            color: c.fill,
            strokeColor: c.primary,
            plotYR: layout.yR,
            yDomMin: layout.yDom.min,
            yDomMax: layout.yDom.max,
            leadPt: makeEdgePt(en?.left, layout),
            tailPt: makeEdgePt(en?.right, layout),
        };
    },
    lerp(prev, target, phase) {
        /* Per-quantity clocks: xs follow the cursor (alphaInstant), per-
         *  point values smooth on alphaShort, the y-domain breathes on
         *  alphaScale. Peaks entering/leaving the window glide rather
         *  than flash. */
        const dRef = { value: 0 };
        return {
            state: {
                xs: lerpNumberArray(prev.xs, target.xs, phase.alphaInstant, dRef),
                vs: lerpNumberArray(prev.vs, target.vs, phase.alphaShort, dRef),
                values: target.values,
                labels: target.labels,
                statuses: target.statuses,
                defined: target.defined,
                baseY: lerpNumber(prev.baseY, target.baseY, phase.alpha, dRef),
                color: target.color,
                strokeColor: target.strokeColor,
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
        /* Rebuild yS from the eased y-domain — the LAYOUT's yS is fixed
         *  at the directive's target domain, which doesn't match what
         *  the eased state's yDomMin/yDomMax represent mid-tween. */
        const yS = linearScale([state.yDomMin, state.yDomMax], [state.plotYR[1], state.plotYR[0]]);
        const ys = state.vs.map(yS);
        /* Baseline pixel (value 0). Clamps EXTRAPOLATED edge neighbors so a
         * declining trailing/leading series can't project the area below
         * zero past the last real bucket. */
        const floorY = yS(0);
        const pres = chart.presentation;

        /* Edge neighbors project from DEFINED points only, with floorY
         *  clamp (area-specific). */
        const defIdx: number[] = [];
        for (let i = 0; i < state.defined.length; i++) if (state.defined[i] !== false) defIdx.push(i);
        const dxs = defIdx.map(i => state.xs[i]);
        const dys = defIdx.map(i => ys[i]);
        const leadProj = defIdx.length ? projectEdgePt(state.leadPt, yS, dxs, dys, 'left', floorY) : undefined;
        const tailProj = defIdx.length ? projectEdgePt(state.tailPt, yS, dxs, dys, 'right', floorY) : undefined;

        const segPts: SegPoint[] = state.xs.map((x, i) => ({
            x, y: ys[i], defined: state.defined[i],
            dash: resolveBucketStyle(state.statuses[i], pres).dash,
        }));
        /* One fill band + one stroke per run — a gap holes the fill too;
         *  a dash boundary splits the stroke. */
        const segments = buildCurveSegments(segPts, leadProj, tailProj, layout.xR[0], layout.xR[1]);
        const out: Primitive[] = [];
        for (const seg of segments) {
            out.push({
                kind: 'area-band',
                top: seg.points,
                base: state.baseY,
                color: state.color,
                gradient: { topOpacity: 0.75, bottomOpacity: 0 },
                data: undefined,
            });
            out.push({
                kind: 'polyline',
                points: seg.points,
                strokeWidth: 1.5,
                color: state.strokeColor,
                dash: seg.dash,
                data: undefined,
            });
        }
        appendHoverRails(out, state.xs, state.plotYR, (i) => ({
            idx: i, label: state.labels[i], value: state.values[i],
        }));
        return out;
    },
};
