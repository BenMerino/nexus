/**
 * Convert a `Primitive[]` into one packed triangle vertex buffer for the
 * GPU chart pipeline. Single entry point — callers don't see the
 * per-primitive vertex writers; those are implementation detail of this
 * module + the underlying vertex-packing helpers.
 *
 * Behavior:
 *   - Pre-counts triangles to allocate exactly the buffer size needed.
 *   - Resolves each primitive's `color` (CSS var or hex) to RGB once per
 *     unique string per call (in-call cache).
 *   - Applies the `marginPx` offset to every vertex position so the
 *     caller's canvas can be sized larger than its plot rect (for bloom-
 *     halo bleed) without each primitive function having to know about
 *     the margin.
 *   - Handles every primitive kind: rect, polygon (with optional vertical
 *     gradient), polyline (with miter+bevel joins), filled/stroked
 *     circle, arc (pie wedge or annular ring).
 */

import { resolveColor } from '../visual-lang/color.js';
import {
    allocVertexBuffer,
    writeRect,
    writeRectGradient,
    writePolygon,
    writePolygonGradient,
    writePolylineStroke,
    writeAreaBand,
    areaBandTriangles,
    polylineStrokeTriangles,
    type RGBA,
} from '../visual-lang/chart-vertices.js';
import {
    writeRoundedRect,
    writeRoundedRectGradient,
    writeRoundedRectPerCorner,
    writeRoundedRectGradientPerCorner,
    roundedRectTriangles,
} from '../visual-lang/chart-vertices-rounded-rect.js';
import {
    writeCircle,
    writeArc,
    FAN_STEPS,
    ARC_STEPS_PER_RADIAN,
} from './tessellate-radial.js';
import { splitPolylineDash } from '../visual-lang/polyline-dash.js';
import type { Primitive } from './chart-primitive.types.js';

/** Resolve a polyline to its render sub-polylines. Solid ⇒ `[points]`
 *  (one run, zero overhead). Dashed ⇒ the geometric "on" runs. Used by
 *  BOTH the triangle pre-count and the vertex emit so the buffer size
 *  always matches the geometry written — a mismatch corrupts the GPU
 *  draw. */
function polylineSubs(p: Extract<Primitive, { kind: 'polyline' }>): ReadonlyArray<{ x: number; y: number }>[] {
    if (!p.dash) return [p.points as { x: number; y: number }[]];
    return splitPolylineDash(p.points, p.dash[0], p.dash[1]);
}

/* Module-level color cache. resolveColor() calls getComputedStyle which
 * is layout-trigger expensive; many charts share the same CSS var
 * strings (palette tokens, status colors) so a stable cache across
 * tessellate() calls eliminates redundant style reads.
 *
 * Theme invalidation: when the document's root class list changes (dark
 * mode toggle, tenant theme swap), CSS variable values change and the
 * cache must be dropped. A MutationObserver on documentElement
 * watches `class`; any change drops the cache. Cheap (one observer for
 * the page, fires only on actual class mutations). */
const moduleColorCache = new Map<string, [number, number, number]>();
let themeObserverInstalled = false;

function ensureThemeObserver(): void {
    if (themeObserverInstalled || typeof document === 'undefined') return;
    themeObserverInstalled = true;
    const obs = new MutationObserver(() => moduleColorCache.clear());
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
}

