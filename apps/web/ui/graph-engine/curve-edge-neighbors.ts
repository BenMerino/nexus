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
