import React, { useState } from 'react';
import { cs, FALLBACK_SERIES, fmtValue } from './svg-parts.js';
import { defaultInteraction } from '../../architect/graph-composer.types.js';
import type { GraphDirective } from '../../architect/graph-composer.types.js';

function parseHex(hex: string): [number, number, number] {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rampColor(stops: string[], t: number): string {
    if (stops.length < 2) return stops[0] ?? '#888';
    const seg = Math.min(t, 0.999) * (stops.length - 1);
    const i = Math.floor(seg), f = seg - i;
    const [ar, ag, ab] = parseHex(stops[i]), [br, bg, bb] = parseHex(stops[i + 1]);
    return `rgb(${Math.round(ar + (br - ar) * f)},${Math.round(ag + (bg - ag) * f)},${Math.round(ab + (bb - ab) * f)})`;
}

/* ── Grid Render ─────────────────────────────────────────────
 * SVG-based: heatmap, treemap, funnel.
 * ──────────────────────────────────────────────────────────── */

const GRID = new Set(['heatmap', 'treemap', 'funnel']);
export function isGrid(type: string) { return GRID.has(type); }

export function GridRender({ chart, width = 320, height = 150, axesOverride }: { chart: GraphDirective; width?: number; height?: number; axesOverride?: string }) {
    switch (chart.type) {
        case 'heatmap': return <HeatmapSvg chart={chart} width={width} height={height} axesOverride={axesOverride} />;
        case 'treemap': return <TreemapSvg chart={chart} width={width} height={height} />;
        case 'funnel':  return <FunnelSvg chart={chart} width={width} height={height} />;
        default: return null;
    }
}

function HeatmapSvg({ chart, width, height, axesOverride }: { chart: GraphDirective; width: number; height: number; axesOverride?: string }) {
    const c = cs(chart);
    const ramp = c.gradient ?? ['#10b981', '#f59e0b', '#ef4444'];
    const ix = chart.interaction ?? defaultInteraction('heatmap');
    const showMarginal = (axesOverride ?? ix.axes) === 'marginal';
    const cells = chart.data as any[];
    const rows = [...new Set(cells.map((d: any) => d.row))];
    const cols = [...new Set(cells.map((d: any) => d.col))];
    const maxVal = Math.max(...cells.map((d: any) => d.value), 1);
    const cellMap = new Map(cells.map((d: any) => [`${d.row}|${d.col}`, d.value]));
    const [hover, setHover] = useState<{ ri: number; ci: number; val: number } | null>(null);

    const labelW = 30, labelH = 14, margR = showMarginal ? 20 : 0, margB = showMarginal ? 12 : 0;
    const cellW = Math.max(8, (width - labelW - margR) / cols.length);
    const cellH = Math.max(8, (height - labelH - margB) / rows.length);
    const useCell = ix.crosshair === 'cell';
    const t = ix.transitionMs > 0 ? `opacity ${ix.transitionMs}ms ease-out` : undefined;

    const rowSums = rows.map(row => cols.reduce((s, col) => s + (cellMap.get(`${row}|${col}`) || 0), 0));
    const colSums = cols.map(col => rows.reduce((s, row) => s + (cellMap.get(`${row}|${col}`) || 0), 0));
    const maxRowSum = Math.max(...rowSums, 1);
    const maxColSum = Math.max(...colSums, 1);
    const gridRight = labelW + cols.length * cellW;
    const gridBottom = labelH + rows.length * cellH;

    return (
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ display: 'block' }} onMouseLeave={() => setHover(null)}>
            {cols.map((col, ci) => (
                <text key={ci} x={labelW + ci * cellW + cellW / 2} y={10} textAnchor="middle" fontSize={7} fontWeight={600}
                    fill={useCell && hover?.ci === ci ? 'var(--text-main)' : 'var(--text-muted)'} style={{ transition: t }}>{col}</text>
            ))}
            {rows.map((row, ri) => (
                <g key={ri}>
                    <text x={labelW - 3} y={labelH + ri * cellH + cellH / 2 + 3} textAnchor="end" fontSize={8} fontWeight={600}
                        fill={useCell && hover?.ri === ri ? 'var(--text-main)' : 'var(--text-muted)'} style={{ transition: t }}>{row}</text>
                    {cols.map((col, ci) => {
                        const val = cellMap.get(`${row}|${col}`) || 0;
                        const ratio = val / maxVal;
                        const isHovered = hover?.ri === ri && hover?.ci === ci;
                        const isAxis = useCell && hover && (hover.ri === ri || hover.ci === ci);
                        const cellColor = ratio === 0 && !isAxis ? 'transparent' : rampColor(ramp, ratio);
                        return <rect key={ci} x={labelW + ci * cellW + 0.5} y={labelH + ri * cellH + 0.5} width={cellW - 1} height={cellH - 1} rx={2}
                            fill={cellColor}
                            opacity={ratio === 0 && !isAxis ? 0 : isHovered ? 1 : isAxis ? 0.5 : 0.9}
                            stroke={isHovered ? 'var(--text-main)' : 'none'} strokeWidth={isHovered ? 1.5 : 0}
                            style={{ cursor: useCell ? 'crosshair' : undefined, transition: t }}
                            onMouseEnter={() => setHover({ ri, ci, val })} />;
                    })}
                </g>
            ))}
            {useCell && hover && (
                <text x={labelW + hover.ci * cellW + cellW / 2} y={labelH + hover.ri * cellH - 3}
                    textAnchor="middle" fontSize={9} fontWeight={700} fill="var(--text-main)">{fmtValue(hover.val, chart.currencyConfig)}</text>
            )}
            {showMarginal && rows.map((_, ri) => (
                <rect key={`mr-${ri}`} x={gridRight + 3} y={labelH + ri * cellH + 1} rx={2}
                    width={Math.max(1, (rowSums[ri] / maxRowSum) * (margR - 5))} height={cellH - 2}
                    fill={ramp[ramp.length - 1]} opacity={hover?.ri === ri ? 0.7 : 0.3} style={{ transition: t }} />
            ))}
            {showMarginal && cols.map((_, ci) => (
                <rect key={`mc-${ci}`} x={labelW + ci * cellW + 1} y={gridBottom + 2} rx={2}
                    width={cellW - 2} height={Math.max(1, (colSums[ci] / maxColSum) * (margB - 4))}
                    fill={ramp[ramp.length - 1]} opacity={hover?.ci === ci ? 0.7 : 0.3} style={{ transition: t }} />
            ))}
        </svg>
    );
}

