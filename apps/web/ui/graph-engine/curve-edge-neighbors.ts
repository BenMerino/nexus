/**
 * Edge-neighbor resolver for curve families (line, area, stacked-area,
 * multi-line). Converts the directive's `__edgeNeighbors` payload —
 * normalized-x position + raw value — into world-space (x, y) the
 * smoothed-curve primitive builder can consume.
 *
 * Why a helper: all four curve families need the same conversion +
 * extrapolation fallback. Inlining it four times would drift.
 */

import type { CartesianLayout } from './chart-primitives-cartesian.js';

export interface EdgeNeighborInput {
    xCenter: number;
    value: number;
    isExtrapolated: boolean;
}

type EdgeNeighborPayload = EdgeNeighborInput & { seriesValues?: Record<string, number> };
type NeighborBucket = { startKey: number; endKey: number; value: number } & Record<string, unknown>;

/** Build the directive's `__edgeNeighbors` payload from the folded
 *  buckets (the PRODUCER side; `resolveEdgeNeighbor` above is the
 *  consumer). When a real bucket exists immediately beyond the window,
 *  carry its true value; at a timeline boundary, emit an extrapolation
 *  marker one bucket-width outside the edge — the family computes the
 *  y lazily because it needs layout-dependent visible points. Returns
 *  undefined when neither side has a neighbor (single-bucket views). */
export function computeEdgeNeighbors(
    buckets: ReadonlyArray<NeighborBucket>,
    overlapping: ReadonlyArray<NeighborBucket>,
    windowStartKey: number,
    windowEndKey: number,
    winSpan: number,
    seriesList: ReadonlyArray<string>,
): { left?: EdgeNeighborPayload; right?: EdgeNeighborPayload } | undefined {
    const firstVisibleIdx = buckets.findIndex(b => b.endKey >= windowStartKey && b.startKey <= windowEndKey);
    const lastVisibleIdx = (() => {
        for (let i = buckets.length - 1; i >= 0; i--) {
            if (buckets[i].endKey >= windowStartKey && buckets[i].startKey <= windowEndKey) return i;
        }
        return -1;
    })();
    const neighborFor = (b: NeighborBucket): EdgeNeighborPayload => {
        const xStart = (b.startKey - windowStartKey) / winSpan;
        const xEnd = (b.endKey + 1 - windowStartKey) / winSpan;
        const sv: Record<string, number> = {};
        for (const s of seriesList) {
            const v = b[s];
            if (typeof v === 'number') sv[s] = v;
        }
        return {
            xCenter: (xStart + xEnd) / 2,
            value: b.value,
            seriesValues: seriesList.length > 0 ? sv : undefined,
            isExtrapolated: false,
        };
    };
    /* Extrapolation marker one bucket-width outside the given edge bucket. */
    const markerFor = (edge: NeighborBucket, side: 'left' | 'right'): EdgeNeighborPayload => {
        const xStart = Math.max(0, (edge.startKey - windowStartKey) / winSpan);
        const xEnd = Math.min(1, (edge.endKey + 1 - windowStartKey) / winSpan);
        const w = xEnd - xStart;
        return {
            xCenter: side === 'left' ? xStart - w / 2 : xEnd + w / 2,
            value: 0, // placeholder; the family replaces it with the extrapolated y
            seriesValues: seriesList.length > 0 ? Object.fromEntries(seriesList.map(s => [s, 0])) : undefined,
            isExtrapolated: true,
        };
    };
    const out: { left?: EdgeNeighborPayload; right?: EdgeNeighborPayload } = {};
    if (firstVisibleIdx > 0) {
        out.left = neighborFor(buckets[firstVisibleIdx - 1]);
    } else if (firstVisibleIdx === 0 && overlapping.length >= 2) {
        out.left = markerFor(overlapping[0], 'left');
    }
    if (lastVisibleIdx >= 0 && lastVisibleIdx < buckets.length - 1) {
        out.right = neighborFor(buckets[lastVisibleIdx + 1]);
    } else if (lastVisibleIdx === buckets.length - 1 && overlapping.length >= 2) {
        out.right = markerFor(overlapping[overlapping.length - 1], 'right');
    }
    return (out.left || out.right) ? out : undefined;
}

