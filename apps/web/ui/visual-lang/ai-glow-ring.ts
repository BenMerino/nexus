/**
 * "Edge glow" ring tessellation for the AI-enabled affordance.
 *
 * Strokes a CLOSED perimeter (supplied as ordered points — sampled from the
 * platform's canonical `roundedRectPath`, so the curve is the SAME math the
 * rest of the app uses, not a hand-rolled approximation) as a thin triangle
 * band, and paints a purple↔pink lobe that travels around the loop over time
 * (the "rotating glow"). Colors are emitted ABOVE SDR white (channels >1.0)
 * so that on the WebGPU HDR canvas (rgba16float + extended tone mapping) the
 * glow reads as genuinely brighter-than-white; the chart bloom pass turns the
 * bright lobe into a soft HDR halo. On the WebGL2 fallback it clamps to SDR.
 *
 * This module is pure geometry/color — the DOM-bound path sampling lives in
 * the hook. Positions are static for a given perimeter; only the per-vertex
 * color changes each frame, so the hot path is a cheap color rewrite.
 */

import { allocVertexBuffer, writeVertex, FLOATS_PER_VERTEX, type RGBA } from './chart-vertices.js';

const TAU = Math.PI * 2;

/** The two endpoints of the lobe sweep, normalized 0..1 RGB (the paint step
 *  scales them past 1.0 for HDR). */
export interface GlowColors { from: RGBA; to: RGBA }

/** Default purple→pink: violet at one end, hot magenta-pink at the other. */
export const DEFAULT_GLOW_COLORS: GlowColors = {
    from: { r: 0.58, g: 0.16, b: 1.0, a: 1 },
    to: { r: 1.0, g: 0.22, b: 0.74, a: 1 },
};

/** The Zincro-AI palette — orange→violet. One source of truth shared by the
 *  Fusion-search edge ring and the "Thinking…" HDR text, so the two read as the
 *  same accent. Violet is blue-leaning (low red) to stay off pink/magenta. */
export const AI_GLOW_COLORS: GlowColors = {
    from: { r: 1.0, g: 0.45, b: 0.0, a: 1 },    // orange
    to: { r: 0.42, g: 0.12, b: 1.0, a: 1 },     // violet (blue-leaning, less pink)
};

/** The band's brightness shape ACROSS its width (radial 0 = inner edge on the
 *  border, 1 = outer edge). Every value is a NAMED, tunable parameter — no
 *  magic constants buried in the paint loop. `radialProfile()` builds the
 *  curve from these; the workbench drives them live. */
export interface GlowProfile {
    /** Brightness at the inner edge, 0..1 (the recess off the border). */
    innerFloor: number;
    /** Where the brightest point sits across the band, 0 (inner) .. 1 (outer). */
    peakAt: number;
    /** Brightness at the outer edge, 0..1 (the falloff into the halo). */
    outerFloor: number;
    /** HDR peak magnitude the profile's peak maps to (×intensity). >1 = HDR. */
    peakGain: number;
}

export const DEFAULT_GLOW_PROFILE: GlowProfile = {
    innerFloor: 0.08, peakAt: 0.5, outerFloor: 0.2, peakGain: 1.0,
};

/** Brightness multiplier across the band at radial position `r∈[0,1]`, built
 *  from the profile: two smooth cosine ramps meeting at `peakAt` — inner edge
 *  at `innerFloor`, peak at 1.0, outer edge at `outerFloor`. Pure function of
 *  named params, so behavior is predictable and tunable, never guessed. */
export function radialProfile(r: number, p: GlowProfile): number {
    const at = Math.min(0.999, Math.max(0.001, p.peakAt));
    if (r <= at) {
        const t = r / at;                              // inner ramp 0→1
        return p.innerFloor + (1 - p.innerFloor) * (0.5 - 0.5 * Math.cos(Math.PI * t));
    }
    const t = (r - at) / (1 - at);                     // outer ramp 0→1
    return 1 + (p.outerFloor - 1) * (0.5 - 0.5 * Math.cos(Math.PI * t));
}

const ZERO: RGBA = { r: 0, g: 0, b: 0, a: 0 };

/** One perimeter point with its outward unit normal (physical px), in order
 *  around a closed loop. Produced by `sampleRoundedRect`. */
export interface PerimeterPoint { x: number; y: number; nx: number; ny: number }

/** Stroke a closed perimeter into a triangle band. `points` are ordered
 *  around the loop (last connects back to first), each carrying its outward
 *  unit normal; all in PHYSICAL px. The band is biased OUTWARD — its inner
 *  edge lands on the supplied path and it grows outward by `thickness` — so
 *  the glow hugs the OUTSIDE of the real border curve. Returns the packed
 *  buffer (colors zeroed for `paintAiGlowRing`), the per-vertex perimeter
 *  param `vt`, and the triangle count. */
