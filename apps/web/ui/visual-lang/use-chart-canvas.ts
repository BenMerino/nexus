/**
 * React hook that drives a chart canvas through the shared renderer's
 * triangle-geometry pipeline. Mirror of `useMoleculeCanvas` for charts:
 *
 *   - Mount acquires the visible canvas's `bitmaprenderer` context once.
 *   - Render effect awaits the shared renderer, packs vertices, calls
 *     `renderChart` on every rAF tick while iridescence is animating.
 *
 * Consumers tessellate their geometry into a Float32Array of vertices
 * (9 floats per vertex: pos.xy, color.rgba, gradRange.xy, bottomMul)
 * and pass it in via the `vertices` opt. `triCount` is the number of
 * triangles to draw.
 *
 * The hook owns the rAF loop. When `iridescence` is 0, it draws once and
 * idles — there's nothing animating. When iridescence is non-zero, it
 * draws continuously so the shimmer phase advances per frame.
 */

import { useEffect, useRef, type RefObject } from 'react';
import {
    acquireSharedRenderer,
    type SharedRenderer,
    type ChartDrawParams,
} from './shared-renderer.js';

export interface UseChartCanvasOpts {
    cssWidth: number;
    cssHeight: number;
    /** Packed vertex buffer (9 floats per vertex × 3 verts per triangle). */
    vertices: Float32Array;
    /** Number of triangles to draw. */
    triCount: number;
    glow?: number;
    iridescence?: number;
    edgeSoftness?: number;
    saturation?: number;
}

interface LocalState {
    canvas: HTMLCanvasElement;
    raf: number | null;
    startMs: number;
    /** Cached DPR-scaled vertex buffer. Reused across frames within a
     *  single rAF loop so we don't allocate a fresh Float32Array on
     *  every iridescence tick. Invalidated when src vertices ref or DPR
     *  changes. */
    scaledVerts: Float32Array | null;
    scaledFromSrc: Float32Array | null;
    scaledFromDpr: number;
}

export function useChartCanvas(
    canvasRef: RefObject<HTMLCanvasElement | null>,
    opts: UseChartCanvasOpts,
): void {
    const optsRef = useRef(opts);
    optsRef.current = opts;
    const stateRef = useRef<LocalState | null>(null);

    /* Mount: capture the visible canvas. The shared renderer owns its
     * presentation context (webgpu for HDR, or bitmaprenderer on the
     * WebGL2 fallback) — we just hand over the element. */
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        stateRef.current = {
            canvas,
            raf: null,
            startMs: performance.now(),
            scaledVerts: null,
            scaledFromSrc: null,
            scaledFromDpr: 0,
        };
        return () => {
            const s = stateRef.current;
            if (s?.raf != null) cancelAnimationFrame(s.raf);
            stateRef.current = null;
        };
    }, [canvasRef]);

    useEffect(() => {
        const state = stateRef.current;
        if (!state) return;
        let cancelled = false;
        let renderer: SharedRenderer | null = null;

        const renderFrame = () => {
            const s = stateRef.current;
            const cur = optsRef.current;
            if (!s || !renderer || cancelled) return;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const wPx = Math.max(1, Math.round(cur.cssWidth * dpr));
            const hPx = Math.max(1, Math.round(cur.cssHeight * dpr));
            /* Vertex positions are authored in CSS px (chart viewBox);
             * scale up to physical px for NDC mapping. Cache the scaled
             * buffer so the iridescence rAF loop doesn't allocate a
             * fresh Float32Array every frame. Rebuild only when the src
             * ref or DPR changes. */
            let verts = s.scaledVerts;
            if (verts === null
                || s.scaledFromSrc !== cur.vertices
                || s.scaledFromDpr !== dpr
                || verts.length !== cur.vertices.length) {
                verts = scaleVerticesToDpr(cur.vertices, dpr);
                s.scaledVerts = verts;
                s.scaledFromSrc = cur.vertices;
                s.scaledFromDpr = dpr;
            }

            const params: ChartDrawParams = {
                time: (performance.now() - s.startMs) / 1000,
                glow: cur.glow ?? 0.6,
                iridescence: cur.iridescence ?? 0,
                edgeSoftness: cur.edgeSoftness ?? 1,
                saturation: cur.saturation ?? 1,
            };
            renderer.renderChart(s.canvas, wPx, hPx, verts, cur.triCount, params);

            /* Animate continuously when iridescence is on (shimmer phase
             * needs `time` to advance). Otherwise draw once per opts
             * change and idle. */
            if ((cur.iridescence ?? 0) > 0.001) {
                s.raf = requestAnimationFrame(renderFrame);
            } else {
                s.raf = null;
            }
        };

        acquireSharedRenderer().then(r => {
            if (cancelled || !r) return;
            renderer = r;
            const s = stateRef.current;
            if (!s) return;
            if (s.raf == null) s.raf = requestAnimationFrame(renderFrame);
        });

        return () => {
            cancelled = true;
            const s = stateRef.current;
            if (s?.raf != null) {
                cancelAnimationFrame(s.raf);
                s.raf = null;
            }
        };
    }, [canvasRef, opts.cssWidth, opts.cssHeight, opts.vertices, opts.triCount,
        opts.glow, opts.iridescence, opts.edgeSoftness, opts.saturation]);
}

/* Vertex layout (9 floats):
 *   0..1 = pos.xy             (scale by DPR — physical px)
 *   2..5 = color.rgba         (copy verbatim)
 *   6..7 = gradRange.xy       (gradTopY, gradBotY in world-Y; scale by
 *                              DPR so they match scaled pos.y in shader)
 *   8    = bottomMul          (copy verbatim)
 * The fragment shader's worldPos uses the scaled position, so the
 * gradient range must scale too or the bandY math compares mismatched
 * coordinate spaces. */
function scaleVerticesToDpr(src: Float32Array, dpr: number): Float32Array {
    if (dpr === 1) return src;
    const out = new Float32Array(src.length);
    for (let i = 0; i < src.length; i += 9) {
        out[i]     = src[i]     * dpr;
        out[i + 1] = src[i + 1] * dpr;
        out[i + 2] = src[i + 2];
        out[i + 3] = src[i + 3];
        out[i + 4] = src[i + 4];
        out[i + 5] = src[i + 5];
        out[i + 6] = src[i + 6] * dpr;
        out[i + 7] = src[i + 7] * dpr;
        out[i + 8] = src[i + 8];
    }
    return out;
}
