import React from 'react';
import { linearScale, bandScale, niceDomain } from './scales';
import { MARGIN, XAxisBand, XAxisLinear, YAxis, GridLines } from './svg-parts';
import type { GraphDirective } from '../architect/graph-composer.types.js';

/* ── Scatter / Bubble / Waterfall ────────────────────────────
 * Specialized cartesian charts with unique data mappings.
 * ──────────────────────────────────────────────────────────── */

export function ScatterSvg({ chart, width = 320, height = 150 }: { chart: GraphDirective; width?: number; height?: number }) {
    const data = chart.data as any[];
    const xDom = niceDomain(Math.min(...data.map((d: any) => d.x)), Math.max(...data.map((d: any) => d.x)));
    const yDom = niceDomain(Math.min(...data.map((d: any) => d.y)), Math.max(...data.map((d: any) => d.y)));
    const xR: [number, number] = [MARGIN.left, width - MARGIN.right];
    const yR: [number, number] = [height - MARGIN.bottom, MARGIN.top];
    const xS = linearScale([xDom.min, xDom.max], xR);
    const yS = linearScale([yDom.min, yDom.max], yR);
    const maxZ = data.reduce((m: number, d: any) => Math.max(m, d.z ?? 1), 1);
    return (
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ display: 'block' }}>
            <GridLines domain={yDom} range={yR} xRange={xR} />
            <XAxisLinear domain={xDom} y={height - MARGIN.bottom} range={xR} />
            <YAxis domain={yDom} range={yR} x={MARGIN.left} />
            {data.map((d: any, i: number) => {
                const r = chart.type === 'bubble' ? 4 + ((d.z ?? 1) / maxZ) * 16 : 4;
                return <circle key={i} cx={xS(d.x)} cy={yS(d.y)} r={r} fill="var(--primary)" opacity={0.6} />;
            })}
        </svg>
    );
}

export function WaterfallSvg({ chart, width = 320, height = 150 }: { chart: GraphDirective; width?: number; height?: number }) {
    const data = chart.data as any[];
    const labels = data.map((d: any) => d.label);
    const xR: [number, number] = [MARGIN.left, width - MARGIN.right];
    const yR: [number, number] = [height - MARGIN.bottom, MARGIN.top];
    const band_ = bandScale(labels, xR);
    let running = 0;
    const bars = data.map((d: any) => {
        if (d.type === 'total') { running = d.value; return { base: 0, h: d.value, color: 'var(--primary)', label: d.label }; }
        const prev = running; running += d.type === 'subtract' ? -d.value : d.value;
        return { base: d.type === 'subtract' ? running : prev, h: Math.abs(d.value), color: d.type === 'subtract' ? 'var(--status-error, #ef4444)' : 'var(--status-success, #10b981)', label: d.label };
    });
    const maxV = Math.max(...bars.map(b => b.base + b.h));
    const yDom = niceDomain(0, maxV);
    const yS = linearScale([yDom.min, yDom.max], yR);
    return (
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ display: 'block' }}>
            <GridLines domain={yDom} range={yR} xRange={xR} />
            <XAxisBand labels={labels} y={yR[0]} range={xR} />
            <YAxis domain={yDom} range={yR} x={MARGIN.left} />
            {bars.map((b, i) => { const bn = band_(b.label); return <rect key={i} x={bn.x} y={yS(b.base + b.h)} width={bn.width} height={Math.max(0, yS(b.base) - yS(b.base + b.h))} rx={3} fill={b.color} opacity={0.85} />; })}
        </svg>
    );
}
