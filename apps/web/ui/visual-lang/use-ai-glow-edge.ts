/**
 * Drives the AI-enabled "rotating edge glow" through the shared renderer's
 * HDR chart+bloom pipeline. Mirrors `useChartCanvas`, but the geometry is a
 * rounded-rect ring (built once per size) and the rAF loop runs continuously
 * — the lobe is always orbiting — repainting per-vertex colors each frame and
 * asking the renderer to draw straight into the visible canvas.
 *
 * On WebGPU the canvas is rgba16float + extended tone mapping, so the >1.0
 * lobe colors composite as real HDR brightness; on the WebGL2 fallback the
 * same draw clamps to SDR.
 */

import { useEffect, useRef, type RefObject } from 'react';
import {
    acquireSharedRenderer,
    type SharedRenderer,
    type ChartDrawParams,
} from './shared-renderer.js';
import { buildAiGlowRing, paintAiGlowRing, type GlowColors, type GlowProfile } from './ai-glow-ring.js';
import { sampleRoundedRect } from './sample-rounded-rect.js';

export interface UseAiGlowEdgeOpts {
    /** Canvas CSS box (already includes the outward bleed margin). */
    cssWidth: number;
    cssHeight: number;
    /** Host size (CSS px) the ring traces — the canvas box minus 2×inset. */
    hostWidth: number;
    hostHeight: number;
    /** Uniform top / bottom radii (CSS px) from the host's computed
     *  border-radius. */
    topR: number;
    botR: number;
    /** Live `--corner-smooth` superellipse exponent (1 = circular arc). */
    smooth: number;
    /** Inset of the ring from the canvas edge, in CSS px — the bleed margin
     *  so the bloom halo has room to fall off outside the host element. */
    inset: number;
    /** Glow band width in CSS px. */
    thickness: number;
    /** Lobe angular speed (rad/s). */
    speed: number;
    /** HDR gain — peak channel magnitude ≈ intensity × 1.65. */
    intensity: number;
    /** Lobe color endpoints (from→to). Defaults to purple→pink. */
    colors?: GlowColors;
    /** Halo reach (blur iterations). Lower = shorter glow. */
    spread?: number;
    /** Across-band brightness shape (inner recess / peak position / falloff). */
    profile?: GlowProfile;
    /** Bloom intensity multiplier (× intensity). Controls halo brightness. */
    bloomGain?: number;
}

export function useAiGlowEdge(
    canvasRef: RefObject<HTMLCanvasElement | null>,
    opts: UseAiGlowEdgeOpts,
): void {
    const optsRef = useRef(opts);
    optsRef.current = opts;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || opts.cssWidth <= 0 || opts.cssHeight <= 0) return;

        let cancelled = false;
        let raf = 0;
        let renderer: SharedRenderer | null = null;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const wPx = Math.max(1, Math.round(opts.cssWidth * dpr));
        const hPx = Math.max(1, Math.round(opts.cssHeight * dpr));

        /* Static geometry — sample the canonical rounded-rect path at the
         * host's real size, offset into the bleed margin, in physical px.
         * Rebuilt only when this effect re-runs (size/radii/thickness/dpr). */
        const inset = opts.inset * dpr;
        const pts = sampleRoundedRect(
            opts.hostWidth * dpr, opts.hostHeight * dpr, opts.topR * dpr, opts.botR * dpr, opts.smooth,
        ).map(p => ({ x: p.x + inset, y: p.y + inset, nx: p.nx, ny: p.ny }));
        const { vertices, vt, radial, triCount } = buildAiGlowRing(pts, opts.thickness * dpr);

        const startMs = performance.now();
        const tick = () => {
            if (cancelled || !renderer) return;
            const cur = optsRef.current;
            const time = (performance.now() - startMs) / 1000;
            paintAiGlowRing(vertices, vt, radial, time, cur.speed, cur.intensity, cur.colors, cur.profile);
            const params: ChartDrawParams = {
                time, glow: cur.intensity, iridescence: 0, edgeSoftness: 1, saturation: 1,
                bloomOnly: true, bloomSpread: cur.spread, bloomGain: cur.bloomGain ?? 2,
            };
            renderer.renderChart(canvas, wPx, hPx, vertices, triCount, params);
            raf = requestAnimationFrame(tick);
        };

        acquireSharedRenderer().then(r => {
            if (cancelled || !r) return;
            renderer = r;
            raf = requestAnimationFrame(tick);
        });

        return () => {
            cancelled = true;
            if (raf) cancelAnimationFrame(raf);
        };
    }, [canvasRef, opts.cssWidth, opts.cssHeight, opts.hostWidth, opts.hostHeight,
        opts.inset, opts.thickness, opts.topR, opts.botR, opts.smooth]);
}
