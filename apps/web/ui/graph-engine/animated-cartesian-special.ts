/**
 * Animated cartesian special families: scatter, bubble (per-dot
 * position + radius), waterfall (per-bar with running cumulative
 * base), distribution (bar histogram + optional gaussian curve).
 */

import { linearScale, niceDomain } from './scales.js';
import { cs, getSeriesPalette } from './svg-parts.js';
import type { GraphDirective } from '../../architect/graph-composer.types.js';
import type { Primitive } from './chart-primitive.types.js';
import type { CartesianLayout } from './chart-primitives-cartesian.js';
import { lerpNumber, lerpNumberArray, type AnimatedFamily } from './animated-family.js';
import { animatedBar, type BarState, type BarItem } from './animated-cartesian.js';

/* ─── Scatter / Bubble ─── */

interface ScatterDot {
    cx: number; cy: number; r: number;
    color: string; opacity: number; hit: unknown;
}
export interface ScatterState { dots: ScatterDot[]; }

function buildScatterDots(chart: GraphDirective, layout: CartesianLayout, isBubble: boolean): ScatterDot[] {
    const data = chart.data as any[];
    const c = cs(chart);
    const palette = c.seriesColors || getSeriesPalette();
    const dotColor = palette[0];
    const m = layout.margin;
    const xVals = data.map((d: any) => d.x);
    const yVals = data.map((d: any) => d.y);
    if (xVals.length === 0) return [];
    const xDom = niceDomain(Math.min(...xVals), Math.max(...xVals));
    const yDom = niceDomain(Math.min(...yVals), Math.max(...yVals));
    const xS = linearScale([xDom.min, xDom.max], [m.left, layout.width - m.right]);
    const yS = linearScale([yDom.min, yDom.max], [layout.height - m.bottom, m.top]);
    const zMax = isBubble ? Math.max(...data.map((d: any) => d.z ?? 0), 1) : 1;
    return data.map((d: any, i: number) => ({
        cx: xS(d.x), cy: yS(d.y),
        r: isBubble ? 4 + ((d.z ?? 0) / zMax) * 14 : 3,
        color: dotColor,
        opacity: isBubble ? 0.55 : 1,
        hit: { idx: i, x: d.x, y: d.y, z: d.z, label: d.label },
    }));
}

export const animatedScatter: AnimatedFamily<ScatterState> = {
    sample(chart, layoutRaw) {
        return { dots: buildScatterDots(chart, layoutRaw as CartesianLayout, false) };
    },
    lerp(prev, target, phase) {
        const alpha = phase.alpha;
        const dRef = { value: 0 };
        const n = target.dots.length;
        const dots: ScatterDot[] = new Array(n);
        for (let i = 0; i < n; i++) {
            const t = target.dots[i];
            const p = prev.dots[i] ?? t;
            dots[i] = {
                cx: lerpNumber(p.cx, t.cx, alpha, dRef),
                cy: lerpNumber(p.cy, t.cy, alpha, dRef),
                r: lerpNumber(p.r, t.r, alpha, dRef),
                color: t.color, opacity: t.opacity, hit: t.hit,
            };
        }
        return { state: { dots }, maxDelta: dRef.value };
    },
    primitives(state) {
        return state.dots.map(d => ({
            kind: 'circle' as const,
            cx: d.cx, cy: d.cy, r: d.r,
            color: d.color, opacity: d.opacity,
            data: d.hit,
        }));
    },
};

export const animatedBubble: AnimatedFamily<ScatterState> = {
    sample(chart, layoutRaw) {
        return { dots: buildScatterDots(chart, layoutRaw as CartesianLayout, true) };
    },
    lerp: animatedScatter.lerp,
    primitives: animatedScatter.primitives,
};

/* ─── Waterfall ─── */

interface WaterfallBar {
    x: number; y: number; w: number; h: number;
    color: string; hit: unknown;
}
export interface WaterfallState { bars: WaterfallBar[]; }

