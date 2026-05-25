/**
 * Internal resolver contract. Each feature is a pure function:
 *   (visible bucket data, prior bucket data, layout, feature) → Primitive[]
 *
 * Layout supplies the px-space scales the resolver projects into.
 * Data carries `__x` (window fraction [0,1]) + `value` per bucket.
 *
 * Lookback: when a feature needs context from BEFORE the visible window
 * (e.g. moving averages whose leading window straddles the start), it
 * declares the count via `lookback(feature)`. `resolveAtomicDirective`
 * folds that many extra prior buckets and supplies them as `prior`;
 * resolvers concat `prior + data` internally before computing.
 */

import type { CartesianLayout } from '../chart-primitives-cartesian.js';
import type { Primitive } from '../chart-primitive.types.js';
import type { GraphFeature } from '../../../architect/graph-features.types.js';

/** A data row as `resolveAtomicDirective` shapes it. The fields the
 *  feature resolvers actually read — anything beyond is opaque. */
export interface FeatureDatum {
    label: string;
    value: number;
    __x?: number;
}

/** Pure resolver: take post-fold buckets + layout, return overlay
 *  primitives in px space. Resolvers MUST be deterministic and
 *  side-effect free — they re-run every animation frame.
 *
 *  `prior` carries up to `lookback(feature)` buckets BEFORE the visible
 *  window, folded at the same granularity as `data`. Resolvers that
 *  don't request lookback ignore it; the dispatcher passes an empty
 *  array when none was computed. */
export type FeatureResolver<F extends GraphFeature = GraphFeature> = (
    data: ReadonlyArray<FeatureDatum>,
    layout: CartesianLayout,
    feature: F,
    prior?: ReadonlyArray<FeatureDatum>,
) => Primitive[];

/** Optional lookback declaration. Returns the number of pre-window
 *  buckets the resolver wants supplied as `prior`. The dispatcher takes
 *  the max across all active features in the directive and folds that
 *  many prior buckets once. Resolvers without a `lookback` need none. */
export type FeatureLookback<F extends GraphFeature = GraphFeature> = (feature: F) => number;

export interface FeatureModule<F extends GraphFeature = GraphFeature> {
    resolve: FeatureResolver<F>;
    /** Optional. Omit when the resolver doesn't read pre-window data. */
    lookback?: FeatureLookback<F>;
}

/** Discriminator-keyed map; populated by `registry.ts` via static imports. */
export type FeatureRegistry = {
    [K in GraphFeature['kind']]: FeatureModule<Extract<GraphFeature, { kind: K }>>;
};
