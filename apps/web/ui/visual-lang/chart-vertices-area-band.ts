/**
 * Area-band tessellation — O(n) triangle-strip writer for monotone-x
 * ribbons (single-area, stacked-area). The shape is a band between two
 * y-tracks sharing the same x positions; each x interval [i, i+1] emits
 * two triangles forming a quad.
 *
 * vs. ear-clipping `writePolygon` (O(n²)): a densified 30-point curve
 * with 8× smoothing becomes ~240 vertices. Ear-clipping costs ~57k ops
 * per polygon per animation frame; this writer costs ~240 — about 240×
 * faster, which is what enables smoothing area fills at no perf cost.
 *
 * Silhouette-following gradient: at each column X, both the top-track
 * vertex and the base-track vertex carry the same `(topYAtX, baseYAtX)`
 * pair. The GPU linearly interpolates these along X — same as it
 * interpolates position — so at any screen pixel the interpolated
 * `gradRange` matches the band's actual edges at that pixel's X. The
 * fragment shader then computes `bandY` per pixel as
 *   `(worldY - topYAtX) / (baseYAtX - topYAtX)`
 * which is 0 along the curve and 1 along the base, regardless of the
 * curve's local slope. Diagonal seam is invisible because both
 * triangles agree on `(topYAtX, baseYAtX)` along their shared edge.
 */

import { writeVertex, type RGBA } from './chart-vertices.js';

/** Triangle count for an area-band with `nTop` top vertices. Each
 *  interval between adjacent top points contributes 2 triangles. */
export function areaBandTriangles(nTop: number): number {
    return Math.max(0, (nTop - 1) * 2);
}

/** Write an area-band as a triangle strip. `topPoints` and the base
 *  track must share x positions and be sorted ascending by x. When
 *  `baseTrack` is a number, the base is a constant Y; otherwise it
 *  must be the same length as `topPoints`. `color.a` is the
 *  top-edge alpha; `bottomMul` scales it at the base track
 *  (0 = fully transparent at the base). When `bottomMul >= 1` or
 *  the band degenerates (top == base), the shader path collapses to
 *  flat fill. */
export function writeAreaBand(
    out: Float32Array,
    vIdx: number,
    topPoints: ReadonlyArray<{ x: number; y: number }>,
    baseTrack: number | ReadonlyArray<{ x: number; y: number }>,
    color: RGBA,
    bottomMul: number,
): number {
    const n = topPoints.length;
    if (n < 2) return vIdx;
    const baseIsConst = typeof baseTrack === 'number';
    const baseConstY = baseIsConst ? (baseTrack as number) : 0;
    const baseArr = baseIsConst ? null : (baseTrack as ReadonlyArray<{ x: number; y: number }>);
    const baseYAt = (i: number): number => (baseArr ? baseArr[i].y : baseConstY);
    let i = vIdx;
    for (let k = 0; k < n - 1; k++) {
        const t0 = topPoints[k];
        const t1 = topPoints[k + 1];
        const b0y = baseYAt(k);
        const b1y = baseYAt(k + 1);
        /* All four vertices in this quad column-pair share the same
         *  per-column (topY, baseY) pair for whichever X they sit at.
         *  Top vertices and base vertices at the SAME column carry
         *  identical gradient attributes — the GPU's linear interp
         *  along X then reproduces the band's edges exactly. */
        /* Tri 1: top[k] → top[k+1] → base[k]. */
        writeVertex(out, i + 0, t0.x, t0.y, color, t0.y, b0y, bottomMul);
        writeVertex(out, i + 1, t1.x, t1.y, color, t1.y, b1y, bottomMul);
        writeVertex(out, i + 2, t0.x, b0y, color, t0.y, b0y, bottomMul);
        /* Tri 2: top[k+1] → base[k+1] → base[k]. */
        writeVertex(out, i + 3, t1.x, t1.y, color, t1.y, b1y, bottomMul);
        writeVertex(out, i + 4, t1.x, b1y, color, t1.y, b1y, bottomMul);
        writeVertex(out, i + 5, t0.x, b0y, color, t0.y, b0y, bottomMul);
        i += 6;
    }
    return i;
}
