/**
 * In-host variant of the AI edge glow. The glow canvas is a CHILD of the
 * surface it rings (trigger / panel), absolutely positioned to fill it and
 * sitting behind the host's content. It measures its OWN host (the canvas's
 * positioned parent) — its size in the host's local box, not viewport coords —
 * so "behind content" and "follow the morph" fall out of normal DOM stacking
 * with no portal, no fixed positioning, and no global z-index. As the host
 * resizes (the panel expanding), the parent's content box changes and this
 * loop re-tessellates to match.
 */

import { useEffect, useRef, type RefObject } from 'react';
import { acquireSharedRenderer, type SharedRenderer } from './shared-renderer.js';
import { buildAiGlowRing, paintAiGlowRing, type GlowColors, type GlowProfile } from './ai-glow-ring.js';
import { sampleRoundedRect } from './sample-rounded-rect.js';

export interface UseAiGlowHostOpts {
    /** Glow band width in CSS px. */
    thickness: number;
    /** Outward bleed margin in CSS px (canvas is inset by −bleed to give the
     *  halo room beyond the host edge). */
    bleed: number;
    /** Lobe angular speed (rad/s). */
    speed: number;
    /** HDR gain. */
    intensity: number;
    /** Lobe color endpoints (from→to). Defaults to purple→pink. */
    colors?: GlowColors;
    /** Halo reach (blur iterations). Lower = shorter glow. */
    spread?: number;
    /** Across-band brightness shape (inner recess / peak position / falloff). */
    profile?: GlowProfile;
    /** Bloom intensity multiplier (× intensity). Controls halo brightness. */
    bloomGain?: number;
    /** Cycle the lobe through a full rainbow (hue wraps the ring + rotates)
     *  instead of the two-color from→to lerp. */
    rainbow?: boolean;
}

export function useAiGlowHost(
    canvasRef: RefObject<HTMLCanvasElement | null>,
    opts: UseAiGlowHostOpts,
): void {
    const optsRef = useRef(opts);
    optsRef.current = opts;

    useEffect(() => {
        const canvas = canvasRef.current;
        const wrap = canvas?.parentElement;           // .ai-glow-layer — sized + radiused to the VISIBLE box it rings
        if (!canvas || !wrap) return;
        /* Trace the wrapper's OWN box + radius, not the parent's. The wrapper is
         * CSS-aligned to the visible surface it rings (e.g. inset to the glass
         * footprint with the glass radius), so the ring hugs the real border
         * uniformly on every edge at any height — instead of tracing a larger
         * parent box and drifting under the visible edge on long straight runs. */
        const host = wrap;
        let cancelled = false;
        let raf = 0;
        let renderer: SharedRenderer | null = null;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const startMs = performance.now();

        let key = '';
        let geom: { vertices: Float32Array; vt: Float32Array; radial: Float32Array; triCount: number } | null = null;
        let wPx = 0, hPx = 0;
        const px = (v: string) => parseFloat(v) || 0;

        const tick = () => {
            if (cancelled || !renderer) return;
            const cur = optsRef.current;
            /* The canvas IS the host box: read its own client box, sample the
             * ring on the edge, and the band grows INWARD — nothing extends past
             * the border, so nothing is clipped. The filament (bright outer ring
             * ON the border) comes from the paint profile peaking at the edge,
             * not from growing the canvas outward. */
            const cw = canvas.clientWidth, ch = canvas.clientHeight;
            if (cw <= 0 || ch <= 0) { raf = requestAnimationFrame(tick); return; }
            const cs = getComputedStyle(host);
            const topR = (px(cs.borderTopLeftRadius) + px(cs.borderTopRightRadius)) / 2;
            const botR = (px(cs.borderBottomLeftRadius) + px(cs.borderBottomRightRadius)) / 2;
            const smooth = parseFloat(cs.getPropertyValue('--corner-smooth')) || 1;

            const k = `${cw}x${ch}:${topR},${botR}:${smooth}:${cur.thickness}`;
            if (k !== key) {
                key = k;
                wPx = Math.max(1, Math.round(cw * dpr));
                hPx = Math.max(1, Math.round(ch * dpr));
                const pts = sampleRoundedRect(cw * dpr, ch * dpr, topR * dpr, botR * dpr, smooth);
                geom = buildAiGlowRing(pts, cur.thickness * dpr);
            }
            if (geom) {
                const time = (performance.now() - startMs) / 1000;
                paintAiGlowRing(geom.vertices, geom.vt, geom.radial, time, cur.speed, cur.intensity, cur.colors, cur.profile, cur.rainbow);
                renderer.renderChart(canvas, wPx, hPx, geom.vertices, geom.triCount, {
                    time, glow: cur.intensity, iridescence: 0, edgeSoftness: 1, saturation: 1,
                    bloomOnly: true, bloomSpread: cur.spread, bloomGain: cur.bloomGain ?? 2,
                });
            }
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
    }, [canvasRef]);
}
