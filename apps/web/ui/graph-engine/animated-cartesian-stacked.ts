/**
 * Animated stacked-bar family. Each bucket renders as a vertical stack
 * of per-series segments; segments tween independently (so series
 * toggles fade in/out smoothly) but share the bucket's x geometry.
 *
 * Split out from `animated-cartesian.ts` so each rect family stays
 * under the file-length ceiling and their concerns don't bleed. Shared
 * visual constants and per-bar timing live in `animated-cartesian-shared.ts`.
 */

import { cs, seriesColorFor, weightOf } from './svg-parts.js';
import type { CartesianLayout } from './chart-primitives-cartesian.js';
import { lerpNumber, type AnimatedFamily } from './animated-family.js';
import {
    BAR_TOP_RADIUS_PX,
    BAR_RADIUS_REVEAL_PX,
    PER_BAR_START_SPREAD,
    perBarAlpha,
} from './animated-cartesian-shared.js';

interface StackedBarSegment {
    x: number; y: number; w: number; h: number;
    color: string; hit: unknown;
    /** Bucket (data-row) index. Used by `primitives()` to group all
     *  segments of the same bar so the top-corner radius can be derived
     *  from the eased heights of the segments stacked above. Keeping
     *  `radiusTop` out of the lerped state is what makes the radius
     *  mechanically tied to the on-screen height rather than animating
     *  on its own clock. */
    bucketIdx: number;
    /** Series id — used to pair segments across fold transitions so
     *  Revenue segments tween toward Revenue segments, not Collected. */
    seriesId: string;
    /** Bucket calendar range — see `BarItem.iso`/`isoEnd` for rationale. */
    iso: string;
    isoEnd: string;
}
export interface StackedBarState { segments: StackedBarSegment[]; }

