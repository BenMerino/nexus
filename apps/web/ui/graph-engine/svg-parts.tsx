import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { BaseText } from '../primitives/BaseText.js';
import { GlassTag } from './GlassTag.js';
export { cs, seriesColor, getSeriesPalette } from './svg-color-schemes.js';

/* ── Shared SVG Parts ────────────────────────────────────────
 * Tooltip + weight helpers. Axis/threshold/crosshair primitives
 * have moved to `ChartChromeLayer` (the single chrome renderer).
 * ──────────────────────────────────────────────────────────── */

export const MARGIN = { top: 8, right: 36, bottom: 20, left: 36 };

/** Per-series visual weight 0..1 for legend toggle animation. Renderers
 * multiply each series' contribution to geometry by this. RAF-tweened upstream
 * by useToggleFilters. */
export function weightOf(key: string, weights?: Map<string, number>): number {
    return weights ? weights.get(key) ?? 1 : 1;
}

/** Group-level fade matching the weight. pointerEvents off when nearly hidden. */
export function seriesGroupStyle(w: number): React.CSSProperties {
    return { opacity: w, pointerEvents: w < 0.05 ? 'none' : undefined };
}

export function fmtValue(v: number, c?: { currency?: string; currencyFormat?: string }): string {
    const s = v.toLocaleString(undefined, { maximumFractionDigits: 0 });
    if (!c) return s;
    const sym = c.currency || '$';
    return c.currencyFormat === 'suffix' ? `${s} ${sym}` : `${sym}${s}`;
}

/* ── Tooltip ──────────────────────────────────────────────── */
interface TooltipState {
    x: number; y: number;
    vbX: number; vbY: number;
    label: string;
    values: { name: string; value: number; color: string }[];
}

export function useTooltip() {
    const [tip, setTip] = useState<TooltipState | null>(null);
    const show = useCallback((state: TooltipState) => setTip(state), []);
    const hide = useCallback(() => setTip(null), []);
    return { tip, show, hide };
}

/** Tooltip overlay — portaled to document.body so it can render outside
 * the chart card's `overflow: hidden` clip. Position derives from the
 * SVG's getBoundingClientRect plus the tip's SVG-local coords scaled to
 * actual pixel size. `ms` controls the glide between hovered points;
 * defaults to 80ms so renderers that don't read the interaction config
 * (radial, etc.) still get a smooth tooltip transition. */
export function TooltipOverlay({ tip, yLabel, currencyCfg, svgRef, ms = 80 }: { tip: TooltipState | null; yLabel?: string; currencyCfg?: { currency?: string; currencyFormat?: string }; svgRef?: React.RefObject<SVGSVGElement | null>; ms?: number }) {
    if (!tip || typeof document === 'undefined') return null;
    const rect = svgRef?.current?.getBoundingClientRect();
    if (!rect) return null;
    /* `tip.x, tip.y` are in scaled-SVG-pixel coords (the renderer multiplies
     * vbX/vbY by scaleX/scaleY before calling show()). Add the SVG's
     * viewport-relative origin to get viewport coords for the portal. */
    const vpLeft = rect.left + tip.x;
    const vpTop = rect.top + tip.y - 8;
    const t = ms > 0 ? `left ${ms}ms ease-out, top ${ms}ms ease-out` : undefined;
    return createPortal(
        <GlassTag shadow="xl"
            style={{ position: 'fixed', left: vpLeft, top: vpTop, transform: 'translate(-50%, -100%)', zIndex: 9999, transition: t }}
        >
            <BaseText color="muted" style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: 2 }}>
                {tip.label}
            </BaseText>
            {tip.values.map((v, i) => (
                <BaseText key={i} style={{ color: v.color, fontSize: 12, fontWeight: 600 }}>
                    {v.name !== 'value' ? `${v.name}: ` : ''}{fmtValue(v.value, currencyCfg)}{i === 0 && !currencyCfg ? ` ${yLabel || ''}` : ''}
                </BaseText>
            ))}
        </GlassTag>,
        document.body
    );
}
