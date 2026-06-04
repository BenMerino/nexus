/**
 * Client-runtime fields of `GraphDirective` — extracted from
 * `graph-composer.types.ts` to keep it under the line ceiling.
 *
 * These are NEVER set by the composer and NEVER serialized. They are
 * attached client-side by `GraphRender` / `useDirectiveController` /
 * `resolveAtomicDirective`. `GraphDirective` mixes them in via
 * `extends GraphDirectiveRuntime`.
 */

import type { ChartData } from './graph-data.types.js';

export interface GraphDirectiveRuntime {
    /** Series the user has toggled visible (from `useToggleFilters`). */
    activeSeries?: Set<string>;
    /** Opt-in subset of `features[].kind`, persisted per (tenant, user). */
    activeFeatures?: Set<import('./graph-features.types.js').GraphFeatureKind>;
    /** Pre-window buckets supplied to features with `lookback()` (e.g.
     *  MA lines start at x=0). */
    __priorBuckets?: ChartData;
    /** Per-series tween weight in [0..1]; renderers multiply geometry
     *  so stacks/wedges reflow continuously instead of snapping. */
    seriesWeights?: Map<string, number>;
    /** Percentile clip window [lower, upper] in [0..1]; published by
     *  the continuous legend's drag handles. */
    colorClip?: { lower: number; upper: number };
    /** Resolved fold unit (post-`pickAutoFoldUnit`); chrome builders
     *  read this for hierarchical X-axis tiers. */
    __foldUnit?: 'hour' | 'day' | 'month' | 'year' | 'decade' | 'century';
    /** Per-atom placement in window-normalized [0,1] coordinates.
     *  When present, families read atoms + placements (foundation-
     *  correct path) instead of pre-folded `data[]`. Indexed parallel
     *  to `chart.atoms`. */
    __placements?: ReadonlyArray<{ xStart: number; xEnd: number; yBase: number; bucketKey: string }>;
    /** THE canonical bucket sequence for the visible window — one
     *  empties-included, index-stable list (parallel to `data`) that
     *  every cartesian family reads for geometry. Built once by
     *  `resolveAtomicDirective` via `bucketSequence`, so chrome, bars,
     *  and curves share the same buckets (no sparse-data desync). */
    __buckets?: ReadonlyArray<import('./place-atoms.js').BucketAggregate>;
    /** Visible y-domain maximum derived from per-bucket stack-tops at
     *  the current fold. */
    __yMax?: number;
    /** Resolved KPI reduction for `kpi.reduce` — computed over `__buckets`
     *  in `resolveAtomicDirective` (the same clock as the buckets, so the
     *  headline tracks window/fold). Absent when `kpi` is unset or uses the
     *  authoritative `figure` path. `ChartKpiHeader` reads this. */
    __kpiReduction?: import('../ui/graph-engine/reduction.js').Reduction;
    /** Off-window neighbor points — see EdgeNeighbors in
     *  `graph-edge-neighbors.types.ts`. */
    __edgeNeighbors?: import('./graph-edge-neighbors.types.js').EdgeNeighbors;
    /** True when this update came from continuous user input (slider
     *  drag, atomic window patch). The animation engine treats these
     *  as a gesture-continuation — clocks keep running, target
     *  retargets — instead of restarting per directive. */
    __instantUpdate?: boolean;
}
