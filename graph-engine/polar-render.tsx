import React from 'react';
import { cs, seriesColor } from './svg-parts.js';
import { linePath } from './scales.js';
import type { GraphDirective } from '../../architect/graph-composer.types.js';

/* ── Polar Render ────────────────────────────────────────────
 * Radar chart: concentric rings + axis spokes + polygon per series.
 * ──────────────────────────────────────────────────────────── */

const POLAR = new Set(['radar']);
export function isPolar(type: string) { return POLAR.has(type); }

export function PolarRender({ chart, size = 170 }: { chart: GraphDirective; size?: number }) {
    const data = chart.data as any[];
    const series = chart.series || [];
    const c = cs(chart);
    const cx = size / 2, cy = size / 2, maxR = size * 0.34;
    const axes = data.length;
    if (axes < 3 || !series.length) return null;

    const angleStep = (Math.PI * 2) / axes;
    const axisAngle = (i: number) => -Math.PI / 2 + i * angleStep;

    const allVals = data.flatMap((d: any) => series.map(s => d[s] ?? 0));
    const maxVal = Math.max(...allVals, 1);
    const rings = [0.25, 0.5, 0.75, 1];

    return (
        <svg viewBox={`0 0 ${size} ${size}`} width="100%" height={size} style={{ display: 'block' }}>
            {/* Concentric grid rings */}
            {rings.map((r, i) => (
                <circle key={i} cx={cx} cy={cy} r={maxR * r} fill="none" stroke="var(--border-main)" strokeOpacity={0.15} />
            ))}
            {/* Axis spokes + labels */}
            {data.map((_: any, i: number) => {
                const a = axisAngle(i);
                const ex = cx + maxR * Math.cos(a);
                const ey = cy + maxR * Math.sin(a);
                const lx = cx + (maxR + 12) * Math.cos(a);
                const ly = cy + (maxR + 12) * Math.sin(a);
                return (
                    <g key={i}>
                        <line x1={cx} y1={cy} x2={ex} y2={ey} stroke="var(--border-main)" strokeOpacity={0.15} />
                        <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central" fontSize={8} fontWeight={600} fill="var(--text-muted)">
                            {data[i].label}
                        </text>
                    </g>
                );
            })}
            {/* Series polygons */}
            {series.map((s, si) => {
                const pts = data.map((d: any, i: number) => {
                    const a = axisAngle(i);
                    const r = ((d[s] ?? 0) / maxVal) * maxR;
                    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
                });
                const color = seriesColor(c, si);
                return (
                    <g key={s}>
                        <polygon points={pts.map(p => `${p.x},${p.y}`).join(' ')} fill={color} fillOpacity={0.12} stroke={color} strokeWidth={1.5} />
                        {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={color} />)}
                    </g>
                );
            })}
        </svg>
    );
}
