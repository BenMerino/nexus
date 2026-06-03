/**
 * Cartesian family — layout builder + SVG chrome + drag resolver.
 *
 * The animated cartesian families (`animated-cartesian.ts`) produce
 * primitives from this layout via the AnimatedFamily contract.
 * This file holds the non-animated surface: scales/ranges (the
 * `CartesianLayout`), axis/threshold chrome elements, and the
 * bucket resolver the drag-range overlay uses.
 */

import { linearScale, bandScale, pointScale, niceDomain } from './scales.js';
import type { GraphDirective } from '../../architect/graph-composer.types.js';
import { activeTierCount } from './chart-tier-groups.js';
import { baseXAxisReserve } from './x-axis-reserve.js';

/** The maximum number of tier rows any fold can render — `day` fold
 *  shows 4 rows (day + week + month + year). The plot reserves space
 *  for THIS COUNT regardless of the current fold, so the active data
 *  area's shape is invariant under fold changes. Coarser folds simply
 *  leave their unused tier slots empty rather than shrinking the
 *  margin, which would compress the bars.
 *
 *  Foundation invariant: the plot is the data substrate's canvas.
 *  Chrome rows below it occupy reserved space, not data space. */
export interface CartesianLayout {
    width: number;
    height: number;
    margin: { top: number; right: number; bottom: number; left: number };
    /** Plot region rect (margin-inset) in viewBox px. */
    xR: [number, number];
    yR: [number, number];
    yDom: { min: number; max: number; step: number };
    yS: (v: number) => number;
    labels: string[];
    band: ReturnType<typeof bandScale>;
    /** Point position for curve charts (x-coord of data point i). Honors
     *  atomic-flow `__x` when present — slider-driven charts stay
     *  geometrically continuous as the window pans. */
    pointAt: (i: number) => number;
    /** Bar position for discrete-x charts. Honors atomic-flow
     *  `__xStart`/`__xEnd` boundaries when present (continuous bucket
     *  width); falls back to bandScale otherwise. */
    positionAt: (i: number) => { x: number; width: number };
}

/** Build the shared layout (scales + plot rect) once, reused by every
 *  cartesian animated family's sample step plus the chrome builder
 *  and the drag-range resolver. */
