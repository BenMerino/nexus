/* ── Graph Composer Types ──────────────────────────────────────
 * Shared types for the GraphComposer sub-service of Architect.
 * The composer classifies raw data shapes and produces typed
 * chart directives that shared UI components render.
 * ──────────────────────────────────────────────────────────── */

import type { BaseQuery, ReplayableDirective, ToggleSpec } from './replayable-directive.js';
/** Supported visualization types — 19 total */
export type GraphType =
    | 'bar' | 'stacked-bar' | 'area' | 'stacked-area' | 'line' | 'multi-line'
    | 'pie' | 'donut' | 'heatmap' | 'radar' | 'distribution'
    | 'gauge' | 'progress-ring' | 'funnel' | 'scatter' | 'bubble'
    | 'waterfall' | 'sparkline' | 'treemap';

/** Single data point for simple charts (bar, area, line, pie, etc.) */
export interface GraphDataPoint {
    label: string;
    value: number;
    secondary?: number;
}

/** Multi-series data point (stacked-bar, stacked-area, radar) */
export interface StackedGraphDataPoint {
    label: string;
    [seriesKey: string]: string | number;
}

/** Heatmap cell — row × col grid with intensity value */
export interface HeatmapDataPoint { row: string; col: string; value: number; }

/** Scatter plot point — x/y with optional grouping */
export interface ScatterDataPoint { x: number; y: number; z?: number; label?: string; group?: string; }

/** Waterfall step — additive, subtractive, or running total */
export interface WaterfallDataPoint { label: string; value: number; type: 'add' | 'subtract' | 'total'; }

/** Treemap node — hierarchical with optional children */
export interface TreemapNode { name: string; value: number; children?: TreemapNode[]; }

/** All possible chart data shapes */
export type ChartData =
    | GraphDataPoint[] | StackedGraphDataPoint[]
    | HeatmapDataPoint[] | ScatterDataPoint[]
    | WaterfallDataPoint[] | TreemapNode[];

/** Threshold line rendered on the chart */
export interface GraphThreshold { value: number; label: string; color: string; }

/** Annotation marker on a specific data point */
export interface GraphAnnotation { index: number; label: string; color?: string; }

/** Interaction mode resolved by GraphComposer — drives crosshairs, drag, axes, and animation */
export interface InteractionMode {
    crosshair: 'both' | 'vertical' | 'cell' | 'none';
    dragRange: boolean;
    transitionMs: number;
    /** Axis display: 'standard' (X/Y), 'marginal' (row/col totals), 'none' */
    axes: 'none' | 'standard' | 'marginal';
}

/** Value-encoding legend mode — explains how the chart maps data to visual marks.
 * - 'categorical': swatch+label chips, doubles as series toggle (pie/donut/treemap/multi-series)
 * - 'continuous':  gradient ramp with min/max value labels (heatmap)
 * - 'size':        reference circles at small/med/large with their values (bubble)
 * - 'none':        suppressed (gauge/sparkline/progress-ring — single value, axis-encoded)
 * - 'auto':        resolved per chart type via `defaultLegendMode`
 */
export type LegendMode = 'auto' | 'categorical' | 'continuous' | 'size' | 'none';

/** Resolve default legend mode from chart type. Pure: shared by server + client. */
export function defaultLegendMode(type: string): Exclude<LegendMode, 'auto'> {
    if (type === 'heatmap') return 'continuous';
    if (type === 'bubble') return 'size';
    if (type === 'gauge' || type === 'progress-ring' || type === 'sparkline') return 'none';
    return 'categorical';
}

/** Resolve default interaction mode from chart type (shared by server + client) */
export function defaultInteraction(type: string): InteractionMode {
    if (type === 'line' || type === 'multi-line' || type === 'scatter' || type === 'bubble') return { crosshair: 'both', dragRange: true, transitionMs: 80, axes: 'standard' };
    if (type === 'area' || type === 'stacked-area') return { crosshair: 'vertical', dragRange: true, transitionMs: 80, axes: 'standard' };
    if (type === 'heatmap') return { crosshair: 'cell', dragRange: false, transitionMs: 60, axes: 'marginal' };
    if (type === 'bar' || type === 'stacked-bar') return { crosshair: 'none', dragRange: false, transitionMs: 60, axes: 'standard' };
    if (type === 'sparkline') return { crosshair: 'none', dragRange: false, transitionMs: 80, axes: 'none' };
    return { crosshair: 'none', dragRange: false, transitionMs: 0, axes: 'none' };
}

/** Semantic sentiment driving color selection */
export type ColorSentiment = 'positive' | 'negative' | 'neutral' | 'warning';

