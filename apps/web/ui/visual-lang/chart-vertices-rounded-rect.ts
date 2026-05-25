/**
 * Tessellate an axis-aligned rect with per-corner radii.
 *
 * Each of the 4 corners has its own radius (TL, TR, BL, BR). 0 = sharp
 * corner; > 0 = rounded with that pixel radius. Used by atomic-bar
 * clusters where outer corners of the cluster are rounded but inner
 * edges between adjacent atoms stay flat — the leftmost atom rounds
 * its TL only, the rightmost rounds its TR only, the rest are flat.
 *
 * Decomposition: the rect is divided into a top band (height =
 * max(TL, TR)), a middle slab, and a bottom band (height =
 * max(BL, BR)). Each band has corner fans where its corners are
 * rounded and rect fills where they're sharp.
 *
 * Triangle count: 16 max (2 fans per side * up to 8 steps each, plus
 * a few rect fills). The pre-count function returns a generous upper
 * bound so geometry sections never overflow.
 */

import { writeRect, writeRectGradient, writeVertex, type RGBA } from './chart-vertices.js';

const CORNER_STEPS = 8;

/** Triangle budget for a rounded-rect with the given per-corner radii.
 *  Upper bound — actual emission may be less when corners are sharp
 *  or symmetric.
 *
 *  Per-band budget (top, bottom):
 *    - 2 tri inner strip (always emitted when band has height).
 *    - Per rounded corner: CORNER_STEPS tri fan + UP TO 2 tri filler
 *      (filler emits when this corner's radius < band's height, i.e.
 *      the other corner is taller — asymmetric radii case).
 *  Maximum per band: 2 (inner) + 2 * (CORNER_STEPS + 2) = 2 + 20 = 22 tri.
 *
 *  Middle slab is always 2 tri. */
export function roundedRectTriangles(rTopReq: number, rBotReq: number): number {
    /* Legacy signature: rTopReq applies to BOTH top corners, rBotReq
     *  to both bottom corners. With symmetric radii no fillers are
     *  needed, but we budget for the worst case (asymmetric per-corner)
     *  since the same budget covers both writer entry points. */
    const hasTop = rTopReq > 0 ? 1 : 0;
    const hasBot = rBotReq > 0 ? 1 : 0;
    const PER_BAND_MAX = 2 + 2 * (CORNER_STEPS + 2);
    return hasTop * PER_BAND_MAX + hasBot * PER_BAND_MAX + 2;
}

export interface CornerRadii {
    tl: number; tr: number; bl: number; br: number;
}

export function writeRoundedRect(
    out: Float32Array,
    vIdx: number,
    x: number, y: number, w: number, h: number,
    rTopReq: number, rBotReq: number,
    color: RGBA,
): number {
    /* Legacy uniform-top/bottom entry point. Routes to the per-corner
     *  writer with `tl=tr=rTopReq` and `bl=br=rBotReq` so the geometry
     *  budget in `roundedRectTriangles` stays accurate. */
    return writeRoundedRectPerCorner(out, vIdx, x, y, w, h, {
        tl: rTopReq, tr: rTopReq, bl: rBotReq, br: rBotReq,
    }, color);
}

