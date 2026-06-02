/* ── Chart Data Shapes (@nexus/shared) ───────────────────────
 * The per-chart-type data-point shapes a `GraphDirective` may carry in its
 * `data[]`. The CANONICAL home — shared between the frontend (apps/web render
 * engine) and the backend Composer (apps/api), which both speak this data
 * vocabulary. Pure type interfaces, zero runtime, zero deps → safe to import
 * from either app with no build-time dependency. `apps/web/architect/
 * graph-data.types.ts` re-exports these for back-compat (so existing importers
 * are unchanged); the directive/query/composer types stay app-side.
 * ──────────────────────────────────────────────────────────── */

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
