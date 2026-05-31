/**
 * Animated stacked-area family. Single-series area lives in
 * `animated-cartesian-areas.ts`; line variants in
 * `animated-cartesian-lines.ts`. Shared per-vertex / edge-neighbor /
 * yDom plumbing is in `animated-curve-helpers.ts`.
 */

import { cs, seriesColorFor, weightOf } from './svg-parts.js';
import type { Primitive } from './chart-primitive.types.js';
import type { CartesianLayout } from './chart-primitives-cartesian.js';
import { lerpNumber, lerpNumberArray, type AnimatedFamily } from './animated-family.js';
import { smoothPoints } from './curve-sampling.js';
import { bucketAggregates } from '../../architect/place-atoms.js';
import { appendHoverRails } from './animated-curves-rails.js';
import { extrapolateAtX, clipPolylineX } from './curve-edge-neighbors.js';
import { linearScale } from './scales.js';
import {
    type StackedEdgePtState,
    lerpStackedEdgePt,
} from './animated-curve-helpers.js';

export interface StackedAreaState {
    layers: {
        id: string;
        /** Per-point cumulative TOP value (raw, not pixel). */
        topVs: number[];
        /** Per-point cumulative BASE value. */
        baseVs: number[];
        xs: number[];
        color: string;
        weight: number;
        leadPt?: StackedEdgePtState;
        tailPt?: StackedEdgePtState;
    }[];
    labels: string[];
    rowValues: Record<string, number>[];
    plotYR: [number, number];
    yDomMin: number;
    yDomMax: number;
}