export function buildAiGlowRing(
    points: ReadonlyArray<PerimeterPoint>, thickness: number,
): { vertices: Float32Array; vt: Float32Array; radial: Float32Array; triCount: number } {
    const n = points.length;
    if (n < 3) return { vertices: new Float32Array(0), vt: new Float32Array(0), radial: new Float32Array(0), triCount: 0 };

    // Cumulative arc-length → perimeter param t∈[0,1) per point, for the lobe phase.
    const tt = new Float32Array(n);
    let total = 0;
    for (let i = 0; i < n; i++) {
        const a = points[i], b = points[(i + 1) % n];
        total += Math.hypot(b.x - a.x, b.y - a.y);
    }
    let acc = 0;
    for (let i = 0; i < n; i++) {
        tt[i] = total > 0 ? acc / total : 0;
        const b = points[(i + 1) % n];
        acc += Math.hypot(b.x - points[i].x, b.y - points[i].y);
    }

    /* THREE rows across the band (inner r=0, mid r=0.5, outer r=1) so the GPU
     * can interpolate a HUMP across the width — with only 2 rows a mid-band
     * brightness peak collapses to a straight line. Each segment = 2 quads = 4
     * triangles. */
    const triCount = n * 4;
    const vertices = allocVertexBuffer(triCount);
    const vt = new Float32Array(triCount * 3);
    /* radial[v]: 0 at the border edge → 1 deepest INSIDE. The band is biased
     * INWARD (−normal) so the glow lives inside the element behind the glass;
     * the element's border clips it (no outward halo). Paint shapes brightness
     * across this depth — peaking at the edge gives the bright filament on the
     * border, recessing it gives a soft inner glow. */
    const radial = new Float32Array(triCount * 3);
    let v = 0;
    const emit = (i: number, r: number) => {            // r = depth 0 (edge) .. 1 (inside)
        const off = r * thickness;
        const p = points[i];
        writeVertex(vertices, v, p.x - p.nx * off, p.y - p.ny * off, ZERO);
        vt[v] = tt[i];
        radial[v] = r;
        v++;
    };
    const quad = (i: number, j: number, r0: number, r1: number) => {
        emit(i, r0); emit(i, r1); emit(j, r0);          // Tri 1
        emit(i, r1); emit(j, r1); emit(j, r0);          // Tri 2
    };
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        quad(i, j, 0, 0.5);     // inner half
        quad(i, j, 0.5, 1);     // outer half
    }
    return { vertices, vt, radial, triCount };
}

/** Rewrite per-vertex colors for time `t` (seconds). Brightness is the product
 *  of three independent, NAMED factors — no buried constants:
 *    intensity × lobe(along-loop sweep) × radialProfile(across-band shape)
 *  The hue is normalized (brightest channel = 1) so any magnitude stays
 *  saturated into HDR — never clips to white. The `profile` controls the
 *  across-band shape; the workbench drives it live. */
/** Fully-saturated hue → RGB (0..1), h in turns (0..1 = full wheel). Used by
 *  the rainbow glow so the lobe sweeps the whole spectrum. Returns a max-1
 *  channel so the caller can scale into HDR without clipping the hue. */
function hueToRgb(h: number): { r: number; g: number; b: number } {
    const x = ((h % 1) + 1) % 1 * 6;
    const c = 1 - Math.abs((x % 2) - 1);
    if (x < 1) return { r: 1, g: c, b: 0 };
    if (x < 2) return { r: c, g: 1, b: 0 };
    if (x < 3) return { r: 0, g: 1, b: c };
    if (x < 4) return { r: 0, g: c, b: 1 };
    if (x < 5) return { r: c, g: 0, b: 1 };
    return { r: 1, g: 0, b: c };
}

export function paintAiGlowRing(
    vertices: Float32Array, vt: Float32Array, radial: Float32Array, time: number,
    speed: number, intensity: number,
    colors: GlowColors = DEFAULT_GLOW_COLORS, profile: GlowProfile = DEFAULT_GLOW_PROFILE,
    rainbow = false,
): void {
    const a = colors.from, b = colors.to;
    for (let i = 0; i < vt.length; i++) {
        const phase = vt[i] * TAU - time * speed;
        const lobe = 0.5 + 0.5 * Math.cos(phase);       // 0..1 traveling peak along the loop
        const off = i * FLOATS_PER_VERTEX;
        let baseR: number, baseG: number, baseB: number;
        if (rainbow) {
            /* Hue = position around the loop (full wheel once around) + time, so
             * the rainbow both wraps the ring AND rotates. Same lobe/profile/HDR
             * math below — only the hue source changes. */
            const c = hueToRgb(vt[i] + time * speed * 0.16);
            baseR = c.r; baseG = c.g; baseB = c.b;
        } else {
            // Hue-preserving: lerp the two endpoints by the lobe.
            baseR = a.r + (b.r - a.r) * lobe;
            baseG = a.g + (b.g - a.g) * lobe;
            baseB = a.b + (b.b - a.b) * lobe;
        }
        const maxC = Math.max(baseR, baseG, baseB, 0.001);
        // Brightness = intensity × lobe-presence × peakGain × across-band shape.
        const across = radialProfile(radial[i], profile);
        const presence = (0.25 + lobe * 0.75) * across;     // 0..1 brightness shape (no intensity/HDR)
        const gain = intensity * presence * profile.peakGain;
        vertices[off + 2] = (baseR / maxC) * gain;
        vertices[off + 3] = (baseG / maxC) * gain;
        vertices[off + 4] = (baseB / maxC) * gain;
        /* Alpha tracks the SAME brightness shape (lobe × across), not lobe
         * alone — so a bright pixel is also opaque and a dim one fades out.
         * Coupling them is what lets the canvas present in `extended` HDR
         * without the light-bg inversion: there is no bright-but-translucent
         * fringe (premultiplied rgb≫1, a<1) for the extended path to flip
         * darker than white. The 0.12 floor keeps the trailing edge feathered. */
        vertices[off + 5] = Math.min(1, 0.12 + presence);
    }
}
