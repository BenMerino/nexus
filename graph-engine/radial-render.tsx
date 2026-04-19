import React, { useRef } from 'react';
import { arcScale, arcPath, donutArc } from './scales.js';
import { cs, seriesColor, FALLBACK_SERIES, useTooltip, TooltipOverlay, fmtValue } from './svg-parts.js';
import { BaseText } from '../primitives/BaseText.js';
import type { GraphDirective } from '../../architect/graph-composer.types.js';

/* ── Radial Render ───────────────────────────────────────────
 * One <svg> for: pie, donut, gauge, progress-ring.
 * ──────────────────────────────────────────────────────────── */

const RADIAL = new Set(['pie', 'donut', 'gauge', 'progress-ring']);
export function isRadial(type: string) { return RADIAL.has(type); }

export function RadialRender({ chart, size = 150 }: { chart: GraphDirective; size?: number }) {
    const t = chart.type;
    if (t === 'gauge') return <GaugeSvg chart={chart} size={size} />;
    if (t === 'progress-ring') return <RingSvg chart={chart} size={size} />;
    return <PieSvg chart={chart} size={size} donut={t === 'donut'} />;
}

function PieSvg({ chart, size, donut }: { chart: GraphDirective; size: number; donut: boolean }) {
    const ref = useRef<SVGSVGElement>(null);
    const { tip, show, hide } = useTooltip();
    const data = chart.data as any[];
    const colors = cs(chart).seriesColors || FALLBACK_SERIES;
    const cx = size / 2, cy = size / 2;
    const outer = size * 0.38, inner = donut ? size * 0.23 : 0;
    const values = data.map((d: any) => d.value ?? 0);
    const arcs = arcScale(values, -Math.PI / 2, Math.PI * 1.5);

    return (
        <div style={{ position: 'relative', width: '100%' }}>
            <svg ref={ref} viewBox={`0 0 ${size} ${size}`} width="100%" height={size} style={{ display: 'block' }} onMouseLeave={hide}>
                {arcs.map((arc, i) => {
                    const color = colors[i % colors.length];
                    const mid = (arc.startAngle + arc.endAngle) / 2;
                    const hx = cx + (outer * 0.7) * Math.cos(mid);
                    const hy = cy + (outer * 0.7) * Math.sin(mid);
                    const d = donut
                        ? donutArc(cx, cy, outer, inner, arc.startAngle, arc.endAngle)
                        : donutArc(cx, cy, outer, 0, arc.startAngle, arc.endAngle);
                    return <path key={i} d={d} fill={color} stroke="var(--bg-card)" strokeWidth={1.5}
                        onMouseEnter={() => show({ x: hx, y: hy, vbX: hx, vbY: hy, label: data[i].label, values: [{ name: 'value', value: values[i], color }] })} />;
                })}
                {donut && chart.yLabel && (
                    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={14} fontWeight={700} fill="var(--text-main)">
                        {chart.yLabel}
                    </text>
                )}
            </svg>
            <TooltipOverlay tip={tip} yLabel={chart.yLabel} currencyCfg={chart.currencyConfig} svgRef={ref} />
        </div>
    );
}

function GaugeSvg({ chart, size }: { chart: GraphDirective; size: number }) {
    const c = cs(chart);
    const d = (chart.data as any[])[0];
    if (!d) return null;
    const value = d.value ?? 0;
    const max = chart.range?.max ?? 100;
    const pct = Math.min(value / max, 1);
    const cx = size / 2, cy = size * 0.55, r = size * 0.38;
    const bgPath = arcPath(cx, cy, r, Math.PI, 0);
    const fgPath = arcPath(cx, cy, r, Math.PI, Math.PI + pct * Math.PI);

    return (
        <div style={{ textAlign: 'center' }}>
            <svg viewBox={`0 0 ${size} ${size * 0.6}`} width="100%" height={size * 0.55} style={{ display: 'block' }}>
                <path d={bgPath} fill="none" stroke="var(--border-main)" strokeWidth={8} strokeLinecap="round" opacity={0.4} />
                <path d={fgPath} fill="none" stroke={c.primary} strokeWidth={8} strokeLinecap="round" />
            </svg>
            <BaseText weight="bold" style={{ fontSize: 18, marginTop: -4, color: c.primary }}>{chart.currencyConfig ? fmtValue(value, chart.currencyConfig) : value}{chart.yLabel === '%' ? '%' : ''}</BaseText>
            <BaseText variant="detail" color="muted" style={{ fontSize: 9 }}>{d.label || chart.title}</BaseText>
        </div>
    );
}

function RingSvg({ chart, size }: { chart: GraphDirective; size: number }) {
    const c = cs(chart);
    const d = (chart.data as any[])[0];
    if (!d) return null;
    const value = d.value ?? 0;
    const max = chart.range?.max ?? 100;
    const pct = Math.min(value / max, 1);
    const cx = size / 2, cy = size / 2, r = size * 0.38, sw = 8;
    const circ = Math.PI * 2 * r;

    return (
        <div style={{ textAlign: 'center' }}>
            <svg viewBox={`0 0 ${size} ${size}`} width="100%" height={size} style={{ display: 'block' }}>
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border-main)" strokeWidth={sw} opacity={0.4} />
                <circle cx={cx} cy={cy} r={r} fill="none" stroke={c.primary} strokeWidth={sw}
                    strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} />
                <text x={cx} y={cy - 4} textAnchor="middle" fontSize={22} fontWeight={700} fill="var(--text-main)">{chart.currencyConfig ? fmtValue(value, chart.currencyConfig) : value}</text>
                <text x={cx} y={cy + 14} textAnchor="middle" fontSize={9} fill="var(--text-muted)">{d.label || chart.title}</text>
            </svg>
        </div>
    );
}
