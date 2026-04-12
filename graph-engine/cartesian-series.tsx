import React from 'react';
import { linePath, areaPath } from './scales.js';
import { seriesColor, cs } from './svg-parts.js';
import type { GraphDirective } from '../../architect/graph-composer.types.js';

/* ── renderSeries ───────────────────────────────────────────
 * Draws the data layer for bar, area, line, multi-line,
 * stacked-bar, stacked-area, distribution chart types.
 * ──────────────────────────────────────────────────────────── */

export function renderSeries(t: string, data: any[], labels: string[], band: any, yS: any, baseline: number, c: any, series: string[], pw: number, chart?: GraphDirective) {
    const isBar = t === 'bar';
    const isArea = t === 'area' || t === 'sparkline';
    if (t === 'distribution') {
        const bars = data.map((d: any, i: number) => {
            const b = band(labels[i]); const h = baseline - yS(d.value ?? 0);
            return <rect key={i} x={b.x} y={yS(d.value ?? 0)} width={b.width} height={Math.max(0, h)} rx={3} fill={c.primary} opacity={0.5} />;
        });
        const g = chart?.gaussian;
        if (!g) return <>{bars}</>;
        const xMin = parseFloat(labels[0]), xMax = parseFloat(labels[labels.length - 1]);
        const maxY = Math.max(...data.map((d: any) => d.value ?? 0));
        const scale = maxY / ((1 / (g.stddev * Math.sqrt(2 * Math.PI))));
        const gauss = (x: number) => (1 / (g.stddev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((x - g.mean) / g.stddev) ** 2) * scale;
        const x0 = band(labels[0]).x;
        const pts = Array.from({ length: 41 }, (_, i) => {
            const x = xMin + (i / 40) * (xMax - xMin);
            return { x: x0 + (i / 40) * pw, y: yS(Math.min(gauss(x), maxY * 1.1)) };
        });
        return <>{bars}<path d={linePath(pts)} fill="none" stroke={c.primary} strokeWidth={2} opacity={0.9} /></>;
    }
    if (isBar) return data.map((d: any, i: number) => {
        const b = band(labels[i]); const h = baseline - yS(d.value ?? 0);
        return <rect key={i} x={b.x} y={yS(d.value ?? 0)} width={b.width} height={Math.max(0, h)} rx={3} fill={c.gradient ? 'url(#gr-bar)' : c.primary} opacity={0.85} />;
    });
    if (isArea) {
        const pts = data.map((d: any, i: number) => { const b = band(labels[i]); return { x: b.x + b.width / 2, y: yS(d.value ?? 0) }; });
        return <><path d={areaPath(pts, baseline)} fill={c.fill} opacity={0.12} /><path d={linePath(pts)} fill="none" stroke={c.primary} strokeWidth={2} /></>;
    }
    if (t === 'line') {
        const pts = data.map((d: any, i: number) => { const b = band(labels[i]); return { x: b.x + b.width / 2, y: yS(d.value ?? 0) }; });
        return <><path d={linePath(pts)} fill="none" stroke={c.primary} strokeWidth={2} />{pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={c.primary} />)}</>;
    }
    if (t === 'multi-line') return <>{series.map((s, si) => {
        const pts = data.map((d: any, i: number) => { const b = band(labels[i]); return { x: b.x + b.width / 2, y: yS(d[s] || 0) }; });
        return <g key={s}><path d={linePath(pts)} fill="none" stroke={seriesColor(c, si)} strokeWidth={1.5} />{pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2} fill={seriesColor(c, si)} />)}</g>;
    })}</>;
    if (t === 'stacked-bar') return data.map((d: any, i: number) => {
        const b = band(labels[i]); let y0 = baseline;
        return <g key={i}>{series.map((s, si) => { const v = d[s] || 0; const h = baseline - yS(v); const y = y0 - h; y0 = y; const r = si === series.length - 1 ? 3 : 0;
            return <rect key={s} x={b.x} y={y} width={b.width} height={Math.max(0, h)} rx={r} fill={seriesColor(c, si)} opacity={0.85} />;
        })}</g>;
    });
    if (t === 'stacked-area') {
        const cumul = data.map((d: any) => { let s = 0; return series.map(k => { s += d[k] || 0; return s; }); });
        return <>{series.map((s, si) => {
            const pts = data.map((d: any, i: number) => { const b = band(labels[i]); return { x: b.x + b.width / 2, y: yS(cumul[i][si]) }; });
            const base = si === 0 ? data.map((_: any, i: number) => { const b = band(labels[i]); return { x: b.x + b.width / 2, y: baseline }; })
                : data.map((_: any, i: number) => { const b = band(labels[i]); return { x: b.x + b.width / 2, y: yS(cumul[i][si - 1]) }; });
            const topD = linePath(pts).replace(/^M/, '');
            const baseD = linePath([...base].reverse()).replace(/^M/, 'L');
            return <g key={s}><path d={`M${topD} ${baseD} Z`} fill={seriesColor(c, si)} opacity={0.2} /><path d={linePath(pts)} fill="none" stroke={seriesColor(c, si)} strokeWidth={1.5} /></g>;
        })}</>;
    }
    return null;
}