/** Dynamic color scheme resolved from data, metric, and intent */
export interface ColorScheme {
    sentiment: ColorSentiment;
    primary: string;
    fill: string;
    secondary?: string;
    gradient?: string[];
    seriesColors?: string[];
}

/** Rendering context — chat uses bolder sentiment colors, dashboard uses muted professional tones */
export type RenderContext = 'chat' | 'dashboard';

/** Replayable recipe describing the query that produced this directive.
 * When present, the client may mutate fields (e.g. via toggles) and POST
 * to `/api/architect/recompose` to receive a fresh GraphDirective.
 * Extends the universal `BaseQuery` (kind + tenantId) so it shares the
 * recompose endpoint with TableDirective.query and any future directive
 * type that opts into the replay pattern. */
export interface GraphQuery extends BaseQuery {
    /** Window width in days, anchored at `asOf` (or "now"). Continuous —
     * the toggle pills (7, 30, 90, 365) are named *positions*; a slider
     * could emit any positive integer. `null` = all-time (no lower bound).
     *
     * The server consumes this via `WindowSpec`/`expandWindow` (one canonical
     * primitive in `graph-density.ts`) so SQL filters and bucket-fill share
     * exactly the same date arithmetic — off-by-one is structurally
     * impossible. */
    windowDays?: number | null;
    /** Calendar fold unit for time-series charts. The renderer groups
     *  atoms whose ISO dates fall in the same unit. `'auto'` (default)
     *  lets the renderer pick from visible-window width. Explicit values
     *  give the user direct control via the chart toolbar. Atoms underneath
     *  are unchanged; this only affects render-time bucketing. */
    foldUnit?: import('./fold-atoms.js').FoldUnit;
    metric?: MetricType;
    filters?: Record<string, unknown>;
    groupBy?: string;
    /** Scope for snapshot-style charts (gauges, single-value metrics) where
     * a continuous window doesn't apply but the user still wants to choose
     * the period the snapshot is computed over. e.g. "occupancy today" vs
     * "average occupancy this week." Distinct from `windowDays` because
     * gauges average across the scope rather than rendering one bucket
     * per unit. */
    scope?: ScopePreset;
    /** End-of-window anchor (ISO date `YYYY-MM-DD`). The query window is
     * `windowDays` ending at `asOf`, half-open `[start, end+1d)`. Absent =
     * anchor to "now" (server time at compose moment).
     *
     * Drill-down sets this so clicking "June" from a year-view rendered
     * in November returns June's data, not "30 days ago from now." Phase
     * 4 Streams use this for time-travel: `asOf` becomes the replay
     * cursor across the event log. */
    asOf?: string;
}

/** Named slider positions exposed as toggle pills. Each maps 1:1 to a
 * `windowDays` value via `WINDOW_DAYS_PRESET`. Kept as a string union for
 * type-safety on the toggle UX layer; semantically the system speaks in
 * `windowDays: number | null`. */
export type TimeRangePreset = '7d' | '30d' | '90d' | '180d' | '365d' | 'all';
/** Maps named pill → numeric width. `null` is the all-time sentinel. The
 * single source of truth for "what does each named preset mean as a
 * width." Toggle UI uses this to translate pill clicks to `windowDays`. */
export const WINDOW_DAYS_PRESET: Record<TimeRangePreset, number | null> = {
    '7d': 7, '30d': 30, '90d': 90, '180d': 180, '365d': 365, all: null,
};
export type Granularity = 'day' | 'week' | 'month' | 'quarter';
export type ScopePreset = 'today' | 'week' | 'month';

/** Toggle bound to a GraphQuery field — narrowed re-export of the generic
 * ToggleSpec for callers that want graph-specific type hints. */
export type GraphToggleSpec = ToggleSpec<GraphQuery>;