function TreemapSvg({ chart, width, height }: { chart: GraphDirective; width: number; height: number }) {
    const colors = cs(chart).seriesColors || FALLBACK_SERIES;
    const nodes = (chart.data as any[]).slice(0, 12);
    const total = nodes.reduce((s: number, n: any) => s + (n.value || 0), 0) || 1;
    let x = 0;
    const rects = nodes.map((n: any, i: number) => {
        const w = ((n.value || 0) / total) * width;
        const r = { x, y: 0, w, h: height, name: n.name || '', color: colors[i % colors.length] };
        x += w;
        return r;
    });

    return (
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ display: 'block' }}>
            {rects.map((r, i) => (
                <g key={i}>
                    <rect x={r.x + 1} y={1} width={Math.max(0, r.w - 2)} height={r.h - 2} rx={4} fill={r.color} opacity={0.8} />
                    {r.w > 24 && <text x={r.x + r.w / 2} y={r.h / 2} textAnchor="middle" dominantBaseline="central" fontSize={8} fontWeight={600} fill="#fff">{r.name}</text>}
                </g>
            ))}
        </svg>
    );
}

function FunnelSvg({ chart, width, height }: { chart: GraphDirective; width: number; height: number }) {
    const colors = cs(chart).seriesColors || FALLBACK_SERIES;
    const data = chart.data as any[];
    const maxVal = data[0]?.value || 1;
    const stepH = height / data.length;
    const pad = 8;

    return (
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ display: 'block' }}>
            {data.map((d: any, i: number) => {
                const topW = ((d.value || 0) / maxVal) * (width - pad * 2);
                const nextW = i < data.length - 1 ? ((data[i + 1].value || 0) / maxVal) * (width - pad * 2) : topW * 0.8;
                const cx = width / 2;
                const y1 = i * stepH, y2 = y1 + stepH;
                const path = `M ${cx - topW / 2} ${y1} L ${cx + topW / 2} ${y1} L ${cx + nextW / 2} ${y2} L ${cx - nextW / 2} ${y2} Z`;
                return (
                    <g key={i}>
                        <path d={path} fill={colors[i % colors.length]} opacity={0.8} />
                        <text x={cx} y={y1 + stepH / 2} textAnchor="middle" dominantBaseline="central" fontSize={9} fontWeight={600} fill="#fff">{d.label}</text>
                    </g>
                );
            })}
        </svg>
    );
}
