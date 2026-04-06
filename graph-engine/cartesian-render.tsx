import React, { useRef } from 'react';
import { linearScale, bandScale, niceDomain, linePath, areaPath } from './scales.js';
import { MARGIN, XAxisBand, YAxis, GridLines, ThresholdLines, Crosshairs, cs, seriesColor, useTooltip, TooltipOverlay } from './svg-parts.js';
import { ScatterSvg, WaterfallSvg } from './cartesian-special.js';
import { useDragRange, RangeHighlight, RangeBadge } from './drag-range.js';
import { defaultInteraction } from '../../architect/graph-composer.types.js';
import type { GraphDirective } from '../../architect/graph-composer.types.js';

/* ── Cartesian Render ────────────────────────────────────────
 * One <svg> for: bar, stacked-bar, area, stacked-area, line,
 * sparkline, distribution, waterfall, scatter, bubble.
 * ──────────────────────────────────────────────────────────── */

const CARTESIAN = new Set(['bar', 'stacked-bar', 'area', 'stacked-area', 'line', 'multi-line', 'sparkline', 'distribution', 'waterfall', 'scatter', 'bubble']);
export function isCartesian(type: string) { return CARTESIAN.has(type); }

export function CartesianRender({ chart, width = 320, height = 150 }: { chart: GraphDirective; width?: number; height?: number }) {
    const ref = useRef<SVGSVGElement>(null);
    const { tip, show, hide } = useTooltip();
    const { range, onDown: dragDown, onDrag, onUp: dragUp, clear: dragClear } = useDragRange();
    const c = cs(chart);
    const data = chart.data as any[];
    const t = chart.type;
    const spark = t === 'sparkline';
    const h = spark ? 40 : height;
    const m = spark ? { top: 4, right: 4, bottom: 4, left: 4 } : MARGIN;
    const pw = width - m.left - m.right;
    const ph = h - m.top - m.bottom;
    const xR: [number, number] = [m.left, m.left + pw];
    const yR: [number, number] = [m.top, m.top + ph];

    if (t === 'scatter' || t === 'bubble') return <ScatterSvg chart={chart} width={width} height={height} />;
    if (t === 'waterfall') return <WaterfallSvg chart={chart} width={width} height={height} />;

    const isStacked = t === 'stacked-bar' || t === 'stacked-area';
    const isMulti = t === 'multi-line';
    const series = chart.series || [];
    const labels = data.map((d: any) => String(d.label ?? ''));
    const band = bandScale(labels, xR, t === 'line' || t === 'multi-line' || t === 'area' || t === 'stacked-area' || spark ? 0 : 0.2);

    const allVals = isStacked
        ? data.map((d: any) => series.reduce((s: number, k: string) => s + (d[k] || 0), 0))
        : isMulti ? data.flatMap((d: any) => series.map((k: string) => d[k] || 0))
        : data.map((d: any) => d.value ?? 0);
    const yDom = niceDomain(0, Math.max(...allVals, 1));
    const yS = linearScale([yDom.min, yDom.max], [yR[1], yR[0]]);

    const resolve = (e: React.MouseEvent<SVGSVGElement>) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect || rect.width === 0) return null;
        const scaleX = rect.width / width;
        const scaleY = rect.height / h;
        const vbX = (e.clientX - rect.left) / scaleX;
        const idx = Math.min(data.length - 1, Math.max(0, Math.floor(((vbX - xR[0]) / pw) * data.length)));
        const d = data[idx]; if (!d) return null;
        const b = band(labels[idx]);
        const pX = b.x + b.width / 2;
        const pY = yS(allVals[idx]);
        return { idx, label: labels[idx], value: allVals[idx], vbX: pX, pY, scaleX, scaleY };
    };
    const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
        const r = resolve(e); if (!r) return;
        if (range.dragging) { onDrag({ idx: r.idx, label: r.label, value: r.value, vbX: r.vbX }); return; }
        const vals = isStacked || isMulti
            ? series.map((s: string, i: number) => ({ name: s, value: data[r.idx][s] || 0, color: seriesColor(c, i) }))
            : [{ name: 'value', value: r.value, color: c.primary }];
        show({ x: r.vbX * r.scaleX, y: r.pY * r.scaleY, vbX: r.vbX, vbY: r.pY, label: r.label, values: vals });
    };
    const ix = chart.interaction ?? defaultInteraction(t);
    const scX = ref.current ? ref.current.getBoundingClientRect().width / width : 1;

    return (
        <div style={{ position: 'relative', width: '100%' }}>
            <svg ref={ref} viewBox={`0 0 ${width} ${h}`} width="100%" height={h}
                onMouseMove={onMove} onMouseLeave={() => { if (!range.dragging) hide(); }}
                onMouseDown={ix.dragRange ? e => { const r = resolve(e); if (r) { dragClear(); hide(); dragDown({ idx: r.idx, label: r.label, value: r.value, vbX: r.vbX }); } } : undefined}
                onMouseUp={ix.dragRange ? dragUp : undefined}
                style={{ display: 'block', cursor: spark ? undefined : ix.dragRange ? 'crosshair' : undefined }}>
                {c.gradient && <defs><linearGradient id="gr-bar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={c.gradient[0]} /><stop offset="100%" stopColor={c.gradient[1]} /></linearGradient></defs>}
                {ix.dragRange && <RangeHighlight range={range} yR={yR} />}
                {!spark && <GridLines domain={yDom} range={[yR[1], yR[0]]} xRange={xR} />}
                {!spark && <XAxisBand labels={labels} y={yR[1]} range={xR} />}
                {!spark && <YAxis domain={yDom} range={[yR[1], yR[0]]} x={m.left} />}
                {renderSeries(t, data, labels, band, yS, yR[1], c, series, pw, chart)}
                {!spark && <ThresholdLines thresholds={chart.thresholds} yScale={yS} xRange={xR} />}
                {!spark && <Crosshairs tip={tip} xR={xR} yR={yR} mode={ix.crosshair} ms={ix.transitionMs} />}
            </svg>
            <TooltipOverlay tip={tip} yLabel={chart.yLabel} currencyCfg={chart.currencyConfig} svgRef={ref} ms={ix.transitionMs} />
            {ix.dragRange && <RangeBadge range={range} svgRef={ref} scaleX={scX} yLabel={chart.yLabel} currencyCfg={chart.currencyConfig} />}
        </div>
    );
}

function renderSeries(t: string, data: any[], labels: string[], band: any, yS: any, baseline: number, c: any, series: string[], pw: number, chart?: GraphDirective) {
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

