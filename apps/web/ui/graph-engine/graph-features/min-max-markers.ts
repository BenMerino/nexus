/**
 * Argmax + argmin highlights — two outlined circles at the tallest and
 * shortest visible bucket. For stacked charts (stacked-bar / stacked-
 * area / multi-line) the height is `Σ series[k]`, not `d.value`, which
 * carries only the writer's primary series. Without summing, every
 * bucket reads as the same magnitude and the resolver collapses
 * max/min onto bucket 0.
 *
 * Renders as stroked circles to avoid confusion with scatter / bubble
 * fills.
 */

import type { Primitive } from '../chart-primitive.types.js';
import type { FeatureModule, FeatureResolver, FeatureDatum } from './feature.types.js';

const MARKER_MAX_COLOR = 'var(--status-success)';
const MARKER_MIN_COLOR = 'var(--status-danger)';
const MARKER_OPACITY = 0.9;
const MARKER_STROKE_PX = 2;
const MARKER_RADIUS_PX = 5;

/** Bucket height: sum of all numeric series fields when the resolver
 *  is given a series list; otherwise the writer's primary `value`.
 *  Matches `buildCartesianLayout`'s stacked-y-domain math so markers
 *  sit on the same y-axis as the bars/area. */
function heightOf(d: FeatureDatum, series: ReadonlyArray<string>): number {
    if (series.length === 0) return d.value ?? 0;
    let sum = 0;
    for (const k of series) {
        const v = (d as unknown as Record<string, number | undefined>)[k];
        if (typeof v === 'number') sum += v;
    }
    return sum;
}

const resolve: FeatureResolver<{ kind: 'minMaxMarkers' }> = (
    data, layout, _feature, _prior,
) => {
    if (data.length === 0) return [];
    /* `layout.labels` parallels `chart.data`; we read series off the
     *  CartesianLayout's chart via the closure — but the resolver has
     *  no direct chart ref. The dispatcher passes `chart` only as part
     *  of the directive; series live there. For now, infer series keys
     *  by scanning the first datum for numeric fields beyond the
     *  positional ones. */
    const reserved = new Set(['label', 'value', '__x', '__xStart', '__xEnd', '__startISO', '__endISO']);
    const sample = data[0] as unknown as Record<string, unknown>;
    const series: string[] = [];
    for (const k of Object.keys(sample)) {
        if (reserved.has(k)) continue;
        if (typeof sample[k] === 'number') series.push(k);
    }

    let maxIdx = 0, minIdx = 0;
    let maxH = heightOf(data[0], series);
    let minH = maxH;
    for (let i = 1; i < data.length; i++) {
        const h = heightOf(data[i], series);
        if (h > maxH) { maxH = h; maxIdx = i; }
        if (h < minH) { minH = h; minIdx = i; }
    }
    /* Flat series — every bucket is both min and max. Drawing both at
     *  the same point is noise; emit nothing. */
    if (maxIdx === minIdx) return [];
    const plotW = layout.xR[1] - layout.xR[0];
    const fromFrac = (f: number) => layout.xR[0] + f * plotW;
    const marker = (i: number, h: number, color: string): Primitive | null => {
        const d = data[i];
        if (typeof d.__x !== 'number') return null;
        return {
            kind: 'circle',
            cx: fromFrac(d.__x),
            cy: layout.yS(h),
            r: MARKER_RADIUS_PX,
            strokeWidth: MARKER_STROKE_PX,
            color,
            opacity: MARKER_OPACITY,
        };
    };
    const out: Primitive[] = [];
    const hi = marker(maxIdx, maxH, MARKER_MAX_COLOR);
    const lo = marker(minIdx, minH, MARKER_MIN_COLOR);
    if (hi) out.push(hi);
    if (lo) out.push(lo);
    return out;
};

export const minMaxMarkersModule: FeatureModule<{ kind: 'minMaxMarkers' }> = { resolve };