/** Resolve one off-window edge neighbor into world-space coords. When
 *  the neighbor is real (a bucket exists beyond the window), uses its
 *  true bucket value. When extrapolated (timeline boundary, no further
 *  data), linearly extends from the two visible edge points so the
 *  smoothed curve has somewhere to head toward. Caller passes the two
 *  innermost visible points (closest two on this side); when fewer
 *  than two visible points exist, falls back to the single visible
 *  point's y (flat-line continuation). */
export function resolveEdgeNeighbor(
    neighbor: EdgeNeighborInput | undefined,
    side: 'left' | 'right',
    visibleXs: ReadonlyArray<number>,
    visibleYs: ReadonlyArray<number>,
    layout: CartesianLayout,
): { x: number; y: number } | undefined {
    if (!neighbor) return undefined;
    const plotW = layout.xR[1] - layout.xR[0];
    const x = layout.xR[0] + neighbor.xCenter * plotW;
    if (!neighbor.isExtrapolated) {
        return { x, y: layout.yS(neighbor.value) };
    }
    const y = extrapolateAtX(visibleXs, visibleYs, side, x);
    if (y === undefined) return undefined;
    return { x, y };
}

/** Extrapolate y at world-x `x` from the two closest visible points
 *  on the given side. Returns undefined when fewer than one visible
 *  point exists. With exactly one, holds that point's y flat. */
export function extrapolateAtX(
    visibleXs: ReadonlyArray<number>,
    visibleYs: ReadonlyArray<number>,
    side: 'left' | 'right',
    x: number,
): number | undefined {
    if (visibleXs.length === 0) return undefined;
    if (visibleXs.length === 1) return visibleYs[0];
    const i0 = side === 'left' ? 0 : visibleXs.length - 1;
    const i1 = side === 'left' ? 1 : visibleXs.length - 2;
    const x0 = visibleXs[i0];
    const x1 = visibleXs[i1];
    const y0 = visibleYs[i0];
    const y1 = visibleYs[i1];
    const dx = x1 - x0;
    if (dx === 0) return y0;
    return y0 + ((y1 - y0) / dx) * (x - x0);
}

/** Clip a polyline to a horizontal x-range, replacing the first/last
 *  segments that straddle the boundary with linearly-interpolated
 *  points exactly on the boundary. Used by curve families to anchor
 *  the smoothed polyline at the plot's left and right edges — the
 *  area-band's vertical sides then fall ON the plot border (invisible
 *  against it) rather than at some inset world-x that slides visibly
 *  during pan.
 *
 *  Input must be sorted ascending by x. The output preserves curve
 *  density between the boundaries; only the two boundary points
 *  themselves are interpolated. Returns an empty array when the
 *  polyline is entirely outside `[xMin, xMax]`. */
export function clipPolylineX(
    pts: ReadonlyArray<{ x: number; y: number }>,
    xMin: number,
    xMax: number,
): { x: number; y: number }[] {
    if (pts.length === 0 || xMin >= xMax) return [];
    const out: { x: number; y: number }[] = [];
    for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const prev = i > 0 ? pts[i - 1] : null;
        const inRange = p.x >= xMin && p.x <= xMax;
        /* Crossing into range from below: emit a boundary point on the
         *  segment (prev, p) at x=xMin. */
        if (prev && prev.x < xMin && p.x >= xMin) {
            const t = (xMin - prev.x) / (p.x - prev.x);
            out.push({ x: xMin, y: prev.y + (p.y - prev.y) * t });
        }
        /* Crossing out of range past xMax: emit a boundary point and
         *  stop — anything after is outside the plot. */
        if (prev && prev.x <= xMax && p.x > xMax) {
            const t = (xMax - prev.x) / (p.x - prev.x);
            out.push({ x: xMax, y: prev.y + (p.y - prev.y) * t });
            return out;
        }
        if (inRange) out.push(p);
    }
    return out;
}