export const animatedStackedArea: AnimatedFamily<StackedAreaState> = {
    sample(chart, layoutRaw) {
        const layout = layoutRaw as CartesianLayout;
        const series = chart.series || [];
        const c = cs(chart);
        const en = chart.__edgeNeighbors;
        const leftReal = en?.left && !en.left.isExtrapolated ? en.left : null;
        const rightReal = en?.right && !en.right.isExtrapolated ? en.right : null;
        const leftExt = en?.left && en.left.isExtrapolated ? en.left : null;
        const rightExt = en?.right && en.right.isExtrapolated ? en.right : null;
        if (chart.atoms && chart.__placements && chart.atoms.length === chart.__placements.length) {
            const aggs = bucketAggregates(chart.atoms, chart.__placements, series);
            const plotW = layout.xR[1] - layout.xR[0];
            const toPx = (xNorm: number) => layout.xR[0] + xNorm * plotW;
            const xs = aggs.map(b => toPx(b.xCenter));
            const cum: number[] = aggs.map(() => 0);
            const rowValues: Record<string, number>[] = aggs.map(b => ({ ...b.seriesValues }));
            const neighborX = (norm: number) => layout.xR[0] + norm * plotW;
            let leftCum = 0;
            let rightCum = 0;
            return {
                layers: series.map((s, si) => {
                    const sw = weightOf(s, chart.seriesWeights);
                    const baseVs = aggs.map((_b, i) => cum[i]);
                    const topVs = aggs.map((b, i) => {
                        cum[i] += (b.seriesValues[s] || 0) * sw;
                        return cum[i];
                    });
                    let leadPt: StackedEdgePtState | undefined;
                    let tailPt: StackedEdgePtState | undefined;
                    if (leftReal) {
                        const baseV = leftCum;
                        leftCum += (leftReal.seriesValues?.[s] || 0) * sw;
                        leadPt = { x: neighborX(leftReal.xCenter), topV: leftCum, baseV, extrapolated: false };
                    } else if (leftExt) {
                        leadPt = { x: neighborX(leftExt.xCenter), topV: undefined, baseV: undefined, extrapolated: true };
                    }
                    if (rightReal) {
                        const baseV = rightCum;
                        rightCum += (rightReal.seriesValues?.[s] || 0) * sw;
                        tailPt = { x: neighborX(rightReal.xCenter), topV: rightCum, baseV, extrapolated: false };
                    } else if (rightExt) {
                        tailPt = { x: neighborX(rightExt.xCenter), topV: undefined, baseV: undefined, extrapolated: true };
                    }
                    return {
                        id: s,
                        topVs, baseVs, xs,
                        color: seriesColorFor(c, s, si),
                        weight: sw,
                        leadPt, tailPt,
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
        const cum: number[] = data.map(() => 0);
        const xs = data.map((_d, i) => layout.pointAt(i));
        const rowValues: Record<string, number>[] = data.map((d) => {
            const row: Record<string, number> = {};
            for (const s of series) row[s] = d[s] || 0;
            return row;
        });
        return {
            layers: series.map((s, si) => {
                const sw = weightOf(s, chart.seriesWeights);
                const baseVs = data.map((_d, i) => cum[i]);
                const topVs = data.map((d, i) => {
                    cum[i] += (d[s] || 0) * sw;
                    return cum[i];
                });
                return {
                    id: s,
                    topVs, baseVs, xs,
                    color: seriesColorFor(c, s, si),
                    weight: sw,
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
        const prevById = new Map(prev.layers.map(l => [l.id, l]));
        const out = target.layers.map(t => {
            const p = prevById.get(t.id) ?? t;
            return {
                id: t.id,
                topVs: lerpNumberArray(p.topVs, t.topVs, phase.alphaShort, dRef),
                baseVs: lerpNumberArray(p.baseVs, t.baseVs, phase.alphaShort, dRef),
                xs: lerpNumberArray(p.xs, t.xs, phase.alphaInstant, dRef),
                color: t.color,
                weight: lerpNumber(p.weight, t.weight, phase.alpha, dRef),
                leadPt: lerpStackedEdgePt(p.leadPt, t.leadPt, phase.alphaInstant, phase.alphaShort, dRef),
                tailPt: lerpStackedEdgePt(p.tailPt, t.tailPt, phase.alphaInstant, phase.alphaShort, dRef),
            };
        });
        return {
            state: {
                layers: out,
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
        const fills: Primitive[] = [];
        const strokes: Primitive[] = [];
        const layout = layoutRaw as CartesianLayout;
        const yS = linearScale([state.yDomMin, state.yDomMax], [state.plotYR[1], state.plotYR[0]]);
        for (const l of state.layers) {
            if (l.xs.length < 2) continue;
            /* Degenerate-skip: weight near zero collapses top onto base. */
            if (l.weight < 0.01) continue;
            const topYs = l.topVs.map(yS);
            const baseYs = l.baseVs.map(yS);
            /* Baseline pixel (value 0). Stacked cumulative values are all
             * ≥0, so an extrapolated edge must never project below it —
             * otherwise a declining trailing series dips the band negative
             * past the last real bucket ("future goes negative"). */
            const floorY = yS(0);
            const rawTops: { x: number; y: number }[] = [];
            const rawBases: { x: number; y: number }[] = [];
            const projectStackedEdge = (
                pt: StackedEdgePtState | undefined, side: 'left' | 'right',
            ): { top: number; base: number } | undefined => {
                if (!pt) return undefined;
                if (!pt.extrapolated && pt.topV !== undefined && pt.baseV !== undefined) {
                    return { top: yS(pt.topV), base: yS(pt.baseV) };
                }
                const topRaw = extrapolateAtX(l.xs, topYs, side, pt.x);
                const baseRaw = extrapolateAtX(l.xs, baseYs, side, pt.x);
                if (topRaw === undefined || baseRaw === undefined) return undefined;
                return { top: Math.min(topRaw, floorY), base: Math.min(baseRaw, floorY) };
            };
            const leadProj = projectStackedEdge(l.leadPt, 'left');
            const tailProj = projectStackedEdge(l.tailPt, 'right');
            if (leadProj && l.leadPt) {
                rawTops.push({ x: l.leadPt.x, y: leadProj.top });
                rawBases.push({ x: l.leadPt.x, y: leadProj.base });
            }
            for (let i = 0; i < l.xs.length; i++) {
                rawTops.push({ x: l.xs[i], y: topYs[i] });
                rawBases.push({ x: l.xs[i], y: baseYs[i] });
            }
            if (tailProj && l.tailPt) {
                rawTops.push({ x: l.tailPt.x, y: tailProj.top });
                rawBases.push({ x: l.tailPt.x, y: tailProj.base });
            }
            const top = clipPolylineX(smoothPoints(rawTops), layout.xR[0], layout.xR[1]);
            const base = clipPolylineX(smoothPoints(rawBases), layout.xR[0], layout.xR[1]);
            fills.push({
                kind: 'area-band',
                top, base,
                color: l.color,
                gradient: { topOpacity: 0.75, bottomOpacity: 0 },
                data: { seriesIdx: 0, series: l.id },
            });
            strokes.push({
                kind: 'polyline',
                points: top,
                strokeWidth: 1.5,
                color: l.color,
                opacity: l.weight,
                data: undefined,
            });
        }
        /* Strokes after fills so the top-edge line sits above the bands. */
        const out: Primitive[] = [...fills, ...strokes];
        const first = state.layers[0];
        if (first) {
            appendHoverRails(out, first.xs, state.plotYR, (i) => {
                const row = state.rowValues?.[i] ?? {};
                const merged: Record<string, number> = { ...row };
                for (const l of state.layers) if (!(l.id in merged)) merged[l.id] = 0;
                return { idx: i, label: state.labels?.[i] ?? '', rowValues: merged };
            });
        }
        return out;
    },
};
