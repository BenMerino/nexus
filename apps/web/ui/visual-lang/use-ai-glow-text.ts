/**
 * Drives the word-shaped HDR glow behind the glass "Thinking…" text. A WebGPU
 * canvas paints the drifting orange→violet gradient, masks it to the glyph
 * shapes, and blooms it into a soft halo — so the glow follows the LETTERS, not
 * a box. The crisp glass text is a separate DOM layer on top.
 *
 * Alignment is driven by a ResizeObserver on the real label: the mask is built
 * only from POST-LAYOUT dimensions (never a first-tick guess), so it can't be
 * computed against a stale/zero box and drift. The canvas is the label box plus
 * a fixed symmetric MARGIN (room for the bloom); the mask draws the glyphs at
 * exactly +MARGIN, so they register over the label. On WebGPU the canvas is
 * rgba16float + `extended` tone mapping (genuinely above-SDR); WebGL2 clamps.
 */

import { useEffect, useRef, type RefObject } from 'react';
import { acquireSharedRenderer, type SharedRenderer } from './shared-renderer.js';
import { buildAiGlowText, paintAiGlowText } from './ai-glow-text.js';
import { AI_GLOW_COLORS, DEFAULT_GLOW_PROFILE, type GlowColors, type GlowProfile } from './ai-glow-ring.js';

/** Symmetric margin (CSS px) the canvas extends past the label box, so the
 *  bloom halo has room to spill. One source of truth for both the canvas inset
 *  and the mask's glyph offset — they can't disagree. */
const MARGIN = 16;

export interface UseAiGlowTextOpts {
    /** The glow wrapper — absolutely-inset span the canvas fills (a <canvas> is
     *  a replaced element, so insets can't stretch it directly). */
    glowRef: RefObject<HTMLElement | null>;
    /** The label element — source of truth for box + font (post-layout). */
    labelRef: RefObject<HTMLElement | null>;
    /** The word(s) — rasterized into the glyph mask. */
    text: string;
    /** Gradient drift speed. */
    speed: number;
    /** HDR gain (peak channel ≈ intensity × peakGain). */
    intensity: number;
    /** Orange→violet endpoints. */
    colors?: GlowColors;
    /** Across-band brightness shape — only `peakGain` is read here. */
    profile?: GlowProfile;
}

/** Rasterize the glyphs (label's exact font) as a white luminance mask, drawn at
 *  +MARGIN so they sit over the label, blurred slightly so the mask DILATES and
 *  passes the bloom halo. `lw/lh` are the label's CSS box; the canvas/mask are
 *  that plus 2×MARGIN. */
function buildGlyphMask(
    label: HTMLElement, text: string, lw: number, lh: number, dpr: number,
): { mask: string; wPx: number; hPx: number; insetX: number; insetY: number } {
    const cs = getComputedStyle(label);
    /* Measure the glyph INK box (ascent + descent), not the line box. The canvas
     * is sized to the ink + equal MARGIN on every side, so the bloom halo has
     * the SAME room in all directions — uniform glow. (Basing it on `lh`, the
     * line box, gave the vertical extra room from line-height padding → an oval
     * glow.) */
    const probe = document.createElement('canvas').getContext('2d');
    let inkH = lh;
    if (probe) {
        probe.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const m = probe.measureText(text);
        const a = m.actualBoundingBoxAscent || parseFloat(cs.fontSize) * 0.72;
        const d = m.actualBoundingBoxDescent || parseFloat(cs.fontSize) * 0.22;
        inkH = a + d;
    }
    const cw = lw + 2 * MARGIN, ch = inkH + 2 * MARGIN;
    /* The canvas is wider/taller than the label box by these per-axis insets;
     * the wrapper is inset by them so the glyphs still register under the text.
     * insetX is the usual MARGIN; insetY is MARGIN minus the line-box overhang
     * (so the canvas centres on the ink, which sits at the label's centre). */
    const insetX = MARGIN;
    const insetY = MARGIN - (lh - inkH) / 2;
    const wPx = Math.max(1, Math.round(cw * dpr));
    const hPx = Math.max(1, Math.round(ch * dpr));
    const off = document.createElement('canvas');
    off.width = wPx; off.height = hPx;
    const ctx = off.getContext('2d');
    if (!ctx) return { mask: 'none', wPx, hPx, insetX, insetY };
    ctx.scale(dpr, dpr);
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.filter = `blur(${(parseFloat(cs.fontSize) * 0.05).toFixed(2)}px)`;
    ctx.fillText(text, MARGIN, ch / 2);                    // ink centred in the canvas
    // TEMP DEBUG — remove once aligned.
    const dm = ctx.measureText(text);
    // eslint-disable-next-line no-console
    console.log('[ai-glow-text DEBUG]', JSON.stringify({
        text, lw, lh, inkH: +inkH.toFixed(1), cw: +cw.toFixed(1), ch: +ch.toFixed(1),
        insetX, insetY: +insetY.toFixed(1), fontSize: cs.fontSize, lineHeight: cs.lineHeight,
        textW: +dm.width.toFixed(1),
        inkL: +(dm.actualBoundingBoxLeft ?? 0).toFixed(1), inkR: +(dm.actualBoundingBoxRight ?? 0).toFixed(1),
        ascent: +(dm.actualBoundingBoxAscent ?? 0).toFixed(1), descent: +(dm.actualBoundingBoxDescent ?? 0).toFixed(1),
        fontAsc: +((dm.fontBoundingBoxAscent ?? 0)).toFixed(1), fontDesc: +((dm.fontBoundingBoxDescent ?? 0)).toFixed(1),
    }));
    return { mask: `url("${off.toDataURL()}")`, wPx, hPx, insetX, insetY };
}

