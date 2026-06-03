/**
 * Animated multi-line family — one polyline per series with weight-
 * tweened opacity. Single-line sibling lives in
 * `animated-cartesian-lines.ts`; shared edge / yDom helpers in
 * `animated-curve-helpers.ts`.
 */

import { cs, seriesColorFor, weightOf } from './svg-parts.js';
import type { Primitive } from './chart-primitive.types.js';
import type { CartesianLayout } from './chart-primitives-cartesian.js';
import { lerpNumber, lerpNumberArray, type AnimatedFamily } from './animated-family.js';
import type { DatumStatus } from '../../architect/fold-atoms.js';
import { appendHoverRails } from './animated-curves-rails.js';
import { linearScale } from './scales.js';
import { curveSegmentsFor } from './curve-segments.js';
import { appendMarkers } from './curve-markers.js';
import { resolveBucketStyle, resolveStatuses } from './datum-status-style.js';
import { type EdgePtState, lerpEdgePt } from './animated-curve-helpers.js';

export interface MultiLineState {
    series: {
        id: string;
        xs: number[];
        /** Raw per-series weighted value at each point. */
        vs: number[];
        /** Per-point presence for THIS series (missing is per-series:
         *  one series can be null where another isn't). */
        defined: boolean[];
        color: string;
        weight: number;
        leadPt?: EdgePtState;
        tailPt?: EdgePtState;
    }[];
    labels: string[];
    /** Per-bucket status (shared across series — a forecast applies to
     *  the whole bucket). Drives dash + markers. */
    statuses: DatumStatus[];
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
        if (chart.__buckets && chart.__buckets.length > 0) {
            const aggs = chart.__buckets;
            const plotW = layout.xR[1] - layout.xR[0];
            const toPx = (xNorm: number) => layout.xR[0] + xNorm * plotW;
            const xs = aggs.map(b => toPx(b.xCenter));
            const rowValues: Record<string, number>[] = aggs.map(b => ({ ...b.seriesValues }));
            /* Atomic path: `defined` is per-bucket (the fold yields one
             *  flag per bucket), shared by every series. Per-series gaps
             *  are a legacy-path feature (see below). */
            const bucketDefined = aggs.map(b => b.defined);
            return {
                series: series.map((s, si) => {
                    const sw = weightOf(s, chart.seriesWeights);
                    const vs = aggs.map(b => (b.seriesValues[s] || 0) * sw);
                    return {
                        id: s,
                        xs, vs,
                        defined: bucketDefined,
                        color: seriesColorFor(c, s, si),
                        weight: sw,
                        leadPt: makeSeriesNeighbor('left', s, sw),
                        tailPt: makeSeriesNeighbor('right', s, sw),
                    };
                }),
                labels: aggs.map(b => b.startISO),
                statuses: resolveStatuses(aggs.map(b => b.status), chart.statusOverrides, aggs.map(b => b.startISO)),
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
                /* Legacy path: per-series gap when this series' cell is
                 *  null/undefined (one series can be missing while a
                 *  sibling has data). */
                const defined = data.map((d) => d[s] != null);
                return {
                    id: s,
                    xs, vs, defined,
                    color: seriesColorFor(c, s, si),
                    weight: sw,
                    leadPt: makeSeriesNeighbor('left', s, sw),
                    tailPt: makeSeriesNeighbor('right', s, sw),
                };
            }),
            labels: layout.labels,
            statuses: resolveStatuses(
                data.map((d) => (d.status as DatumStatus) ?? 'observed'),
                chart.statusOverrides,
            ),
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
                defined: t.defined,
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
                statuses: target.statuses,
                rowValues: target.rowValues,
                plotYR: target.plotYR,
                yDomMin: lerpNumber(prev.yDomMin, target.yDomMin, phase.alphaScale, dRef),
                yDomMax: lerpNumber(prev.yDomMax, target.yDomMax, phase.alphaScale, dRef),
            },
            maxDelta: dRef.value,
        };
    },
    primitives(state, layoutRaw, chart) {
        const out: Primitive[] = [];
        const layout = layoutRaw as CartesianLayout;
        const yS = linearScale([state.yDomMin, state.yDomMax], [state.plotYR[1], state.plotYR[0]]);
        const pres = chart.presentation;
        /* Per-bucket dash from the shared status row — computed once, all
         *  series share it. */
        const dashByBucket = state.statuses.map(st => resolveBucketStyle(st, pres).dash);
        for (const s of state.series) {
            if (s.xs.length < 2) continue;
            const ys = s.vs.map(yS);
            const segments = curveSegmentsFor(
                s.xs, ys, s.defined, dashByBucket, yS,
                s.leadPt, s.tailPt, layout.xR[0], layout.xR[1],
            );
            for (const seg of segments) {
                out.push({
                    kind: 'polyline',
                    points: seg.points,
                    strokeWidth: 1.5,
                    color: s.color,
                    opacity: s.weight,
                    dash: seg.dash,
                    data: { seriesIdx: 0, series: s.id },
                });
            }
            appendMarkers(out, s.xs, ys, state.statuses, s.defined, s.color, layout.xR[0], layout.xR[1], s.weight);
        }
        const first = state.series[0];
        if (first) {
            /* Anchor the rail's crosshair/tooltip to the topmost series'
             *  point at each bucket (smallest pixel-y = highest on screen),
             *  so the marker sits on a real datum rather than mid-plot. */
            const anchorYs = first.xs.map((_x, i) => {
                let best = Infinity;
                for (const s of state.series) {
                    const y = yS(s.vs[i]);
                    if (s.defined[i] !== false && y < best) best = y;
                }
                return Number.isFinite(best) ? best : yS(first.vs[i]);
            });
            appendHoverRails(out, first.xs, state.plotYR, (i) => {
                const row = state.rowValues?.[i] ?? {};
                const merged: Record<string, number> = { ...row };
                for (const s of state.series) if (!(s.id in merged)) merged[s.id] = 0;
                return { idx: i, label: state.labels?.[i] ?? '', rowValues: merged };
            }, anchorYs);
        }
        return out;
    },
};