export function tessellatePrimitives(
    primitives: ReadonlyArray<Primitive>,
    marginPx = 0,
): { vertices: Float32Array; triCount: number } {
    let triCount = 0;
    for (const p of primitives) triCount += trianglesFor(p);
    if (triCount === 0) return { vertices: new Float32Array(0), triCount: 0 };
    const buf = allocVertexBuffer(triCount);

    ensureThemeObserver();
    const cachedResolve = (s: string): [number, number, number] => {
        const hit = moduleColorCache.get(s);
        if (hit) return hit;
        const rgb = resolveColor(s);
        moduleColorCache.set(s, rgb);
        return rgb;
    };

    let v = 0;
    for (const p of primitives) {
        const rgb = cachedResolve(p.color);
        const fill: RGBA = { r: rgb[0], g: rgb[1], b: rgb[2], a: p.opacity ?? 1 };
        switch (p.kind) {
            case 'rect': {
                /* Per-corner radii: explicit `radiusTL/TR/BL/BR` override
                 *  the legacy `radiusTop/radiusBot`. When all four are
                 *  equal-to-`radiusTop`/equal-to-`radiusBot`, the per-
                 *  corner writer produces identical geometry to the old
                 *  uniform writer. */
                const rT = p.radiusTop ?? 0;
                const rB = p.radiusBot ?? 0;
                const tl = p.radiusTL ?? rT;
                const tr = p.radiusTR ?? rT;
                const bl = p.radiusBL ?? rB;
                const br = p.radiusBR ?? rB;
                const anyRounded = tl > 0 || tr > 0 || bl > 0 || br > 0;
                if (p.gradient) {
                    const baseA = p.opacity ?? 1;
                    const topColor: RGBA = { r: rgb[0], g: rgb[1], b: rgb[2], a: p.gradient.topOpacity * baseA };
                    const botColor: RGBA = { r: rgb[0], g: rgb[1], b: rgb[2], a: p.gradient.bottomOpacity * baseA };
                    v = anyRounded
                        ? writeRoundedRectGradientPerCorner(buf, v, p.x + marginPx, p.y + marginPx, p.w, p.h, { tl, tr, bl, br }, topColor, botColor)
                        : writeRectGradient(buf, v, p.x + marginPx, p.y + marginPx, p.w, p.h, topColor, botColor);
                } else {
                    v = anyRounded
                        ? writeRoundedRectPerCorner(buf, v, p.x + marginPx, p.y + marginPx, p.w, p.h, { tl, tr, bl, br }, fill)
                        : writeRect(buf, v, p.x + marginPx, p.y + marginPx, p.w, p.h, fill);
                }
                break;
            }
            case 'polygon':
                v = writePolygonPrim(buf, v, p, rgb, marginPx);
                break;
            case 'polyline':
                for (const sub of polylineSubs(p)) {
                    v = writePolylineStroke(buf, v, offsetPoints(sub, marginPx), p.strokeWidth, fill);
                }
                break;
            case 'area-band':
                v = writeAreaBandPrim(buf, v, p, rgb, marginPx);
                break;
            case 'circle':
                v = writeCircle(buf, v, p.cx + marginPx, p.cy + marginPx, p.r, p.strokeWidth, fill);
                break;
            case 'arc':
                v = writeArc(buf, v, p.cx + marginPx, p.cy + marginPx, p.innerRadius, p.outerRadius, p.startAngle, p.endAngle, fill);
                break;
        }
    }
    return { vertices: buf, triCount: v / 3 };
}

function writePolygonPrim(
    out: Float32Array,
    vIdx: number,
    p: Extract<Primitive, { kind: 'polygon' }>,
    rgb: [number, number, number],
    marginPx: number,
): number {
    const pts = offsetPoints(p.points, marginPx);
    if (!p.gradient) {
        return writePolygon(out, vIdx, pts, { r: rgb[0], g: rgb[1], b: rgb[2], a: p.opacity ?? 1 });
    }
    /* Screen-Y gradient: the shader computes
     *   `bandY = (worldPos.y - gradTopY) / (gradBotY - gradTopY)`
     *   `alpha = topColor.a * mix(1, bottomMul, bandY)`
     * per pixel from world-space Y. Bounds are the polygon's actual
     * min/max Y in world (post-margin) coordinates — same space the
     * shader sees in `worldPos`. */
    let gradTopY = pts[0].y, gradBotY = pts[0].y;
    for (let k = 1; k < pts.length; k++) {
        if (pts[k].y < gradTopY) gradTopY = pts[k].y;
        if (pts[k].y > gradBotY) gradBotY = pts[k].y;
    }
    const topA = p.gradient.topOpacity;
    const botA = p.gradient.bottomOpacity;
    const baseA = p.opacity ?? 1;
    const topColor: RGBA = { r: rgb[0], g: rgb[1], b: rgb[2], a: topA * baseA };
    const bottomMul = topA > 0 ? botA / topA : 0;
    return writePolygonGradient(out, vIdx, pts, topColor, gradTopY, gradBotY, bottomMul);
}

