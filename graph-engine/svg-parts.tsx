import React, { useState, useCallback } from 'react';
import { BaseBox } from '../primitives/BaseBox.js';
import { BaseText } from '../primitives/BaseText.js';
import { linearScale, niceDomain, ticks as genTicks } from './scales.js';
import type { GraphThreshold } from '../../architect/graph-composer.types.js';
export { cs, seriesColor, FALLBACK_SERIES } from './svg-color-schemes.js';

/* ── Shared SVG Parts ────────────────────────────────────────
 * Axes, grid, tooltip, crosshairs, thresholds.
 * ──────────────────────────────────────────────────────────── */

export const MARGIN = { top: 8, right: 8, bottom: 20, left: 36 };
const TICK = { fill: 'var(--text-muted)', fontSize: 11, fontWeight: 500 };
const GRID_STROKE = 'var(--border-main)';

export function XAxisBand({ labels, y, range }: { labels: string[]; y: number; range: [number, number] }) {
    const step = (range[1] - range[0]) / labels.length;
    const maxChars = Math.max(4, Math.floor(step / 5));
    const rotate = labels.some(l => l.length > maxChars);
    return <>{labels.map((l, i) => {
        const cx = range[0] + i * step + step / 2;
        const display = l.length > maxChars ? l.slice(0, maxChars - 1) + '…' : l;
        return rotate
            ? <text key={i} x={cx} y={y + 6} textAnchor="end" transform={`rotate(-40,${cx},${y + 6})`} {...TICK}>{display}</text>
            : <text key={i} x={cx} y={y + 14} textAnchor="middle" {...TICK}>{display}</text>;
    })}</>;
}

export function XAxisLinear({ domain, y, range }: { domain: { min: number; max: number; step: number }; y: number; range: [number, number] }) {
    const s = linearScale([domain.min, domain.max], range);
    return <>{genTicks(domain).map((v, i) => (
        <text key={i} x={s(v)} y={y + 14} textAnchor="middle" {...TICK}>{v}</text>
    ))}</>;
}

export function YAxis({ domain, range, x }: { domain: { min: number; max: number; step: number }; range: [number, number]; x: number }) {
    const s = linearScale([domain.min, domain.max], range);
    return <>{genTicks(domain).map((v, i) => (
        <text key={i} x={x - 4} y={s(v) + 3} textAnchor="end" {...TICK}>{fmtTick(v)}</text>
    ))}</>;
}

function fmtTick(v: number): string {
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return `${+(v / 1_000_000).toPrecision(3)}M`;
    if (abs >= 10_000) return `${+(v / 1_000).toPrecision(3)}k`;
    return String(v);
}

export function fmtValue(v: number, c?: { currency?: string; currencyFormat?: string }): string {
    const s = v.toLocaleString(undefined, { maximumFractionDigits: 0 });
    if (!c) return s;
    const sym = c.currency || '$';
    return c.currencyFormat === 'suffix' ? `${s} ${sym}` : `${sym}${s}`;
}

export function GridLines({ domain, range, xRange }: { domain: { min: number; max: number; step: number }; range: [number, number]; xRange: [number, number] }) {
    const s = linearScale([domain.min, domain.max], range);
    return <>{genTicks(domain).map((v, i) => (
        <line key={i} x1={xRange[0]} x2={xRange[1]} y1={s(v)} y2={s(v)} stroke={GRID_STROKE} strokeOpacity={0.45} />
    ))}</>;
}

export function ThresholdLines({ thresholds, yScale, xRange }: { thresholds?: GraphThreshold[]; yScale: (v: number) => number; xRange: [number, number] }) {
    if (!thresholds?.length) return null;
    return <>{thresholds.map((t, i) => {
        const y = yScale(t.value);
        return <g key={i}>
            <line x1={xRange[0]} x2={xRange[1]} y1={y} y2={y} stroke={t.color} strokeDasharray="4 4" strokeWidth={1} />
            <text x={xRange[1] - 2} y={y - 4} textAnchor="end" fontSize={9} fontWeight={600} fill={t.color}>{t.label}</text>
        </g>;
    })}</>;
}

/* ── Tooltip + Crosshairs ──────────────────────────────────── */
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

/** SVG crosshair lines — mode-aware, animated in viewBox coords */
export function Crosshairs({ tip, xR, yR, mode, ms = 0 }: { tip: TooltipState | null; xR: [number, number]; yR: [number, number]; mode: 'both' | 'vertical' | 'none'; ms?: number }) {
    if (!tip || mode === 'none') return null;
    const stroke = 'var(--text-muted)';
    const t = ms > 0 ? `all ${ms}ms ease-out` : undefined;
    return (
        <g opacity={0.4} pointerEvents="none">
            <line x1={tip.vbX} x2={tip.vbX} y1={tip.vbY} y2={yR[1]} stroke={stroke} strokeDasharray="3 3" strokeWidth={0.75} style={{ transition: t }} />
            {mode === 'both' && <line x1={xR[0]} x2={tip.vbX} y1={tip.vbY} y2={tip.vbY} stroke={stroke} strokeDasharray="3 3" strokeWidth={0.75} style={{ transition: t }} />}
            <circle cx={tip.vbX} cy={tip.vbY} r={3} fill={stroke} opacity={0.8} style={{ transition: t }} />
        </g>
    );
}

/** Tooltip overlay — absolute within the chart wrapper, glass surface */
export function TooltipOverlay({ tip, yLabel, currencyCfg, ms = 0 }: { tip: TooltipState | null; yLabel?: string; currencyCfg?: { currency?: string; currencyFormat?: string }; svgRef?: React.RefObject<SVGSVGElement | null>; ms?: number }) {
    if (!tip) return null;
    const t = ms > 0 ? `left ${ms}ms ease-out, top ${ms}ms ease-out` : undefined;
    return (
        <BaseBox
            px="3" py="2" surfaceRadius="sm" shadow="xl"
            style={{ position: 'absolute', left: tip.x, top: tip.y - 8, transform: 'translate(-50%, -100%)', zIndex: 50,
                background: 'var(--glass-bg, var(--bg-card))', backdropFilter: 'blur(12px)',
                border: '1px solid var(--border-ghost, var(--border-main))', pointerEvents: 'none',
                transition: t }}
        >
            <BaseText color="muted" style={{ display: 'block', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: 2 }}>
                {tip.label}
            </BaseText>
            {tip.values.map((v, i) => (
                <BaseText key={i} style={{ display: 'block', color: v.color, fontSize: 12, fontWeight: 600 }}>
                    {v.name !== 'value' ? `${v.name}: ` : ''}{fmtValue(v.value, currencyCfg)}{i === 0 && !currencyCfg ? ` ${yLabel || ''}` : ''}
                </BaseText>
            ))}
        </BaseBox>
    );
}
