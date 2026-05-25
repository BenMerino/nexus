/**
 * Vertex-packing helpers for the chart geometry pipeline.
 *
 * Every chart family tessellates its primitives into a single triangle
 * list, packed as a Float32Array of 9 floats per vertex:
 *
 *   [pos.x, pos.y, r, g, b, a, gradTopY, gradBotY, bottomMul]
 *
 * The fragment shader computes a vertical gradient as
 *   `span = gradBotY - gradTopY`
 *   `bandY = span > 0 ? clamp((worldY - gradTopY) / span) : 0`
 *   `alpha = color.a * (span > 0 ? mix(1, bottomMul, bandY) : 1)`
 *
 * Per-vertex `gradTopY` and `gradBotY` carry the **band edges at that
 * vertex's X** (not band-wide constants). For an area-band, every
 * vertex at column X carries `(topYAtX, baseYAtX)` — both the top-
 * track and the base-track vertices at that column carry the same
 * pair. The GPU linearly interpolates these along X just like it
 * interpolates position, so at any screen pixel inside the quad the
 * interpolated `(gradTopY, gradBotY)` matches the band's actual top
 * and base at that X. `bandY` is then 0 along the curve, 1 along the
 * base — the gradient follows the silhouette without any diagonal-
 * seam artifact.
 *
 * For non-gradient marks (bars, polygons, circles), defaults
 * `gradTopY=0, gradBotY=0, bottomMul=1` make the shader take the
 * `span <= 0` branch → `alpha = color.a` unchanged.
 *
 * Color is per-vertex so a single buffer can carry differently-colored
 * marks without separate draws.
 */

export const FLOATS_PER_VERTEX = 9;
export const VERTS_PER_TRIANGLE = 3;
export const FLOATS_PER_TRIANGLE = FLOATS_PER_VERTEX * VERTS_PER_TRIANGLE;

export interface RGBA {
    r: number; g: number; b: number; a: number;
}

/** Allocate a Float32Array sized for `triCount` triangles. */
export function allocVertexBuffer(triCount: number): Float32Array {
    return new Float32Array(triCount * FLOATS_PER_TRIANGLE);
}

/** Write one vertex into `out` at index `vIdx`. Defaults
 *  `gradTopY=0, gradBotY=0, bottomMul=1` encode "no gradient": the
 *  shader's `gradBotY <= gradTopY` branch returns `alpha = vColor.a`
 *  unchanged. Gradient-aware writers (area-band, polygon-gradient)
 *  pass the primitive's world-space Y range explicitly. */
export function writeVertex(
    out: Float32Array,
    vIdx: number,
    x: number, y: number,
    color: RGBA,
    gradTopY = 0, gradBotY = 0, bottomMul = 1,
): void {
    const off = vIdx * FLOATS_PER_VERTEX;
    out[off + 0] = x;
    out[off + 1] = y;
    out[off + 2] = color.r;
    out[off + 3] = color.g;
    out[off + 4] = color.b;
    out[off + 5] = color.a;
    out[off + 6] = gradTopY;
    out[off + 7] = gradBotY;
    out[off + 8] = bottomMul;
}

/** Write one filled axis-aligned rectangle as 2 triangles (6 vertices).
 *  Returns the next vertex index after writing. */
export function writeRect(
    out: Float32Array,
    vIdx: number,
    x: number, y: number, w: number, h: number,
    color: RGBA,
): number {
    const x1 = x + w, y1 = y + h;
    /* Tri 1: (x,y) → (x1,y) → (x,y1) */
    writeVertex(out, vIdx + 0, x,  y,  color);
    writeVertex(out, vIdx + 1, x1, y,  color);
    writeVertex(out, vIdx + 2, x,  y1, color);
    /* Tri 2: (x1,y) → (x1,y1) → (x,y1) */
    writeVertex(out, vIdx + 3, x1, y,  color);
    writeVertex(out, vIdx + 4, x1, y1, color);
    writeVertex(out, vIdx + 5, x,  y1, color);
    return vIdx + 6;
}

/** Write a vertical-gradient flat rect: top corners use `topColor`,
 *  bottom corners use `bottomColor`. The GPU interpolates per-pixel
 *  across each triangle, giving a smooth top→bottom fade with no extra
 *  fragment-shader work. Per-vertex alpha works correctly here because
 *  the rect is axis-aligned and both triangles' diagonal endpoints
 *  carry the same Y-aligned alpha — no seam artifact. */
export function writeRectGradient(
    out: Float32Array,
    vIdx: number,
    x: number, y: number, w: number, h: number,
    topColor: RGBA, bottomColor: RGBA,
): number {
    const x1 = x + w, y1 = y + h;
    writeVertex(out, vIdx + 0, x,  y,  topColor);
    writeVertex(out, vIdx + 1, x1, y,  topColor);
    writeVertex(out, vIdx + 2, x,  y1, bottomColor);
    writeVertex(out, vIdx + 3, x1, y,  topColor);
    writeVertex(out, vIdx + 4, x1, y1, bottomColor);
    writeVertex(out, vIdx + 5, x,  y1, bottomColor);
    return vIdx + 6;
}


/* Higher-level shape tessellators live in adjacent modules to keep
 * this file lean. Re-exported here so the existing public surface
 * stays single-source for callers. */
export { writePolygon, writePolygonGradient } from './chart-vertices-polygon.js';
export {
    writePolylineStroke,
    polylineStrokeTriangles,
} from './chart-vertices-polyline.js';
export { writeAreaBand, areaBandTriangles } from './chart-vertices-area-band.js';