function writeAreaBandPrim(
    out: Float32Array,
    vIdx: number,
    p: Extract<Primitive, { kind: 'area-band' }>,
    rgb: [number, number, number],
    marginPx: number,
): number {
    const top = offsetPoints(p.top, marginPx);
    const base = typeof p.base === 'number'
        ? p.base + marginPx
        : offsetPoints(p.base, marginPx);
    const baseA = p.opacity ?? 1;
    if (!p.gradient) {
        const fill: RGBA = { r: rgb[0], g: rgb[1], b: rgb[2], a: baseA };
        /* bottomMul=1 + the writer emitting topY==baseY (whenever the
         *  band has zero height at a column) is fine — the shader's
         *  span<=0 branch hands back the unmultiplied color. For a
         *  fully filled band, bottomMul=1 keeps alpha constant. */
        return writeAreaBand(out, vIdx, top, base, fill, 1);
    }
    /* Silhouette-following gradient: writeAreaBand stamps per-column
     *  (topY, baseY) into every vertex so the shader's bandY math
     *  is 0 along the curve and 1 along the base at every X. */
    const topA = p.gradient.topOpacity;
    const botA = p.gradient.bottomOpacity;
    const topColor: RGBA = { r: rgb[0], g: rgb[1], b: rgb[2], a: topA * baseA };
    const bottomMul = topA > 0 ? botA / topA : 0;
    return writeAreaBand(out, vIdx, top, base, topColor, bottomMul);
}

function offsetPoints(points: ReadonlyArray<{ x: number; y: number }>, m: number): { x: number; y: number }[] {
    if (m === 0) return points as { x: number; y: number }[];
    const out: { x: number; y: number }[] = new Array(points.length);
    for (let i = 0; i < points.length; i++) {
        out[i] = { x: points[i].x + m, y: points[i].y + m };
    }
    return out;
}

function trianglesFor(p: Primitive): number {
    switch (p.kind) {
        case 'rect': {
            /* Per-corner radii fall back to top/bot when unset. Budget
             *  is the upper bound: any top corner rounded → budget for
             *  both top corners rounded; same for bottom. */
            const rT = p.radiusTop ?? 0;
            const rB = p.radiusBot ?? 0;
            const tl = p.radiusTL ?? rT;
            const tr = p.radiusTR ?? rT;
            const bl = p.radiusBL ?? rB;
            const br = p.radiusBR ?? rB;
            const topMax = Math.max(tl, tr);
            const botMax = Math.max(bl, br);
            return (topMax > 0 || botMax > 0) ? roundedRectTriangles(topMax, botMax) : 2;
        }
        case 'polygon':   return Math.max(0, p.points.length - 2);
        case 'polyline': {
            let n = 0;
            for (const sub of polylineSubs(p)) n += polylineStrokeTriangles(sub);
            return n;
        }
        case 'area-band': return areaBandTriangles(p.top.length);
        case 'circle':    return p.strokeWidth ? FAN_STEPS * 2 : FAN_STEPS;
        case 'arc': {
            const sweep = Math.abs(p.endAngle - p.startAngle);
            const steps = Math.max(2, Math.ceil(sweep * ARC_STEPS_PER_RADIAN));
            return steps * (p.innerRadius > 0 ? 2 : 1);
        }
    }
}

