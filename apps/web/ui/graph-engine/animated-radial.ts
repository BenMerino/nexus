/**
 * Animated radial families: pie, donut, gauge, progress-ring, radar,
 * heatmap, treemap, funnel.
 *
 * Animation in polar coords for pie/donut/gauge/ring uses
 * (startAngle, endAngle) as the easable fields. For radar, polygon
 * vertices are eased in cartesian (x, y) space — easier than easing
 * radii because the polygon is already in viewBox coords.
 *
 * Grid families (heatmap, treemap, funnel) ease their rect coords +
 * polygon vertices, same pattern as cartesian.
 */

import { arcScale, rampColor } from './scales.js';
import { cs, getSeriesPalette, weightOf, seriesColor } from './svg-parts.js';
import type { GraphDirective } from '../../architect/graph-composer.types.js';
import type { Primitive } from './chart-primitive.types.js';
import type { RadialLayout } from './chart-primitives-radial.js';
import { lerpNumber, lerpNumberArray, type AnimatedFamily, type AnimationPhase } from './animated-family.js';

/* ─── Pie / Donut ─── */

interface WedgeFieldState {
    startAngle: number; endAngle: number;
    color: string; hit: unknown;
}
export interface PieState {
    wedges: WedgeFieldState[];
    cx: number; cy: number;
    outerR: number; innerR: number;
}

export const animatedPie: AnimatedFamily<PieState> = {
    sample(chart, layoutRaw) {
        const layout = layoutRaw as RadialLayout;
        const data = chart.data as any[];
        const c = cs(chart);
        const colors = c.seriesColors || getSeriesPalette();
        const labels = data.map((d: any) => String(d.label ?? d.name ?? ''));
        const weighted = data.map((d: any, i: number) =>
            (d.value ?? 0) * weightOf(labels[i], chart.seriesWeights));
        const arcs = arcScale(weighted, -Math.PI / 2, Math.PI * 1.5);
        return {
            wedges: arcs.map((arc, i) => ({
                startAngle: arc.startAngle, endAngle: arc.endAngle,
                color: colors[i % colors.length],
                hit: { idx: i, label: labels[i], value: data[i].value ?? 0 },
            })),
            cx: layout.cx, cy: layout.cy,
            outerR: layout.outerR, innerR: layout.innerR,
        };
    },
    lerp(prev, target, phase) {
        const alpha = phase.alpha;
        const dRef = { value: 0 };
        const n = target.wedges.length;
        const wedges: WedgeFieldState[] = new Array(n);
        for (let i = 0; i < n; i++) {
            const t = target.wedges[i];
            const p = prev.wedges[i] ?? t;
            wedges[i] = {
                startAngle: lerpNumber(p.startAngle, t.startAngle, alpha, dRef),
                endAngle: lerpNumber(p.endAngle, t.endAngle, alpha, dRef),
                color: t.color, hit: t.hit,
            };
        }
        return {
            state: {
                wedges,
                cx: lerpNumber(prev.cx, target.cx, alpha, dRef),
                cy: lerpNumber(prev.cy, target.cy, alpha, dRef),
                outerR: lerpNumber(prev.outerR, target.outerR, alpha, dRef),
                innerR: lerpNumber(prev.innerR, target.innerR, alpha, dRef),
            },
            maxDelta: dRef.value,
        };
    },
    primitives(state) {
        return state.wedges
            .filter(w => Math.abs(w.endAngle - w.startAngle) > 1e-4)
            .map(w => ({
                kind: 'arc' as const,
                cx: state.cx, cy: state.cy,
                outerRadius: state.outerR, innerRadius: state.innerR,
                startAngle: w.startAngle, endAngle: w.endAngle,
                color: w.color, data: w.hit,
            }));
    },
};

/* ─── Gauge / Progress-ring (single-value annular arc) ─── */

interface GaugeBaseState {
    cx: number; cy: number; outerR: number; innerR: number;
    startAngle: number; endAngle: number; trackEndAngle: number;
    color: string; hit: unknown;
}
export interface GaugeState extends GaugeBaseState { isRing: boolean; }

function gaugeStateFor(chart: GraphDirective, layout: RadialLayout, isRing: boolean): GaugeState {
    const d = (chart.data as any[])[0];
    const c = cs(chart);
    if (!d) {
        return {
            cx: layout.cx, cy: layout.cy,
            outerR: layout.outerR, innerR: layout.innerR,
            startAngle: 0, endAngle: 0, trackEndAngle: 0,
            color: c.primary, hit: undefined, isRing,
        };
    }
    const value = d.value ?? 0;
    const max = chart.range?.max ?? 100;
    /* Clamp BOTH ends and guard max=0: a negative value drew a backwards
     *  arc below the gauge's baseline, and 0/0 = NaN propagated into the
     *  tessellator's triangle count. */
    const pct = Math.min(Math.max(value / (max || 1), 0), 1);
    const start = isRing ? -Math.PI / 2 : Math.PI;
    const trackEnd = isRing ? -Math.PI / 2 + Math.PI * 2 : Math.PI * 2;
    return {
        cx: layout.cx, cy: layout.cy,
        outerR: layout.outerR, innerR: layout.innerR,
        startAngle: start,
        endAngle: start + (trackEnd - start) * pct,
        trackEndAngle: trackEnd,
        color: c.primary,
        hit: { value, max, label: d.label },
        isRing,
    };
}

function gaugeLerp(prev: GaugeState, target: GaugeState, phase: AnimationPhase): { state: GaugeState; maxDelta: number } {
    const alpha = phase.alpha;
    const dRef = { value: 0 };
    return {
        state: {
            cx: lerpNumber(prev.cx, target.cx, alpha, dRef),
            cy: lerpNumber(prev.cy, target.cy, alpha, dRef),
            outerR: lerpNumber(prev.outerR, target.outerR, alpha, dRef),
            innerR: lerpNumber(prev.innerR, target.innerR, alpha, dRef),
            startAngle: lerpNumber(prev.startAngle, target.startAngle, alpha, dRef),
            endAngle: lerpNumber(prev.endAngle, target.endAngle, alpha, dRef),
            trackEndAngle: lerpNumber(prev.trackEndAngle, target.trackEndAngle, alpha, dRef),
            color: target.color, hit: target.hit, isRing: target.isRing,
        },
        maxDelta: dRef.value,
    };
}

function gaugePrimitives(state: GaugeState): Primitive[] {
    const out: Primitive[] = [{
        kind: 'arc',
        cx: state.cx, cy: state.cy,
        outerRadius: state.outerR, innerRadius: state.innerR,
        startAngle: state.startAngle, endAngle: state.trackEndAngle,
        color: 'var(--surface-muted, rgba(127,127,127,0.15))',
        data: undefined,
    }];
    if (Math.abs(state.endAngle - state.startAngle) > 1e-4) {
        out.push({
            kind: 'arc',
            cx: state.cx, cy: state.cy,
            outerRadius: state.outerR, innerRadius: state.innerR,
            startAngle: state.startAngle, endAngle: state.endAngle,
            color: state.color,
            data: state.hit,
        });
    }
    return out;
}

export const animatedGauge: AnimatedFamily<GaugeState> = {
    sample(chart, layoutRaw) { return gaugeStateFor(chart, layoutRaw as RadialLayout, false); },
    lerp: gaugeLerp,
    primitives: gaugePrimitives,
};

export const animatedRing: AnimatedFamily<GaugeState> = {
    sample(chart, layoutRaw) { return gaugeStateFor(chart, layoutRaw as RadialLayout, true); },
    lerp: gaugeLerp,
    primitives: gaugePrimitives,
};