/** A fully resolved chart directive ready for rendering */
export interface GraphDirective extends ReplayableDirective<GraphQuery> {
    type: GraphType;
    title: string;
    /** Pre-bucketed render data. Legacy field — directives that have NOT
     *  migrated to the atomic foundation still populate this directly.
     *  Migrated directives leave it empty; the renderer folds `atoms`
     *  into visible buckets at render time and ignores `data`. */
    data: ChartData;
    /** Atomic foundation (Phase 5+ of the graph engine). Atoms are the
     *  finest meaningful granularity for this metric — typically one
     *  per day for time-series. The client folds them into visible
     *  buckets via `aggregator` at render time, sized to the available
     *  pixel budget. Continuous fold factor → organic animation when
     *  the user drags the slider or the container resizes.
     *
     *  When `atoms` is present, it is the source of truth. `data` is
     *  ignored. */
    atoms?: import('./fold-atoms.js').Atom[];
    /** How the renderer combines N atoms into one visible bucket. The
     *  Composer picks this per metric (revenue/count → 'sum',
     *  occupancy% → 'wavg', etc.). Defaults to 'sum' when omitted. */
    aggregator?: import('./fold-atoms.js').Aggregator;
    yLabel?: string;
    xLabel?: string;
    series?: string[];
    entityName?: string;
    chartStrategy?: 'merged' | 'separate';
    thresholds?: GraphThreshold[];
    annotations?: GraphAnnotation[];
    colorScheme?: ColorScheme;
    /** Gauge/sparkline: min/max range for scale context */
    range?: { min: number; max: number };
    /** Distribution: fitted gaussian params for bell curve overlay */
    gaussian?: { mean: number; stddev: number };
    /** Original uncompressed point count — enables client-side zoom hinting */
    rawPointCount?: number;
    /** Interaction capabilities resolved by GraphComposer */
    interaction?: InteractionMode;
    /** Legend mode — explains how the chart encodes data values. Defaults to 'auto'
     * (resolved per chart type via `defaultLegendMode`). Set explicitly to override
     * (e.g. force 'none' on a tiny inline chart). */
    legend?: LegendMode;
    /** Display context — drives color intensity and palette selection */
    renderContext?: RenderContext;
    /** Currency formatting for tooltip/hover values */
    currencyConfig?: { currency: string; currencyFormat: 'prefix' | 'suffix' };
    /** Visual style overrides — engine picks sensible defaults per chart type */
    style?: GraphStyle;
    /** Excel-style overlay features (trendline, moving average, threshold,
     *  min/max markers, average line). Catalog-owned: composers attach these
     *  per metric from `AnalyticsMetric.features`. Resolver computes one
     *  `Primitive[]` per feature and stashes the union on
     *  `__featurePrimitives` for the cartesian render path to append. */
    features?: ReadonlyArray<import('./graph-features.types.js').GraphFeature>;
    /** Cartesian-only override for the plot rect insets. The plot rect is the
     * area inside the SVG canvas where marks render; the insets carve out room
     * for axes/labels around it. When omitted, cartesian renderers use the
     * shared `MARGIN` default ({ top: 8, right: 8, bottom: 20, left: 36 }).
     * Ignored by radial/polar/grid families. */
    plotInsets?: { top: number; right: number; bottom: number; left: number };
    // query, toggles, persistKey inherited from ReplayableDirective<GraphQuery>
    // — extends, recompose endpoint, and useDirectiveController all key off them.
    /* CLIENT-RUNTIME fields below — never set by the composer, never
     * serialized. Attached by GraphRender / useDirectiveController /
     * resolveAtomicDirective. */
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
    __foldUnit?: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
    /** Per-atom placement in window-normalized [0,1] coordinates.
     *  When present, families read atoms + placements (foundation-
     *  correct path) instead of pre-folded `data[]`. Indexed parallel
     *  to `chart.atoms`. */
    __placements?: ReadonlyArray<{ xStart: number; xEnd: number; yBase: number; bucketKey: string }>;
    /** Visible y-domain maximum derived from per-bucket stack-tops at
     *  the current fold. */
    __yMax?: number;
    /** Off-window neighbor points — see EdgeNeighbors in
     *  `graph-edge-neighbors.types.ts`. */
    __edgeNeighbors?: import('./graph-edge-neighbors.types.js').EdgeNeighbors;
    /** True when this update came from continuous user input (slider
     *  drag, atomic window patch). The animation engine treats these
     *  as a gesture-continuation — clocks keep running, target
     *  retargets — instead of restarting per directive. */
    __instantUpdate?: boolean;
}

/** Visual style directives — opt-in overrides to engine defaults.
 * `texture` is currently inert (see svg-defs.tsx). Kept on the type so existing
 * directives that set it don't cause type errors, and as the documented hook
 * for re-enabling grain. */
export interface GraphStyle {
    texture?: 'none' | 'grain';
}

/* Server-side composer types (shape classification, metric routing,
 * query context, composed payload) live in `graph-composer-shape.types.ts`
 * and are re-exported here so existing path-qualified importers keep
 * working unchanged. */
import type { MetricType } from './graph-composer-shape.types.js';
export type {
    MetricType,
    DataShapeKind,
    DataShape,
    QueryIntent,
    QueryContext,
    ComposedGraphPayload,
} from './graph-composer-shape.types.js';