export const animatedStackedBar: AnimatedFamily<StackedBarState> = {
    sample(chart, layoutRaw) {
        const layout = layoutRaw as CartesianLayout;
        const series = chart.series || [];
        const c = cs(chart);
        const segments: StackedBarSegment[] = [];
        if (chart.__buckets && chart.__buckets.length > 0) {
            /* Atomic-flow path: one bucket per fold-aggregated calendar
             *  envelope (the canonical empties-included sequence), M
             *  segments per bucket (one per series). The envelope's
             *  `(xStart, xEnd)` is the bar's full width; segments stack
             *  y-wise inside it. */
            const aggs = chart.__buckets;
            const plotW = layout.xR[1] - layout.xR[0];
            const aggsCount = aggs.length;
            for (let i = 0; i < aggsCount; i++) {
                const b = aggs[i];
                const xs = Math.max(0, Math.min(1, b.xStart));
                const xe = Math.max(0, Math.min(1, b.xEnd));
                const x0 = layout.xR[0] + xs * plotW;
                const x1 = layout.xR[0] + xe * plotW;
                const rawW = x1 - x0;
                /* Edge bars drop outer padding — see `animatedBar`. */
                const pad = rawW * 0.1;
                const leftPad = i === 0 ? 0 : pad;
                const rightPad = i === aggsCount - 1 ? 0 : pad;
                const x = x0 + leftPad;
                const w = Math.max(0, rawW - leftPad - rightPad);
                let y0 = layout.yR[1];
                for (let si = 0; si < series.length; si++) {
                    const sw = weightOf(series[si], chart.seriesWeights);
                    const v = (b.seriesValues[series[si]] || 0) * sw;
                    const segH = Math.max(0, layout.yR[1] - layout.yS(v));
                    const topY = y0 - segH;
                    segments.push({
                        x, y: topY, w, h: segH,
                        color: seriesColorFor(c, series[si], si),
                        hit: { idx: i, seriesIdx: si, label: b.startISO, series: series[si], value: v },
                        bucketIdx: i,
                        seriesId: series[si],
                        iso: b.startISO,
                        isoEnd: '',
                    });
                    y0 = topY;
                }
            }
            return { segments };
        }
        /* Legacy path. */
        const data = chart.data as any[];
        for (let i = 0; i < data.length; i++) {
            const d = data[i];
            const pos = layout.positionAt(i);
            const iso = typeof d.__startISO === 'string' ? d.__startISO : '';
            const isoEnd = typeof d.__endISO === 'string' ? d.__endISO : '';
            let y0 = layout.yR[1];
            for (let si = 0; si < series.length; si++) {
                const sw = weightOf(series[si], chart.seriesWeights);
                const v = (d[series[si]] || 0) * sw;
                const segH = Math.max(0, layout.yR[1] - layout.yS(v));
                const topY = y0 - segH;
                segments.push({
                    x: pos.x, y: topY, w: Math.max(0, pos.width), h: segH,
                    color: seriesColorFor(c, series[si], si),
                    hit: { idx: i, seriesIdx: si, label: layout.labels[i], series: series[si], value: v },
                    bucketIdx: i,
                    seriesId: series[si],
                    iso,
                    isoEnd,
                });
                y0 = topY;
            }
        }
        return { segments };
    },
    lerp(prev, target, phase) {
        const dRef = { value: 0 };
        const n = target.segments.length;
        const { tRaw, alphaX, alphaY } = phase;
        /* Per-bucket staggered matching: same three-class model as
         *  `animatedBar` but for stacked-bar each ENVELOPE (bucket) is
         *  the independent mathematical event. All series-segments
         *  within the same entering bucket share one clock — they're
         *  one event together, splitting only by series. Cascade rank
         *  is the bucket's chronological position (sorted by x). */
        const { matched, usedPrev } = pairSegmentsForFold(prev.segments, target.segments);
        const enteringBucketXs = new Map<number, number>(); // bucketIdx → x
        for (let i = 0; i < n; i++) {
            if (!matched[i]) enteringBucketXs.set(target.segments[i].bucketIdx, target.segments[i].x);
        }
        const enteringBucketRank = new Map<number, number>();
        [...enteringBucketXs.entries()].sort((a, b) => a[1] - b[1]).forEach(([b], r) => enteringBucketRank.set(b, r));
        const enteringTotal = enteringBucketRank.size;
        const exitingPrevBucketXs = new Map<number, number>();
        for (let j = 0; j < prev.segments.length; j++) {
            if (!usedPrev.has(j)) exitingPrevBucketXs.set(prev.segments[j].bucketIdx, prev.segments[j].x);
        }
        const exitingBucketRank = new Map<number, number>();
        [...exitingPrevBucketXs.entries()].sort((a, b) => a[1] - b[1]).forEach(([b], r) => exitingBucketRank.set(b, r));
        const exitingTotal = exitingBucketRank.size;
        const out: StackedBarSegment[] = [];
        for (let i = 0; i < n; i++) {
            const t = target.segments[i];
            const p = matched[i];
            if (p) {
                out.push({
                    x: lerpNumber(p.x, t.x, alphaX, dRef),
                    y: lerpNumber(p.y, t.y, alphaY, dRef),
                    w: lerpNumber(p.w, t.w, alphaX, dRef),
                    h: lerpNumber(p.h, t.h, alphaY, dRef),
                    color: t.color, hit: t.hit,
                    bucketIdx: t.bucketIdx,
                    seriesId: t.seriesId,
                    iso: t.iso,
                    isoEnd: t.isoEnd,
                });
            } else {
                const a = perBarAlpha(tRaw, enteringBucketRank.get(t.bucketIdx) ?? 0, enteringTotal);
                const baseY = t.y + t.h;
                out.push({
                    x: t.x,
                    y: lerpNumber(baseY, t.y, a, dRef),
                    w: t.w,
                    h: lerpNumber(0, t.h, a, dRef),
                    color: t.color, hit: t.hit,
                    bucketIdx: t.bucketIdx,
                    seriesId: t.seriesId,
                    iso: t.iso,
                    isoEnd: t.isoEnd,
                });
            }
        }
        for (let j = 0; j < prev.segments.length; j++) {
            if (usedPrev.has(j)) continue;
            const p = prev.segments[j];
            const a = perBarAlpha(tRaw, exitingBucketRank.get(p.bucketIdx) ?? 0, exitingTotal);
            if (a >= 1) continue;
            const baseY = p.y + p.h;
            out.push({
                x: p.x,
                y: lerpNumber(p.y, baseY, a, dRef),
                w: p.w,
                h: lerpNumber(p.h, 0, a, dRef),
                color: p.color, hit: p.hit,
                bucketIdx: p.bucketIdx,
                seriesId: p.seriesId,
                iso: p.iso,
                isoEnd: p.isoEnd,
            });
        }
        return { state: { segments: out }, maxDelta: dRef.value };
    },
    primitives(state) {
        const segs = state.segments;
        /* coverAbove[k] — height of segments above segment k in its
         *  bucket. Drives the top-corner radius reveal: a segment only
         *  rounds its top once the segment above has shrunk to within
         *  `BAR_RADIUS_REVEAL_PX`. Walked back-to-front, per bucket. */
        const coverAbove = new Array<number>(segs.length);
        let i = segs.length - 1;
        while (i >= 0) {
            const bucket = segs[i].bucketIdx;
            let j = i;
            while (j >= 0 && segs[j].bucketIdx === bucket) j--;
            let acc = 0;
            let k = i;
            while (k >= 0 && segs[k].bucketIdx === bucket) {
                coverAbove[k] = acc;
                acc += segs[k].h;
                k--;
            }
            i = j;
        }
        const out: ReturnType<AnimatedFamily<StackedBarState>['primitives']> = [];
        for (let kk = 0; kk < segs.length; kk++) {
            const s = segs[kk];
            if (s.w <= 0 || s.h <= 0) continue;
            const topFactor = Math.max(0, Math.min(1, 1 - coverAbove[kk] / BAR_RADIUS_REVEAL_PX));
            out.push({
                kind: 'rect' as const,
                x: s.x, y: s.y, w: s.w, h: s.h,
                color: s.color, data: s.hit,
                radiusTop: BAR_TOP_RADIUS_PX * topFactor,
            });
        }
        return out;
    },
};

