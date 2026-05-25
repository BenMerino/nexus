import React from 'react';
import type { GraphDirective } from '../../architect/graph-composer.types.js';

/* ── Shared SVG <defs> ───────────────────────────────────────
 * Reusable gradients/patterns/filters emitted once per chart.
 * Drop <GraphDefs /> inside every renderer's <svg>.
 * ──────────────────────────────────────────────────────────── */

/** Stable id for an area-fade gradient parameterized by color key. */
export function areaFadeId(key: string): string { return `graph-area-fade-${key}`; }

/** Inline gradient def — render alongside paths. Top stop = color@45%, bottom = transparent.
 * If `yRange` is provided, gradient is mapped in user space across that vertical span — every
 * shape sampling this gradient sees the same fade across the chart, regardless of its own
 * bounding box. Used by stacked-area so all bands share one chart-wide fade. */
export function AreaFadeGradient({ id, color, yRange }: { id: string; color: string; yRange?: [number, number] }) {
    if (yRange) {
        return (
            <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={0} y1={yRange[0]} x2={0} y2={yRange[1]}>
                <stop offset="0%" stopColor={color} stopOpacity={0.45} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
        );
    }
    return (
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.45} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
    );
}

/** Shared defs emitted once per chart. Contains the noise grain filter used
 *  by all fill elements via textureFilter(). The filter overlays fractal noise
 *  in 'overlay' blend mode — applied to the final painted shape, not composed
 *  through the gradient source (which caused banding in the previous attempt). */
export function GraphDefs() {
    return (
        <defs>
            <filter id="gr-noise" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
                {/* fractalNoise gives even, non-directional grain — no repeating stripes */}
                <feTurbulence type="fractalNoise" baseFrequency="1.8" numOctaves="4" stitchTiles="stitch" result="noise" />
                {/* Desaturate + scale contrast way down so grain is visible but not harsh */}
                <feColorMatrix type="saturate" values="0" in="noise" result="grey" />
                <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.18 0" in="grey" result="dimGrain" />
                {/* Clip the grain to the shape's alpha channel */}
                <feComposite in="dimGrain" in2="SourceGraphic" operator="in" result="clipped" />
                {/* Overlay blend: midtones unaffected, grain lightens highlights / darkens shadows */}
                <feBlend in="SourceGraphic" in2="clipped" mode="overlay" />
            </filter>
        </defs>
    );
}

/** Single-hue gradient: top = `color` opaque, bottom = same color deepened (oklch L lowered)
 * at low alpha. The "deepening" uses `color-mix(in oklch, color, black)` which preserves hue
 * and chroma — only luminance drops. No hue crossings, no muddy mid-mixes. The bottom stop
 * is also low-alpha so the surface shows through; the deepening just gives the gradient a
 * subtle "rolled-off" depth instead of a flat alpha fade.
 * Chat renders bolder (lower fade alpha), dashboard softer. */
function fadeOpacity(renderCtx: 'chat' | 'dashboard' | undefined): number {
    return renderCtx === 'chat' ? 0.35 : 0.15;
}

/** Same-hue deepened color via oklch mix toward black. 70% retains most of the hue identity. */
function deepStop(color: string): string {
    return `color-mix(in oklch, ${color} 70%, black)`;
}

/** Vertical linear gradient (top→bottom). Single-hue, deepened bottom, low alpha at baseline. */
export function VerticalFillGradient({ id, color, yRange, renderCtx }: { id: string; color: string; yRange: [number, number]; renderCtx?: 'chat' | 'dashboard' }) {
    return (
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={0} y1={yRange[0]} x2={0} y2={yRange[1]}>
            <stop offset="0%" stopColor={color} stopOpacity={1} />
            <stop offset="100%" stopColor={deepStop(color)} stopOpacity={fadeOpacity(renderCtx)} />
        </linearGradient>
    );
}

/** Radial gradient centered at (cx, cy), radius r. Single-hue, deepened edge, low alpha. */
export function RadialFillGradient({ id, color, cx, cy, r, renderCtx }: { id: string; color: string; cx: number; cy: number; r: number; renderCtx?: 'chat' | 'dashboard' }) {
    return (
        <radialGradient id={id} gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={r} fx={cx} fy={cy}>
            <stop offset="0%" stopColor={color} stopOpacity={1} />
            <stop offset="100%" stopColor={deepStop(color)} stopOpacity={fadeOpacity(renderCtx)} />
        </radialGradient>
    );
}

/** Returns the shared noise filter URL. Applied to all fill elements. */
export function textureFilter(_chart: Pick<GraphDirective, 'type' | 'style'>): string | undefined {
    return 'url(#gr-noise)';
}