export const animatedWaterfall: AnimatedFamily<WaterfallState> = {
    sample(chart, layoutRaw) {
        const layout = layoutRaw as CartesianLayout;
        const data = chart.data as any[];
        let running = 0;
        const out: WaterfallBar[] = [];
        for (let i = 0; i < data.length; i++) {
            const d = data[i];
            const pos = layout.positionAt(i);
            if (d.type === 'total') {
                const topY = layout.yS(d.value);
                const baseY = layout.yR[1];
                out.push({
                    x: pos.x, y: topY, w: pos.width,
                    h: Math.max(0, baseY - topY),
                    color: 'var(--primary)',
                    hit: { idx: i, label: d.label, value: d.value, kind: 'total', __startISO: d.__startISO },
                });
                running = d.value;
            } else {
                const prev = running;
                running += d.type === 'subtract' ? -d.value : d.value;
                const base = d.type === 'subtract' ? running : prev;
                const topY = layout.yS(base + Math.abs(d.value));
                const baseY = layout.yS(base);
                out.push({
                    x: pos.x, y: topY, w: pos.width,
                    h: Math.max(0, baseY - topY),
                    color: d.type === 'subtract' ? 'var(--status-error)' : 'var(--status-success)',
                    hit: { idx: i, label: d.label, value: d.value, kind: d.type, __startISO: d.__startISO },
                });
            }
        }
        return { bars: out };
    },
    lerp(prev, target, phase) {
        const alpha = phase.alpha;
        const dRef = { value: 0 };
        const n = target.bars.length;
        const bars: WaterfallBar[] = new Array(n);
        for (let i = 0; i < n; i++) {
            const t = target.bars[i];
            const p = prev.bars[i] ?? t;
            bars[i] = {
                x: lerpNumber(p.x, t.x, alpha, dRef),
                y: lerpNumber(p.y, t.y, alpha, dRef),
                w: lerpNumber(p.w, t.w, alpha, dRef),
                h: lerpNumber(p.h, t.h, alpha, dRef),
                color: t.color, hit: t.hit,
            };
        }
        return { state: { bars }, maxDelta: dRef.value };
    },
    primitives(state) {
        return state.bars
            .filter(b => b.w > 0 && b.h > 0)
            .map(b => ({ kind: 'rect' as const, x: b.x, y: b.y, w: b.w, h: b.h, color: b.color, data: b.hit }));
    },
};

/* ─── Distribution (bar + optional gaussian polyline) ─── */

export interface DistributionState {
    bars: BarItem[];
    gaussian: { xs: number[]; ys: number[]; color: string } | null;
}

export const animatedDistribution: AnimatedFamily<DistributionState> = {
    sample(chart, layoutRaw) {
        const layout = layoutRaw as CartesianLayout;
        const bars = animatedBar.sample(chart, layoutRaw).bars;
        if (!chart.gaussian) return { bars, gaussian: null };
        const data = chart.data as any[];
        const c = cs(chart);
        const labels = layout.labels;
        const xMin = parseFloat(labels[0]);
        const xMax = parseFloat(labels[labels.length - 1]);
        const maxY = Math.max(...data.map((d: any) => d.value ?? 0));
        const g = chart.gaussian;
        const scale = maxY / (1 / (g.stddev * Math.sqrt(2 * Math.PI)));
        const gauss = (x: number) =>
            (1 / (g.stddev * Math.sqrt(2 * Math.PI))) *
            Math.exp(-0.5 * ((x - g.mean) / g.stddev) ** 2) * scale;
        const pw = layout.xR[1] - layout.xR[0];
        const x0 = layout.xR[0];
        const xs: number[] = [];
        const ys: number[] = [];
        for (let i = 0; i < 41; i++) {
            const x = xMin + (i / 40) * (xMax - xMin);
            xs.push(x0 + (i / 40) * pw);
            ys.push(layout.yS(Math.min(gauss(x), maxY * 1.1)));
        }
        return { bars, gaussian: { xs, ys, color: c.primary } };
    },
    lerp(prev, target, phase) {
        const alpha = phase.alpha;
        const barRes = animatedBar.lerp({ bars: prev.bars }, { bars: target.bars }, phase);
        let g = target.gaussian;
        let maxDelta = barRes.maxDelta;
        if (target.gaussian && prev.gaussian) {
            const dRef = { value: 0 };
            g = {
                xs: lerpNumberArray(prev.gaussian.xs, target.gaussian.xs, alpha, dRef),
                ys: lerpNumberArray(prev.gaussian.ys, target.gaussian.ys, alpha, dRef),
                color: target.gaussian.color,
            };
            if (dRef.value > maxDelta) maxDelta = dRef.value;
        }
        return { state: { bars: barRes.state.bars, gaussian: g }, maxDelta };
    },
    primitives(state) {
        const out = animatedBar.primitives({ bars: state.bars }, undefined as unknown, undefined as unknown as GraphDirective);
        if (state.gaussian) {
            out.push({
                kind: 'polyline',
                points: state.gaussian.xs.map((x, i) => ({ x, y: state.gaussian!.ys[i] })),
                strokeWidth: 1.5,
                color: state.gaussian.color,
            });
        }
        return out;
    },
};