export function buildCartesianLayout(
    chart: GraphDirective,
    width: number,
    height: number,
): CartesianLayout {
    const t = chart.type;
    const spark = t === 'sparkline';
    /* Bottom margin sized to the ACTUAL rendered tier count, not the
     *  theoretical max for this fold unit. `activeTierCount` peeks at
     *  the bucket isos and reports how many tiers would emit ≥1 group.
     *  E.g. a 90-day day-fold window has 'week','month' active but
     *  'year' empty (no year transition inside 90 days) → 1 base + 2
     *  tiers = 48px, not 1 + 3 = 62px. */
    const renderedTiers = activeTierCount(chart);
    /* Base-label row reserve: a flat row is ~20px, but when the base labels
     *  are too wide to fit horizontally the renderer rotates them to -40°
     *  (ChromeXAxisBand) and they drop well below a flat strip. Size the
     *  base reserve from the SAME rotation prediction the renderer uses
     *  (x-axis-reserve, the shared authority) so long category labels —
     *  journal/country names — aren't clipped by the container's
     *  overflow:hidden. Tier rows (always short: W3/May/2024) add 14px each
     *  on top; they never rotate. Plot-width estimate uses the 36px L/R
     *  gutters this same margin sets below. */
    const baseLabels = (chart.data as any[]).map((d: any) => String(d.label ?? ''));
    /* Curve check, computed up here so the categorical test (which gates the
     *  bottom-margin reserve below) can use it. Inlined rather than calling
     *  the exported `isCurve(t)` fn so there's no name collision with this
     *  local. Categorical x = a non-curve bar with no temporal fold unit
     *  (named entities); must match cartesianChrome's `isCategorical`. */
    const isCurveX = t === 'line' || t === 'multi-line' || t === 'area' || t === 'stacked-area' || spark;
    const categorical = !isCurveX && !chart.__foldUnit;
    const baseReserve = baseXAxisReserve(baseLabels, Math.max(1, width - 72), categorical);
    const defaultBottom = baseReserve + renderedTiers * 14;
    /* `right` matches `left` so the plot rect sits horizontally centered
     *  inside the chart canvas (left gutter holds y-axis tick labels;
     *  right gets the same width for visual symmetry, kept empty).
     *  `top` gives the highest y-tick label clearance from the inner
     *  border (the label baseline lands at yR[0] + 3 so the glyph top
     *  sits ~top - 6; an 8px top would put the label flush with the
     *  border). */
    const margin = chart.plotInsets ?? (spark
        ? { top: 4, right: 4, bottom: 4, left: 4 }
        : { top: 18, right: 36, bottom: defaultBottom, left: 36 });
    const pw = width - margin.left - margin.right;
    const ph = height - margin.top - margin.bottom;
    const xR: [number, number] = [margin.left, margin.left + pw];
    const yR: [number, number] = [margin.top, margin.top + ph];
    const data = chart.data as any[];
    const labels = data.map((d: any) => String(d.label ?? ''));

    const isStacked = t === 'stacked-bar' || t === 'stacked-area';
    const isMulti = t === 'multi-line';
    const series = chart.series || [];
    /* Y-domain max: atomic-flow charts pre-compute `__yMax` from per-
     *  bucket sums at the current fold. Bars and curves both scale to
     *  this — bars render bucket-sum height, curves connect bucket-sum
     *  points. */
    const allVals = isStacked
        ? data.map((d: any) => series.reduce((s: number, k: string) => s + (d[k] || 0), 0))
        : isMulti ? data.flatMap((d: any) => series.map((k: string) => d[k] || 0))
        : data.map((d: any) => d.value ?? 0);
    const yMaxFromAtoms = typeof chart.__yMax === 'number' ? chart.__yMax : 0;
    const yDom = niceDomain(0, Math.max(yMaxFromAtoms, ...allVals, 1));
    const yS = linearScale([yDom.min, yDom.max], [yR[1], yR[0]]);

    const band = bandScale(labels, xR, isCurveX ? 0 : 0.2);
    const points = pointScale(labels.length, xR);

    /* Atomic-flow temporal-x: when buckets carry __x (0..1 fraction
     * across the visible window) and optionally __xStart/__xEnd
     * (boundaries), bucket positions become continuous functions of the
     * slider window. As the window pans, bars/points slide smoothly
     * instead of snapping. Charts without __x fall back to band/point
     * scales, unchanged. */
    const hasTemporalX = data.some((d: any) => typeof d.__x === 'number');
    const plotWidth = xR[1] - xR[0];
    const fromTemporalX = (frac: number) => xR[0] + frac * plotWidth;

    const positionAt = (i: number): { x: number; width: number } => {
        const d = data[i] as any;
        if (hasTemporalX && typeof d.__x === 'number') {
            if (typeof d.__xStart === 'number' && typeof d.__xEnd === 'number') {
                const x0 = fromTemporalX(Math.max(0, Math.min(1, d.__xStart)));
                const x1 = fromTemporalX(Math.max(0, Math.min(1, d.__xEnd)));
                const w = x1 - x0;
                /* Bar padding 10% (was 20% per side in the old code; halving
                 * keeps the visual density similar with slightly thicker
                 * bars). Curves use no padding. */
                const pad = isCurveX ? 0 : w * 0.1;
                return { x: x0 + pad, width: Math.max(0, w - 2 * pad) };
            }
            const cx = fromTemporalX(d.__x);
            const w = band(labels[i]).width;
            return { x: cx - w / 2, width: w };
        }
        return band(labels[i]);
    };

    const pointAt = (i: number): number => {
        const d = data[i] as any;
        if (hasTemporalX && typeof d.__x === 'number') return fromTemporalX(d.__x);
        if (isCurveX) return points(i);
        const pos = positionAt(i);
        return pos.x + pos.width / 2;
    };

    return { width, height, margin, xR, yR, yDom, yS, labels, band, pointAt, positionAt };
}


export function isCurve(t: string): boolean {
    return t === 'line' || t === 'multi-line' || t === 'area'
        || t === 'stacked-area' || t === 'sparkline';
}

/** Resolve a viewport-x coordinate to a range endpoint. Used by the
 *  drag-range overlay. Returns null when the chart type doesn't support
 *  range selection.
 *
 *  `iso` is the canonical timeline anchor — the bucket's `__startISO`
 *  taken straight from the resolver. Endpoints are stored against `iso`,
 *  not `idx` or `vbX`, so a panned/zoomed window can re-locate the same
 *  point in time on the new frame. `idx` and `vbX` are view-frame caches
 *  for tooltip text and immediate render; they're recomputed every
 *  frame by `RangeEndpointTags` / `RangeHighlight` from `iso`. */
