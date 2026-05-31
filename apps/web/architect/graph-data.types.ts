/* ── Chart Data Shapes ───────────────────────────────────────
 * The per-chart-type data-point shapes a `GraphDirective` may carry in
 * its `data[]`. Split from `graph-composer.types.ts` (which holds the
 * directive, query, and composer types) so the data vocabulary is its
 * own concern. Re-exported there for back-compat.
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