export function writeRoundedRectPerCorner(
    out: Float32Array,
    vIdx: number,
    x: number, y: number, w: number, h: number,
    rReq: CornerRadii,
    color: RGBA,
): number {
    const clamp = clampRadii(w, h, rReq);
    const { tl, tr, bl, br } = clamp;
    const topH = Math.max(tl, tr);
    const botH = Math.max(bl, br);
    let v = vIdx;
    /* Top band — height = max(tl, tr). The "inner strip" between the
     *  TL and TR corners covers everything that's not part of a
     *  rounded fan. When a corner is sharp (radius 0), the inner strip
     *  already extends all the way to that edge — no filler needed.
     *  When a corner is rounded, a quarter-circle fan covers the
     *  corner; if the band's height exceeds the corner radius (only
     *  possible when the OTHER corner is taller), a filler fills the
     *  rectangular area below the fan. */
    if (topH > 0) {
        const innerLeft = x + tl;
        const innerRight = x + w - tr;
        const innerW = Math.max(0, innerRight - innerLeft);
        v = writeRect(out, v, innerLeft, y, innerW, topH, color);
        if (tl > 0) {
            v = writeCornerFan(out, v, x + tl, y + tl, tl, Math.PI, 1.5 * Math.PI, color);
            if (tl < topH) v = writeRect(out, v, x, y + tl, tl, topH - tl, color);
        }
        if (tr > 0) {
            v = writeCornerFan(out, v, x + w - tr, y + tr, tr, 1.5 * Math.PI, 2 * Math.PI, color);
            if (tr < topH) v = writeRect(out, v, x + w - tr, y + tr, tr, topH - tr, color);
        }
    }
    /* Middle slab: full-width between the top and bottom bands. */
    v = writeRect(out, v, x, y + topH, w, Math.max(0, h - topH - botH), color);
    /* Bottom band — mirror of top. */
    if (botH > 0) {
        const innerLeft = x + bl;
        const innerRight = x + w - br;
        const innerW = Math.max(0, innerRight - innerLeft);
        v = writeRect(out, v, innerLeft, y + h - botH, innerW, botH, color);
        if (bl > 0) {
            v = writeCornerFan(out, v, x + bl, y + h - bl, bl, 0.5 * Math.PI, Math.PI, color);
            if (bl < botH) v = writeRect(out, v, x, y + h - botH, bl, botH - bl, color);
        }
        if (br > 0) {
            v = writeCornerFan(out, v, x + w - br, y + h - br, br, 0, 0.5 * Math.PI, color);
            if (br < botH) v = writeRect(out, v, x + w - br, y + h - botH, br, botH - br, color);
        }
    }
    return v;
}

function clampRadii(w: number, h: number, r: CornerRadii): CornerRadii {
    const maxR = Math.max(0, Math.min(w * 0.5, h * 0.5));
    let tl = Math.max(0, Math.min(r.tl, maxR));
    let tr = Math.max(0, Math.min(r.tr, maxR));
    let bl = Math.max(0, Math.min(r.bl, maxR));
    let br = Math.max(0, Math.min(r.br, maxR));
    /* If top+bot radii on either side exceed h, scale them down. */
    const leftSum = tl + bl;
    if (leftSum > h && leftSum > 0) { const k = h / leftSum; tl *= k; bl *= k; }
    const rightSum = tr + br;
    if (rightSum > h && rightSum > 0) { const k = h / rightSum; tr *= k; br *= k; }
    return { tl, tr, bl, br };
}

function writeCornerFan(
    out: Float32Array,
    vIdx: number,
    cx: number, cy: number, r: number,
    startAngle: number, endAngle: number,
    color: RGBA,
): number {
    let i = vIdx;
    const sweep = endAngle - startAngle;
    for (let k = 0; k < CORNER_STEPS; k++) {
        const t0 = startAngle + (k / CORNER_STEPS) * sweep;
        const t1 = startAngle + ((k + 1) / CORNER_STEPS) * sweep;
        writeVertex(out, i + 0, cx, cy, color);
        writeVertex(out, i + 1, cx + Math.cos(t0) * r, cy + Math.sin(t0) * r, color);
        writeVertex(out, i + 2, cx + Math.cos(t1) * r, cy + Math.sin(t1) * r, color);
        i += 3;
    }
    return i;
}

/** Rounded-rect with vertical alpha gradient — top corners and edges
 *  use the top color, bottom corners and edges use the bottom color,
 *  and the middle slab interpolates. Section structure mirrors the
 *  flat `writeRoundedRect` exactly so the triangle-count pre-budget
 *  in `roundedRectTriangles` stays valid. */
