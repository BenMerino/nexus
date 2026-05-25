/**
 * Feature overlay dispatcher. `appendFeaturePrimitives` is the single
 * seam the chart animation hook calls on every frame — it folds the
 * directive's `features` list through the registry and appends the
 * resulting `Primitive[]` after the data marks so overlays render on
 * top in the WebGPU triangle stream.
 *
 * Features apply to cartesian families only. Radial/grid charts have
 * no meaningful trendline or moving-average semantics; the dispatcher
 * no-ops on those.
 */

import type { Primitive } from '../chart-primitive.types.js';
import type { CartesianLayout } from '../chart-primitives-cartesian.js';
import type { GraphDirective } from '../../../architect/graph-composer.types.js';
import type { GraphFeature } from '../../../architect/graph-features.types.js';
import type { FeatureRegistry, FeatureDatum } from './feature.types.js';
import { trendlineModule } from './trendline.js';
import { movingAverageModule } from './moving-average.js';
import { thresholdModule } from './threshold.js';
import { minMaxMarkersModule } from './min-max-markers.js';
import { averageLineModule } from './average-line.js';

const REGISTRY: FeatureRegistry = {
    trendline: trendlineModule,
    movingAverage: movingAverageModule,
    threshold: thresholdModule,
    minMaxMarkers: minMaxMarkersModule,
    averageLine: averageLineModule,
};

/** Largest pre-window bucket count any ACTIVE feature on the directive
 *  requests. `resolveAtomicDirective` reads this to fold exactly that
 *  many prior buckets — never more, never less. Zero means no resolver
 *  needs lookback; the resolver can skip the prior-fold pass entirely. */
export function maxLookbackForDirective(chart: GraphDirective): number {
    const features = chart.features;
    if (!features || features.length === 0) return 0;
    const active = chart.activeFeatures;
    let max = 0;
    for (const f of features) {
        if (active && !active.has(f.kind)) continue;
        const mod = REGISTRY[f.kind] as { lookback?: (ff: GraphFeature) => number };
        if (!mod.lookback) continue;
        const n = mod.lookback(f);
        if (n > max) max = n;
    }
    return max;
}

/** Chart types features apply to. Cartesian only — pies/heatmaps/radars
 *  have no trendline semantics. Sparkline is excluded because the
 *  whole point is "just the line"; an overlay would defeat it. */
const CARTESIAN_FAMILIES = new Set([
    'bar', 'stacked-bar', 'area', 'stacked-area', 'line', 'multi-line',
    'distribution', 'waterfall', 'scatter', 'bubble',
]);

/** Compute overlay primitives for a frame. Pure: same inputs → same
 *  output; safe to call every rAF tick without memoization (the
 *  resolvers themselves are O(n) over the bucket count). */
export function computeFeaturePrimitives(
    chart: GraphDirective,
    layout: CartesianLayout,
): Primitive[] {
    if (!chart.features || chart.features.length === 0) return [];
    if (!chart.type || !CARTESIAN_FAMILIES.has(chart.type)) return [];
    /* Opt-in gating: catalog declares which features are AVAILABLE on
     *  this chart; `activeFeatures` (per-user, server-persisted) declares
     *  which are ON. Empty active set → render none, even if the catalog
     *  declared five. Renders everything when activeFeatures is omitted
     *  entirely (e.g. server-side smoke tests, probe round-trips). */
    const active = chart.activeFeatures;
    const data = chart.data as ReadonlyArray<FeatureDatum>;
    const prior = (chart.__priorBuckets ?? []) as ReadonlyArray<FeatureDatum>;
    const out: Primitive[] = [];
    for (const f of chart.features) {
        if (active && !active.has(f.kind)) continue;
        const resolver = REGISTRY[f.kind].resolve as
            ((d: ReadonlyArray<FeatureDatum>, l: CartesianLayout, ff: typeof f, p?: ReadonlyArray<FeatureDatum>) => Primitive[]);
        const prims = resolver(data, layout, f, prior);
        for (const p of prims) out.push(p);
    }
    return out;
}

/** Compute the feature-overlay primitives for a frame. Returns an
 *  empty array when the chart has no active features. Callers render
 *  these to a SEPARATE WebGPU canvas with bloom disabled — features
 *  are annotations, not data marks, so they don't participate in the
 *  data-mark aesthetic and stay crisp at thin stroke widths. */
export function featurePrimitivesFor(
    chart: GraphDirective,
    layout: unknown,
): Primitive[] {
    if (!chart.features || chart.features.length === 0) return [];
    return computeFeaturePrimitives(chart, layout as CartesianLayout);
}

export type { FeatureResolver, FeatureDatum } from './feature.types.js';
