/**
 * Polygon tessellation — ear-clipping triangulation for simple
 * polygons (convex or concave, no self-intersection). Used by area,
 * stacked-area, radar, funnel, and any future chart family that
 * emits polygon primitives.
 */

import { writeVertex, type RGBA } from './chart-vertices.js';

/** Triangulate a simple polygon (convex OR concave, no self-intersection)
 *  via ear-clipping. Outputs `points.length - 2` triangles regardless of
 *  shape — same triangle count as a fan, so the buffer-size estimate
 *  in `trianglesFor` stays correct.
 *
 *  Algorithm: iterate vertex list, find a "convex ear" (vertex whose
 *  two neighbours form a triangle that lies inside the polygon and
 *  contains no other vertex), emit that triangle, remove the ear vertex,
 *  repeat. O(n²) worst case — fine for chart polygons up to ~hundreds
 *  of vertices.
 *
 *  Robustness: detects polygon orientation (CCW vs CW) and adapts the
 *  convex-vertex test accordingly so authors can hand vertices in
 *  whichever winding feels natural. Falls back to a fan emit when the
 *  ear search stalls (degenerate input — shouldn't happen for chart
 *  data, but guards against infinite loops). */
export function writePolygon(
    out: Float32Array,
    vIdx: number,
    points: ReadonlyArray<{ x: number; y: number }>,
    color: RGBA,
): number {
    return writePolygonInternal(out, vIdx, points, () => color);
}

/** Same triangulation as `writePolygon`, with a shader-driven vertical
 *  gradient: every vertex carries the same `color` (top-edge alpha),
 *  `gradTopY` / `gradBotY` (world-space Y range), and `bottomMul`.
 *  The fragment shader computes
 *    `bandY = (worldPos.y - gradTopY) / (gradBotY - gradTopY)`
 *    `alpha = color.a * mix(1, bottomMul, bandY)`
 *  per pixel — the gradient is a pure function of screen-space Y, so
 *  ear-clipping triangulation produces no diagonal-seam artifacts on
 *  non-rectangular polygons. Used by area/stacked-area charts to fade
 *  fills toward the baseline. */
export function writePolygonGradient(
    out: Float32Array,
    vIdx: number,
    points: ReadonlyArray<{ x: number; y: number }>,
    color: RGBA,
    gradTopY: number,
    gradBotY: number,
    bottomMul: number,
): number {
    return writePolygonInternal(out, vIdx, points, () => color, gradTopY, gradBotY, bottomMul);
}

function writePolygonInternal(
    out: Float32Array,
    vIdx: number,
    points: ReadonlyArray<{ x: number; y: number }>,
    colorAt: (pointIdx: number) => RGBA,
    gradTopY = 0,
    gradBotY = 0,
    bottomMul = 1,
): number {
    const n = points.length;
    if (n < 3) return vIdx;
    /* Degenerate-input guard: when the polygon's signed area is
     * effectively zero (collapsed top/baseline coincident, e.g. a
     * stacked-area layer whose series weight tweened to 0), every
     * triangle the ear-clip would emit is zero-area. Near-degenerate
     * triangles still rasterize to thin streaks that look like
     * visible artifacts. Skip entirely — the buffer was pre-allocated
     * for `n - 2` triangle slots; leaving them unwritten leaves those
     * vertices zero-initialized, including alpha=0, so the rasterizer
     * produces fully transparent (invisible) triangles at the origin
     * that contribute nothing under premultiplied-alpha blending. */
    if (Math.abs(signedArea(points)) < 0.5) return vIdx + (n - 2) * 3;
    /* Shorthand: write a vertex with the polygon's uniform gradient
     *  config (zero/one defaults imply "no gradient"). */
    const emit = (slot: number, idx: number): void => {
        const p = points[idx];
        writeVertex(out, slot, p.x, p.y, colorAt(idx), gradTopY, gradBotY, bottomMul);
    };
    if (n === 3) {
        emit(vIdx + 0, 0);
        emit(vIdx + 1, 1);
        emit(vIdx + 2, 2);
        return vIdx + 3;
    }

    const indices: number[] = new Array(n);
    for (let k = 0; k < n; k++) indices[k] = k;

    const area = signedArea(points);
    if (area > 0) indices.reverse();

    let i = vIdx;
    let guard = n * n + 1;
    while (indices.length > 3 && guard-- > 0) {
        const earK = findEar(points, indices);
        if (earK < 0) break;
        const a = indices[(earK - 1 + indices.length) % indices.length];
        const b = indices[earK];
        const c = indices[(earK + 1) % indices.length];
        emit(i + 0, a);
        emit(i + 1, b);
        emit(i + 2, c);
        i += 3;
        indices.splice(earK, 1);
    }
    if (indices.length === 3) {
        emit(i + 0, indices[0]);
        emit(i + 1, indices[1]);
        emit(i + 2, indices[2]);
        i += 3;
    } else {
        for (let k = 1; k < indices.length - 1; k++) {
            emit(i + 0, indices[0]);
            emit(i + 1, indices[k]);
            emit(i + 2, indices[k + 1]);
            i += 3;
        }
    }
    return i;
}

/* Polygon utility math — kept private to the tessellator. */

function signedArea(points: ReadonlyArray<{ x: number; y: number }>): number {
    let s = 0;
    for (let k = 0; k < points.length; k++) {
        const a = points[k];
        const b = points[(k + 1) % points.length];
        s += (b.x - a.x) * (b.y + a.y);
    }
    return s;
}

/** Cross product (b - a) × (c - a). Positive = CCW turn in math (y-up);
 *  in y-down viewBox coords, positive = clockwise on screen. The caller
 *  pre-orients the index list so "CCW expected" is consistent. */
function cross(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }): number {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function pointInTriangle(
    p: { x: number; y: number },
    a: { x: number; y: number },
    b: { x: number; y: number },
    c: { x: number; y: number },
): boolean {
    const d1 = cross(p, a, b);
    const d2 = cross(p, b, c);
    const d3 = cross(p, c, a);
    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
    const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
    /* Strictly inside (excludes the three corners). */
    return !(hasNeg && hasPos);
}

function findEar(
    points: ReadonlyArray<{ x: number; y: number }>,
    indices: number[],
): number {
    const n = indices.length;
    for (let k = 0; k < n; k++) {
        const a = points[indices[(k - 1 + n) % n]];
        const b = points[indices[k]];
        const c = points[indices[(k + 1) % n]];
        /* Convex test in the post-reorientation list (CCW expected). */
        if (cross(a, b, c) <= 0) continue;
        /* No other polygon vertex inside (a, b, c)? */
        let blocked = false;
        for (let j = 0; j < n; j++) {
            if (j === k || j === (k - 1 + n) % n || j === (k + 1) % n) continue;
            const p = points[indices[j]];
            if (pointInTriangle(p, a, b, c)) { blocked = true; break; }
        }
        if (!blocked) return k;
    }
    return -1;
}