export function writeRoundedRectGradient(
    out: Float32Array,
    vIdx: number,
    x: number, y: number, w: number, h: number,
    rTopReq: number, rBotReq: number,
    topColor: RGBA, bottomColor: RGBA,
): number {
    /* Legacy entry point — uniform top/bottom radii. Routes to the
     *  per-corner gradient writer. */
    return writeRoundedRectGradientPerCorner(out, vIdx, x, y, w, h, {
        tl: rTopReq, tr: rTopReq, bl: rBotReq, br: rBotReq,
    }, topColor, bottomColor);
}

export function writeRoundedRectGradientPerCorner(
    out: Float32Array,
    vIdx: number,
    x: number, y: number, w: number, h: number,
    rReq: CornerRadii,
    topColor: RGBA, bottomColor: RGBA,
): number {
    const { tl, tr, bl, br } = clampRadii(w, h, rReq);
    const topH = Math.max(tl, tr);
    const botH = Math.max(bl, br);
    /* Per-y color sampler — linear interpolation between `topColor`
     *  (at y) and `bottomColor` (at y + h). */
    const colorAt = (yVal: number): RGBA => {
        const span = Math.max(1e-6, h);
        const t = Math.max(0, Math.min(1, (yVal - y) / span));
        return {
            r: topColor.r + (bottomColor.r - topColor.r) * t,
            g: topColor.g + (bottomColor.g - topColor.g) * t,
            b: topColor.b + (bottomColor.b - topColor.b) * t,
            a: topColor.a + (bottomColor.a - topColor.a) * t,
        };
    };
    let v = vIdx;
    if (topH > 0) {
        const innerLeft = x + tl;
        const innerRight = x + w - tr;
        const innerW = Math.max(0, innerRight - innerLeft);
        v = writeRectGradient(out, v, innerLeft, y, innerW, topH, colorAt(y), colorAt(y + topH));
        if (tl > 0) {
            const topCornerColor = colorAt(y + tl * 0.5);
            v = writeCornerFan(out, v, x + tl, y + tl, tl, Math.PI, 1.5 * Math.PI, topCornerColor);
            if (tl < topH) v = writeRectGradient(out, v, x, y + tl, tl, topH - tl, colorAt(y + tl), colorAt(y + topH));
        }
        if (tr > 0) {
            const topCornerColor = colorAt(y + tr * 0.5);
            v = writeCornerFan(out, v, x + w - tr, y + tr, tr, 1.5 * Math.PI, 2 * Math.PI, topCornerColor);
            if (tr < topH) v = writeRectGradient(out, v, x + w - tr, y + tr, tr, topH - tr, colorAt(y + tr), colorAt(y + topH));
        }
    }
    v = writeRectGradient(out, v, x, y + topH, w, Math.max(0, h - topH - botH), colorAt(y + topH), colorAt(y + h - botH));
    if (botH > 0) {
        const innerLeft = x + bl;
        const innerRight = x + w - br;
        const innerW = Math.max(0, innerRight - innerLeft);
        v = writeRectGradient(out, v, innerLeft, y + h - botH, innerW, botH, colorAt(y + h - botH), colorAt(y + h));
        if (bl > 0) {
            const botCornerColor = colorAt(y + h - bl * 0.5);
            v = writeCornerFan(out, v, x + bl, y + h - bl, bl, 0.5 * Math.PI, Math.PI, botCornerColor);
            if (bl < botH) v = writeRectGradient(out, v, x, y + h - botH, bl, botH - bl, colorAt(y + h - botH), colorAt(y + h - bl));
        }
        if (br > 0) {
            const botCornerColor = colorAt(y + h - br * 0.5);
            v = writeCornerFan(out, v, x + w - br, y + h - br, br, 0, 0.5 * Math.PI, botCornerColor);
            if (br < botH) v = writeRectGradient(out, v, x + w - br, y + h - botH, br, botH - br, colorAt(y + h - botH), colorAt(y + h - br));
        }
    }
    return v;
}
