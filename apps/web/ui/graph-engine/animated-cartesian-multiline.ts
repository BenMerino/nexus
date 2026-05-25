/**
 * Animated multi-line family — one polyline per series with weight-
 * tweened opacity. Single-line sibling lives in
 * `animated-cartesian-lines.ts`; shared edge / yDom helpers in
 * `animated-curve-helpers.ts`.
 */

import { cs, seriesColor, weightOf } from './svg-parts.js';
import type { Primitive } from './chart-primitive.types.js';
import type { CartesianLayout } from './chart-primitives-cartesian.js';
import { lerpNumber, lerpNumberArray, type AnimatedFamily } from './animated-family.js';
import { smoothPoints } from './curve-sampling.js';
import { bucketAggregates } from '../../architect/place-atoms.js';
import { appendHoverRails } from './animated-curves-rails.js';
import { clipPolylineX } from './curve-edge-neighbors.js';
import { linearScale } from './scales.js';
import { type EdgePtState, lerpEdgePt, projectEdgePt } from './animated-curve-helpers.js';

export interface MultiLineState {
    series: {
        id: string;
        xs: number[];
        /** Raw per-series weighted value at each point. */
        vs: number[];
        color: string;
        weight: number;
        leadPt?: EdgePtState;
        tailPt?: EdgePtState;
    }[];
    labels: string[];
    rowValues: Record<string, number>[];
    plotYR: [number, number];
    yDomMin: number;
    yDomMax: number;
}

export const animatedMultiLine: AnimatedFamily<MultiLineState> = {
    sample(chart, layoutRaw) {
        const layout = layoutRaw as CartesianLayout;
        const series = chart.series || [];
        const c = cs(chart);
        const en = chart.__edgeNeighbors;
        const makeSeriesNeighbor = (
            side: 'left' | 'right', s: string, sw: number,
        ): EdgePtState | undefined => {
            const n = side === 'left' ? en?.left : en?.right;
            if (!n) return undefined;
            const plotW = layout.xR[1] - layout.xR[0];
            const x = layout.xR[0] + n.xCenter * plotW;
            if (!n.isExtrapolated) {
                return { x, v: (n.seriesValues?.[s] ?? 0) * sw, extrapolated: false };
            }
            return { x, v: undefined, extrapolated: true };
        };
        if (chart.atoms && chart.__placements && chart.atoms.length === chart.__placements.length) {
            const aggs = bucketAggregates(chart.atoms, chart.__placements, series);
            const plotW = layout.xR[1] - layout.xR[0];
            const toPx = (xNorm: number) => layout.xR[0] + xNorm * plotW;
            const xs = aggs.map(b => toPx(b.xCenter));
            const rowValues: Record<string, number>[] = aggs.map(b => ({ ...b.seriesValues }));
            return {
                series: series.map((s, si) => {
                    const sw = weightOf(s, chart.seriesWeights);
                    const vs = aggs.map(b => (b.seriesValues[s] || 0) * sw);
                    return {
                        id: s,
                        xs, vs,
                        color: seriesColor(c, si),
                        weight: sw,
                        leadPt: makeSeriesNeighbor('left', s, sw),
                        tailPt: makeSeriesNeighbor('right', s, sw),
                    };
                }),
                labels: aggs.map(b => b.startISO),
                rowValues,
                plotYR: layout.yR,
                yDomMin: layout.yDom.min,
                yDomMax: layout.yDom.max,
            };
        }
        const data = chart.data as any[];
        const rowValues: Record<string, number>[] = data.map((d) => {
            const row: Record<string, number> = {};
            for (const s of series) row[s] = d[s] || 0;
            return row;
        });
        return {
            series: series.map((s, si) => {
                const sw = weightOf(s, chart.seriesWeights);
                const xs = data.map((_d, i) => layout.pointAt(i));
                const vs = data.map((d) => (d[s] || 0) * sw);
                return {
                    id: s,
                    xs, vs,
                    color: seriesColor(c, si),
                    weight: sw,
                    leadPt: makeSeriesNeighbor('left', s, sw),
                    tailPt: makeSeriesNeighbor('right', s, sw),
                };
            }),
            labels: layout.labels,
            rowValues,
            plotYR: layout.yR,
            yDomMin: layout.yDom.min,
            yDomMax: layout.yDom.max,
        };
    },
    lerp(prev, target, phase) {
        const dRef = { value: 0 };
        const prevById = new Map(prev.series.map(s => [s.id, s]));
        const out = target.series.map(t => {
            const p = prevById.get(t.id) ?? t;
            return {
                id: t.id,
                xs: lerpNumberArray(p.xs, t.xs, phase.alphaInstant, dRef),
                vs: lerpNumberArray(p.vs, t.vs, phase.alphaShort, dRef),
                color: t.color,
                weight: lerpNumber(p.weight, t.weight, phase.alpha, dRef),
                leadPt: lerpEdgePt(p.leadPt, t.leadPt, phase.alphaInstant, phase.alphaShort, dRef),
                tailPt: lerpEdgePt(p.tailPt, t.tailPt, phase.alphaInstant, phase.alphaShort, dRef),
            };
        });
        return {
            state: {
                series: out,
                labels: target.labels,
                rowValues: target.rowValues,
                plotYR: target.plotYR,
                yDomMin: lerpNumber(prev.yDomMin, target.yDomMin, phase.alphaScale, dRef),
                yDomMax: lerpNumber(prev.yDomMax, target.yDomMax, phase.alphaScale, dRef),
            },
            maxDelta: dRef.value,
        };
    },
    primitives(state, layoutRaw) {
        const out: Primitive[] = [];
        const layout = layoutRaw as CartesianLayout;
        const yS = linearScale([state.yDomMin, state.yDomMax], [state.plotYR[1], state.plotYR[0]]);
        for (const s of state.series) {
            if (s.xs.length < 2) continue;
            const ys = s.vs.map(yS);
            const pts: { x: number; y: number }[] = [];
            const leadProj = projectEdgePt(s.leadPt, yS, s.xs, ys, 'left');
            const tailProj = projectEdgePt(s.tailPt, yS, s.xs, ys, 'right');
            if (leadProj) pts.push(leadProj);
            for (let i = 0; i < s.xs.length; i++) pts.push({ x: s.xs[i], y: ys[i] });
            if (tailProj) pts.push(tailProj);
            const points = clipPolylineX(smoothPoints(pts), layout.xR[0], layout.xR[1]);
            out.push({
                kind: 'polyline',
                points,
                strokeWidth: 1.5,
                color: s.color,
                opacity: s.weight,
                data: { seriesIdx: 0, series: s.id },
            });
        }
        const first = state.series[0];
        if (first) {
            appendHoverRails(out, first.xs, state.plotYR, (i) => {
                const row = state.rowValues?.[i] ?? {};
                const merged: Record<string, number> = { ...row };
                for (const s of state.series) if (!(s.id in merged)) merged[s.id] = 0;
                return { idx: i, label: state.labels?.[i] ?? '', rowValues: merged };
            });
        }
        return out;
    },
};
