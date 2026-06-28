/**
 * HDR gradient fill for the element behind the glass "Thinking…" text. Shares
 * the AI palette, the hue/HDR math, and the WebGPU renderer with the edge ring.
 * The geometry is a horizontal STRIP field: the canvas is tiled into vertical
 * columns so the orange→violet gradient can vary smoothly across the width (two
 * columns can't carry a mid-canvas hump).
 *
 * The whole canvas IS the HDR element — no mask. It fills the text box and the
 * glass text on top lets the above-SDR color read through. Same HDR signal the
 * ring uses, never the SDR sRGB ceiling of `background-clip: text`.
 *
 * Pure geometry/color; the DOM plumbing lives in `use-ai-glow-text.ts`.
 */

import { allocVertexBuffer, writeVertex, FLOATS_PER_VERTEX, type RGBA } from './chart-vertices.js';
import type { GlowColors, GlowProfile } from './ai-glow-ring.js';

/** Number of vertical columns the canvas is tiled into. Enough to carry a
 *  smooth horizontal hump (the traveling band) without faceting. */
const COLUMNS = 48;

const ZERO: RGBA = { r: 0, g: 0, b: 0, a: 0 };

/** Build the strip field: `COLUMNS` full-height quads spanning `w`×`h` (physical
 *  px). Colors are zeroed (paint rewrites them); `cx` carries each vertex's
 *  horizontal param 0..1 for the traveling band. */
export function buildAiGlowText(
    w: number, h: number,
): { vertices: Float32Array; cx: Float32Array; triCount: number } {
    const triCount = COLUMNS * 2;
    const vertices = allocVertexBuffer(triCount);
    const cx = new Float32Array(triCount * 3);
    let v = 0;
    const emit = (x: number, y: number, t: number) => {
        writeVertex(vertices, v, x, y, ZERO);
        cx[v] = t;
        v++;
    };
    for (let i = 0; i < COLUMNS; i++) {
        const x0 = (i / COLUMNS) * w, x1 = ((i + 1) / COLUMNS) * w;
        const t0 = i / COLUMNS, t1 = (i + 1) / COLUMNS;
        emit(x0, 0, t0); emit(x1, 0, t1); emit(x0, h, t0);     // Tri 1
        emit(x1, 0, t1); emit(x1, h, t1); emit(x0, h, t0);     // Tri 2
    }
    return { vertices, cx, triCount };
}

/** Rewrite per-vertex colors for time `t` (seconds): a FULL orange→violet
 *  gradient that fills the whole canvas edge-to-edge (no dim band, no gaps) and
 *  gently DRIFTS over time so the hue flows across while staying full-color end
 *  to end. Every channel is hue-normalized (brightest = 1) then scaled by
 *  intensity × peakGain, so the whole element reads at the same above-SDR
 *  brightness — identical HDR contract to `paintAiGlowRing`. Fully opaque: the
 *  canvas IS the HDR element (the glass text sits on top), so there is no
 *  translucent fringe to invert on the `extended` canvas. */
export function paintAiGlowText(
    vertices: Float32Array, cx: Float32Array, time: number,
    speed: number, intensity: number, colors: GlowColors, profile: GlowProfile,
): void {
    const a = colors.from, b = colors.to;
    /* Gradient phase eases back and forth (cosine, no wrap seam) so the
     * orange↔violet endpoints swap which side they sit on and slide across the
     * word — always a full gradient end-to-end, only the direction drifts. */
    const phase = 0.5 - 0.5 * Math.cos(time * speed * 0.18);   // 0..1 ping-pong
    const gain = intensity * profile.peakGain;                 // uniform above-SDR brightness
    for (let i = 0; i < cx.length; i++) {
        const off = i * FLOATS_PER_VERTEX;
        /* Hue position reflects between cx and (1−cx) by `phase` — a continuous
         * lerp, so the gradient never wraps/jumps: at phase 0 it's orange→violet
         * L→R, at phase 1 it's violet→orange, easing smoothly between. */
        const t = cx[i] * (1 - phase) + (1 - cx[i]) * phase;
        const baseR = a.r + (b.r - a.r) * t;
        const baseG = a.g + (b.g - a.g) * t;
        const baseB = a.b + (b.b - a.b) * t;
        const maxC = Math.max(baseR, baseG, baseB, 0.001);
        vertices[off + 2] = (baseR / maxC) * gain;
        vertices[off + 3] = (baseG / maxC) * gain;
        vertices[off + 4] = (baseB / maxC) * gain;
        vertices[off + 5] = 1;                                 // fully opaque HDR element
    }
}