export interface DragEndpoint {
    idx: number;
    label: string;
    value: number;
    vbX: number;
    /** ViewBox-y of the data point at this bucket — `layout.yS(value)`.
     *  Renderer uses this to pin the endpoint dot/tag to the bucket's
     *  position on the curve/stack, not float at the top of the plot. */
    vbY: number;
    /** Bucket's `__startISO` — durable across pan/zoom. May be undefined
     *  for non-time-series charts (which today don't enable dragRange,
     *  but kept optional for future expansion). */
    iso?: string;
}

export function cartesianDragResolve(
    chart: GraphDirective,
    layout: CartesianLayout,
): ((viewportX: number, viewportRectWidth: number) => DragEndpoint | null) | null {
    const t = chart.type;
    /* Drag-range is meaningful for charts with discrete buckets along x. */
    if (t === 'scatter' || t === 'bubble' || t === 'sparkline') return null;
    const data = chart.data as any[];
    const isStacked = t === 'stacked-bar' || t === 'stacked-area';
    const isMulti = t === 'multi-line';
    const series = chart.series || [];
    const valueAt = (i: number): number => {
        const d = data[i];
        if (isStacked) return series.reduce((s: number, k: string) => s + (d[k] || 0), 0);
        if (isMulti) return series.reduce((s: number, k: string) => s + (d[k] || 0), 0) / Math.max(1, series.length);
        return d?.value ?? 0;
    };
    const pw = layout.xR[1] - layout.xR[0];
    return (viewportX: number, viewportRectWidth: number) => {
        if (viewportRectWidth <= 0 || data.length === 0) return null;
        const vbX = (viewportX / viewportRectWidth) * layout.width;
        const fracInPlot = (vbX - layout.xR[0]) / pw;
        const idx = Math.min(data.length - 1, Math.max(0, Math.floor(fracInPlot * data.length)));
        const v = valueAt(idx);
        return {
            idx,
            label: layout.labels[idx],
            value: v,
            vbX: layout.pointAt(idx),
            vbY: layout.yS(v),
            iso: data[idx]?.__startISO as string | undefined,
        };
    };
}

/** Reverse projection — given a stored `iso` from a previous frame's
 *  endpoint, find that bucket in the CURRENT frame's data. Returns null
 *  when the bucket isn't visible in the current window (panned off-screen,
 *  or zoomed past). The renderer uses this to re-locate selection
 *  endpoints every frame so the highlight band and tags stay glued to
 *  their data points across pan/zoom — the substrate is the timeline,
 *  not the plot pixels. */
export function cartesianIsoToFrame(
    chart: GraphDirective,
    layout: CartesianLayout,
): ((iso: string) => DragEndpoint | null) | null {
    const t = chart.type;
    if (t === 'scatter' || t === 'bubble' || t === 'sparkline') return null;
    const data = chart.data as any[];
    if (data.length === 0) return null;
    const isStacked = t === 'stacked-bar' || t === 'stacked-area';
    const isMulti = t === 'multi-line';
    const series = chart.series || [];
    const valueAt = (i: number): number => {
        const d = data[i];
        if (isStacked) return series.reduce((s: number, k: string) => s + (d[k] || 0), 0);
        if (isMulti) return series.reduce((s: number, k: string) => s + (d[k] || 0), 0) / Math.max(1, series.length);
        return d?.value ?? 0;
    };
    /* Build the iso → idx index once per frame. Bucket-iso uniqueness
     *  is guaranteed because each visible bucket spans a distinct calendar
     *  unit (day / week / month / etc.) — no two share the same start. */
    const isoToIdx = new Map<string, number>();
    for (let i = 0; i < data.length; i++) {
        const iso = data[i]?.__startISO as string | undefined;
        if (typeof iso === 'string') isoToIdx.set(iso, i);
    }
    return (iso: string) => {
        const idx = isoToIdx.get(iso);
        if (idx === undefined) return null;
        const v = valueAt(idx);
        return {
            idx,
            label: layout.labels[idx],
            value: v,
            vbX: layout.pointAt(idx),
            vbY: layout.yS(v),
            iso,
        };
    };
}

