/**
 * Chart feature overlays — Excel-style annotations layered on a
 * `GraphDirective`. Features are *derived projections of atoms*: they
 * recompute on fold the same way buckets do, never enter/exit. Each
 * feature emits `Primitive[]` and rides the same WebGPU pipeline as
 * bars/lines — no SVG overlay, no separate render path.
 *
 * The catalog (`AnalyticsCatalog`) declares which features each metric
 * carries (Option A — catalog-owned, not user-toggled).
 */

/** A single feature overlay applied to a chart. */
export type GraphFeature =
    | TrendlineFeature
    | MovingAverageFeature
    | ThresholdFeature
    | MinMaxMarkersFeature
    | AverageLineFeature;

/** Linear regression over the visible bucket values. v1: linear only. */
export interface TrendlineFeature {
    kind: 'trendline';
    /** Regression method. v1 supports linear; polynomial/exponential are
     *  Tier-2 follow-ups. */
    method?: 'linear';
}

/** Simple moving average across the visible buckets, window `N`. */
export interface MovingAverageFeature {
    kind: 'movingAverage';
    /** Window size in buckets. Common: 7 for daily, 4 for weekly. */
    window: number;
}

/** Constant horizontal line at `value` — target / budget / SLA. */
export interface ThresholdFeature {
    kind: 'threshold';
    value: number;
    /** Optional caption rendered near the line. */
    label?: string;
}

/** Highlight the argmax + argmin buckets with a marker each. */
export interface MinMaxMarkersFeature {
    kind: 'minMaxMarkers';
}

/** Mean of visible bucket values, rendered as a faint horizontal line. */
export interface AverageLineFeature {
    kind: 'averageLine';
}

/** Discriminator literal for the feature registry. */
export type GraphFeatureKind = GraphFeature['kind'];