export function useAiGlowText(
    canvasRef: RefObject<HTMLCanvasElement | null>,
    opts: UseAiGlowTextOpts,
): void {
    const optsRef = useRef(opts);
    optsRef.current = opts;

    useEffect(() => {
        const canvas = canvasRef.current;
        const glow = opts.glowRef.current;
        const label = opts.labelRef.current;
        if (!canvas || !glow || !label) return;
        let cancelled = false;
        let raf = 0;
        let renderer: SharedRenderer | null = null;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const startMs = performance.now();

        let geom: { vertices: Float32Array; cx: Float32Array; triCount: number } | null = null;
        let wPx = 0, hPx = 0;

        /* Rebuild geometry + mask from the label's POST-LAYOUT box. Driven by the
         * observer below — never from a first-tick clientWidth (the stale-size
         * bug that drifted the mask up-left). */
        const rebuild = () => {
            const lw = label.offsetWidth, lh = label.offsetHeight;
            if (lw <= 0 || lh <= 0) return;
            const built = buildGlyphMask(label, optsRef.current.text, lw, lh, dpr);
            wPx = built.wPx; hPx = built.hPx;
            /* Inset the WRAPPER (not the canvas — it's replaced) past the label
             * box by the per-axis margins, so the ink-centred mask registers
             * under the glass text and the halo room is uniform on every side. */
            glow.style.top = `-${built.insetY}px`;
            glow.style.bottom = `-${built.insetY}px`;
            glow.style.left = `-${built.insetX}px`;
            glow.style.right = `-${built.insetX}px`;
            geom = buildAiGlowText(wPx, hPx);
            canvas.style.setProperty('-webkit-mask-image', built.mask);
            canvas.style.setProperty('mask-image', built.mask);
        };

        const ro = new ResizeObserver(rebuild);
        ro.observe(label);
        rebuild();                                          // initial (observer also fires)

        const tick = () => {
            if (cancelled || !renderer) return;
            if (geom && wPx > 0) {
                const cur = optsRef.current;
                const time = (performance.now() - startMs) / 1000;
                paintAiGlowText(
                    geom.vertices, geom.cx, time, cur.speed, cur.intensity,
                    cur.colors ?? AI_GLOW_COLORS, cur.profile ?? DEFAULT_GLOW_PROFILE,
                );
                /* Bloom the masked glyphs → a soft word-shaped HDR halo. */
                renderer.renderChart(canvas, wPx, hPx, geom.vertices, geom.triCount, {
                    time, glow: cur.intensity, iridescence: 0, edgeSoftness: 1, saturation: 1,
                    bloomOnly: false, bloomSpread: 5, bloomGain: 1.6,
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
            ro.disconnect();
            if (raf) cancelAnimationFrame(raf);
        };
    }, [canvasRef, opts.glowRef, opts.labelRef]);
}