/** Stacked-bar variant of `pairBarsForFold` — pairs by both series
 *  identity AND calendar containment so each series-stripe stages
 *  independently. Returns matched-prev refs plus the set of prev
 *  indices that found a match; unmatched prev = exiting. */
function pairSegmentsForFold(prev: StackedBarSegment[], target: StackedBarSegment[]): { matched: Array<StackedBarSegment | undefined>; usedPrev: Set<number> } {
    const matched: Array<StackedBarSegment | undefined> = new Array(target.length);
    const usedPrev = new Set<number>();
    /* Index prev by series for O(target * prevInSeries) instead of
     *  O(n²) full scans. Stacked-area charts can run wide. Indices
     *  refer back to the original `prev` array via `idx`. */
    const prevBySeries = new Map<string, Array<{ seg: StackedBarSegment; idx: number }>>();
    for (let j = 0; j < prev.length; j++) {
        const p = prev[j];
        const arr = prevBySeries.get(p.seriesId);
        if (arr) arr.push({ seg: p, idx: j });
        else prevBySeries.set(p.seriesId, [{ seg: p, idx: j }]);
    }
    for (let i = 0; i < target.length; i++) {
        const t = target[i];
        const pool = prevBySeries.get(t.seriesId) ?? [];
        let matchIdx = -1;
        if (t.iso) {
            for (const { seg: p, idx: j } of pool) {
                if (usedPrev.has(j) || !p.iso) continue;
                if (p.isoEnd && t.iso >= p.iso && t.iso < p.isoEnd) { matchIdx = j; break; }
                if (t.isoEnd && p.iso >= t.iso && p.iso < t.isoEnd) { matchIdx = j; break; }
                if (p.iso === t.iso) { matchIdx = j; break; }
            }
        }
        if (matchIdx >= 0) {
            matched[i] = prev[matchIdx];
            usedPrev.add(matchIdx);
        }
    }
    return { matched, usedPrev };
}

