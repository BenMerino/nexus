/**
 * Animated rect-packing families: treemap (proportional rect packing)
 * and funnel (per-stage trapezoid). Both share a simple
 * {width, height} layout input and ease their rect/polygon vertex
 * coords linearly across frames.
 */

import { getSeriesPalette, weightOf } from './svg-parts.js';
import { cs } from './svg-parts.js';
import type { Primitive } from './chart-primitive.types.js';
import { lerpNumber, lerpNumberArray, type AnimatedFamily } from './animated-family.js';

/* ─── Treemap ─── */

interface TreemapNode {
    x: number; y: number; w: number; h: number;
    color: string; hit: unknown;
}
export interface TreemapState { nodes: TreemapNode[]; }

interface GridLayoutInput { width: number; height: number; }

export const animatedTreemap: AnimatedFamily<TreemapState> = {
    sample(chart, layoutRaw) {
        const layout = layoutRaw as GridLayoutInput;
        const c = cs(chart);
        const colors = c.seriesColors || getSeriesPalette();
        const nodes = (chart.data as any[]).slice(0, 12);
        const weighted = nodes.map((n: any) => ({
            ...n,
            _w: weightOf(String(n.name ?? n.label ?? ''), chart.seriesWeights),
        }));
        const total = weighted.reduce((s: number, n: any) => s + (n.value || 0) * n._w, 0) || 1;
        let x = 0;
        return {
            nodes: weighted.map((n: any, i: number) => {
                const w = ((n.value || 0) * n._w / total) * layout.width;
                const node: TreemapNode = {
                    x, y: 0, w, h: layout.height,
                    color: colors[i % colors.length],
                    hit: { name: n.name, value: n.value || 0 },
                };
                x += w;
                return node;
            }),
        };
    },
    lerp(prev, target, phase) {
        const alpha = phase.alpha;
        const dRef = { value: 0 };
        const n = target.nodes.length;
        const out: TreemapNode[] = new Array(n);
        for (let i = 0; i < n; i++) {
            const t = target.nodes[i];
            const p = prev.nodes[i] ?? t;
            out[i] = {
                x: lerpNumber(p.x, t.x, alpha, dRef),
                y: lerpNumber(p.y, t.y, alpha, dRef),
                w: lerpNumber(p.w, t.w, alpha, dRef),
                h: lerpNumber(p.h, t.h, alpha, dRef),
                color: t.color, hit: t.hit,
            };
        }
        return { state: { nodes: out }, maxDelta: dRef.value };
    },
    primitives(state) {
        return state.nodes
            .filter(n => n.w > 0)
            .map(n => ({ kind: 'rect' as const, x: n.x, y: n.y, w: n.w, h: n.h, color: n.color, data: n.hit }));
    },
};

/* ─── Funnel ─── */

interface FunnelStage {
    xs: number[]; ys: number[]; color: string; hit: unknown;
}
export interface FunnelState { stages: FunnelStage[]; }

export const animatedFunnel: AnimatedFamily<FunnelState> = {
    sample(chart, layoutRaw) {
        const layout = layoutRaw as GridLayoutInput;
        const c = cs(chart);
        const colors = c.seriesColors || getSeriesPalette();
        const data = chart.data as any[];
        if (data.length === 0) return { stages: [] };
        const maxVal = data[0]?.value || 1;
        const stepH = layout.height / data.length;
        const pad = 8;
        const wOf = (i: number) => weightOf(
            String(data[i].label ?? data[i].stage ?? data[i].name ?? ''),
            chart.seriesWeights);
        return {
            stages: data.map((d: any, i: number) => {
                const w = wOf(i);
                const topW = ((d.value || 0) / maxVal) * (layout.width - pad * 2) * w;
                const nextW = i < data.length - 1
                    ? ((data[i + 1].value || 0) / maxVal) * (layout.width - pad * 2) * wOf(i + 1)
                    : topW * 0.8;
                const cx = layout.width / 2;
                const y1 = i * stepH, y2 = y1 + stepH;
                return {
                    xs: [cx - topW / 2, cx + topW / 2, cx + nextW / 2, cx - nextW / 2],
                    ys: [y1, y1, y2, y2],
                    color: colors[i % colors.length],
                    hit: { idx: i, label: d.label ?? d.stage, value: d.value },
                };
            }),
        };
    },
    lerp(prev, target, phase) {
        const alpha = phase.alpha;
        const dRef = { value: 0 };
        const n = target.stages.length;
        const out: FunnelStage[] = new Array(n);
        for (let i = 0; i < n; i++) {
            const t = target.stages[i];
            const p = prev.stages[i] ?? t;
            out[i] = {
                xs: lerpNumberArray(p.xs, t.xs, alpha, dRef),
                ys: lerpNumberArray(p.ys, t.ys, alpha, dRef),
                color: t.color, hit: t.hit,
            };
        }
        return { state: { stages: out }, maxDelta: dRef.value };
    },
    primitives(state) {
        return state.stages.map(s => ({
            kind: 'polygon' as const,
            points: s.xs.map((x, i) => ({ x, y: s.ys[i] })),
            color: s.color,
            data: s.hit,
        }));
    },
};
