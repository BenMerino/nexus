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
    | 'waterfall' | 'sparkline' | 'treemap' | 'choropleth';

/* Chart data-point shapes live in `graph-data.types.ts`; re-exported so
 * existing `from './graph-composer.types.js'` importers keep working. */
export type {
    GraphDataPoint, StackedGraphDataPoint, HeatmapDataPoint,
    ScatterDataPoint, WaterfallDataPoint, TreemapNode, ChartData,
} from './graph-data.types.js';
import type { ChartData } from './graph-data.types.js';
import type { GraphKpi } from './chart-kpi.types.js';
export type { GraphKpi } from './chart-kpi.types.js';
import type { GraphDirectiveRuntime } from './graph-directive-runtime.types.js';
export type { GraphDirectiveRuntime } from './graph-directive-runtime.types.js';

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
    if (type === 'heatmap' || type === 'choropleth') return 'continuous';
    if (type === 'bubble') return 'size';
    if (type === 'gauge' || type === 'progress-ring' || type === 'sparkline') return 'none';
    return 'categorical';
}

/** Resolve default interaction mode from chart type (shared by server + client) */
export function defaultInteraction(type: string): InteractionMode {
    if (type === 'line' || type === 'multi-line' || type === 'scatter' || type === 'bubble') return { crosshair: 'both', dragRange: true, transitionMs: 80, axes: 'standard' };
    if (type === 'area' || type === 'stacked-area') return { crosshair: 'vertical', dragRange: true, transitionMs: 80, axes: 'standard' };
    if (type === 'heatmap') return { crosshair: 'cell', dragRange: false, transitionMs: 60, axes: 'marginal' };
    if (type === 'choropleth') return { crosshair: 'none', dragRange: false, transitionMs: 60, axes: 'none' };
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
    /** Key→color map binding a color to a category IDENTITY (e.g.
     *  "OpenAlex" always teal) rather than positional palette order.
     *  Resolved by `seriesColorFor`; falls back to `seriesColors` /
     *  positional palette when a key is absent. */
    seriesColorMap?: Record<string, string>;
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
    /** The CALENDAR period this query drilled into. Set ONLY by
     *  `narrowQueryToPeriod`; grammar lives in `graph-drilldown.ts`
     *  (`periodKeyFor`/`periodBounds`): `1900c`, `2020s`, `2024`, `2024-03`,
     *  `2024-03-15`. Absent on an un-drilled query. Presentation identity,
     *  NOT data identity: window moves by any other path must drop it
     *  (`dropStalePeriodKey`), and `streamKeyFromQuery` excludes it so the
     *  same window reached via different paths shares one Stream. */
    periodKey?: string;
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
export type Granularity = 'day' | 'month' | 'year';
export type ScopePreset = 'today' | 'week' | 'month';

/** Toggle bound to a GraphQuery field — narrowed re-export of the generic
 * ToggleSpec for callers that want graph-specific type hints. */
export type GraphToggleSpec = ToggleSpec<GraphQuery>;

/** A fully resolved chart directive ready for rendering */
export interface GraphDirective extends ReplayableDirective<GraphQuery>, GraphDirectiveRuntime {
    type: GraphType;
    title: string;
    /** Optional KPI headline rendered ABOVE the chart: a large figure with
     *  an uppercase caption and an optional rising/flat/falling trend chip.
     *  Off by default. Two governed sources, split on the authoritative-vs-
     *  cosmetic line (ANTI_PATTERNS §1):
     *
     *   • `reduce` — a COSMETIC reduction of the plotted series (mean/sum/
     *     slope/…). The engine derives the figure from the chart's own
     *     `__buckets` in `resolveAtomicDirective`, so it recomputes on
     *     window/fold and can never drift from what's on screen. Use for
     *     view-local headlines ("avg/year", "total visible").
     *   • `figure` — an AUTHORITATIVE value the composer owns server-side
     *     (a "score", a booked revenue total). Pre-formatted, presented
     *     as-is; never re-derived client-side.
     *
     *  `trend.auto` classifies the reduction's slope into rising/flat/
     *  falling (cosmetic path only). `trend` literal sets it explicitly. */
    /** Optional KPI headline rendered ABOVE the chart. See `GraphKpi`. */
    kpi?: GraphKpi;
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
    /** Choropleth: world geometry keyed by ISO-alpha2 — `{ [iso2]: { name,
     *  rings } }`, rings = arrays of [lon,lat]. Injected by the host (not the
     *  composer) so directives stay data-light; the geo family projects it. */
    geo?: Record<string, { name: string; rings: number[][][] }>;
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
    /** Render a numeric label above each (decimated) point/bar. Off by
     *  default; rides the axis decimator so labels never collide. */
    valueLabels?: boolean;
    /** Suppress the in-chart title text in the header row. For hosts that
     *  render their own heading around the chart (a card/panel title), so the
     *  title isn't shown twice. The header row's toggles/feature controls/live
     *  badge still render; only the title text is hidden. Off by default. */
    hideTitle?: boolean;
    /** Drop the 1px frame the renderer rings around the plot+axes. For hosts
     *  that already wrap the chart in a bordered card, where the plot frame is
     *  a redundant border-inside-a-border. Off by default. */
    hideFrame?: boolean;
    /** Chart-wide RAW style override — bypasses the semantic status→style
     *  table for pure-aesthetic callers (a dashed target line, brand
     *  styling). Per-bucket variation goes through atom `status` /
     *  `statusOverrides`, both of which fold; this is index-free. */
    presentation?: { dash?: [number, number]; markers?: 'filled' | 'hollow' | 'none' };
    /** Ad-hoc per-bucket status override, applied AFTER folding by folded
     *  bucket index or bucketKey. Escape hatch so a human can force e.g.
     *  the last bucket 'partial' without touching atoms. Composer-set
     *  status on atoms is the normal path. */
    statusOverrides?: {
        byIndex?: Record<number, import('./fold-atoms.js').DatumStatus>;
        byKey?: Record<string, import('./fold-atoms.js').DatumStatus>;
    };
    /** Display order of legend chips by series key. Keys absent here
     *  append in natural order. Does NOT change data keying — chip order
     *  only; color stays bound to the original series index/identity. */
    legendOrder?: string[];
    /** Display-name overrides for legend chips, keyed by series key. */
    legendLabels?: Record<string, string>;
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
    // Client-runtime fields (activeSeries, seriesWeights, __buckets, …) are
    // mixed in via `GraphDirectiveRuntime` — see graph-directive-runtime.types.ts.
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
