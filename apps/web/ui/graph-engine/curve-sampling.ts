/**
 * Cartesian curve sampling shared by the molecule-substrate chart configs
 * (area, line, future). Pure geometry, no GL.
 */

/** Compute the curve's Y at a given normalized column index 0..cols-1.
 *  Linear-interpolates between the two input points bracketing that X.
 *  Input points must be sorted by X ascending. */
export function curveYAtCol(
    points: ReadonlyArray<{ x: number; y: number }>,
    col: number,
    cols: number,
): number {
    if (points.length === 0) return 0;
    if (points.length === 1) return points[0].y;
    const minX = points[0].x;
    const maxX = points[points.length - 1].x;
    const targetX = minX + (col / (cols - 1)) * (maxX - minX);
    let lo = 0;
    for (let k = 1; k < points.length; k++) {
        if (points[k].x >= targetX) { lo = k - 1; break; }
        lo = k;
    }
    const hi = Math.min(points.length - 1, lo + 1);
    const span = points[hi].x - points[lo].x;
    const t = span > 0 ? (targetX - points[lo].x) / span : 0;
    return points[lo].y + (points[hi].y - points[lo].y) * t;
}

/** Target pixel spacing between adjacent spline samples. Smoothness is a
 *  property of how many pixels the curve occupies on screen — not of how
 *  many data points it carries. A 3-point sparkline over 800px and a
 *  300-point dashboard chart over 800px should both render with the same
 *  visual fluidity, so we sample the spline at fixed pixel intervals.
 *
 *  4px is below the threshold where a polyline reads as faceted on a
 *  typical display (1× DPR). The GPU resamples per-pixel anyway; this
 *  knob just sets how many anchor points the rasterizer interpolates
 *  between. Smaller = smoother + more verts; larger = coarser + fewer.
 *  4px hits the sweet spot empirically. */
const PX_PER_SAMPLE = 4;

/** Minimum / maximum samples per input span. Floor guards against
 *  degenerate cases (zero-width chart, coincident points). Ceiling
 *  prevents pathological vertex counts when the chart is extremely
 *  wide relative to data density (e.g. a 2-point line over 4000px
 *  would otherwise emit 1000 samples in one span). */
const MIN_SAMPLES_PER_SPAN = 1;
const MAX_SAMPLES_PER_SPAN = 64;

/** Densify `pts` into a smooth monotone-cubic-spline point array,
 *  sampling at ~`PX_PER_SAMPLE` pixel intervals across the curve's
 *  pixel span. Input `x` values must already be in pixel space (the
 *  layout returns them via `pointAt`/`yS`). Returns the original array
 *  unchanged when fewer than 3 points. */
export function smoothPoints(
    pts: ReadonlyArray<{ x: number; y: number }>,
): { x: number; y: number }[] {
    const n = pts.length;
    if (n < 3) return pts as { x: number; y: number }[];
    const ms = monotoneSlopes(pts);
    const out: { x: number; y: number }[] = [];
    for (let i = 0; i < n - 1; i++) {
        const dx = pts[i + 1].x - pts[i].x;
        /* Samples for this span scale with its pixel width so spans
         *  with wider gaps get proportionally more anchors. */
        const steps = Math.max(
            MIN_SAMPLES_PER_SPAN,
            Math.min(MAX_SAMPLES_PER_SPAN, Math.ceil(Math.abs(dx) / PX_PER_SAMPLE)),
        );
        const m0 = ms[i] * dx;
        const m1 = ms[i + 1] * dx;
        for (let s = 0; s < steps; s++) {
            const t = s / steps;
            const t2 = t * t, t3 = t2 * t;
            const h00 = 2 * t3 - 3 * t2 + 1;
            const h10 = t3 - 2 * t2 + t;
            const h01 = -2 * t3 + 3 * t2;
            const h11 = t3 - t2;
            out.push({
                x: pts[i].x + t * dx,
                y: h00 * pts[i].y + h10 * m0 + h01 * pts[i + 1].y + h11 * m1,
            });
        }
    }
    out.push({ x: pts[n - 1].x, y: pts[n - 1].y });
    return out;
}

function monotoneSlopes(pts: ReadonlyArray<{ x: number; y: number }>): number[] {
    const n = pts.length;
    const d: number[] = [];
    for (let i = 0; i < n - 1; i++) {
        const dx = pts[i + 1].x - pts[i].x;
        d.push(dx === 0 ? 0 : (pts[i + 1].y - pts[i].y) / dx);
    }
    const m: number[] = [d[0]];
    for (let i = 1; i < n - 1; i++) {
        m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
    }
    m.push(d[n - 2]);
    for (let i = 0; i < n - 1; i++) {
        if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
        const a = m[i] / d[i], b = m[i + 1] / d[i];
        const s = a * a + b * b;
        if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
    return m;
}
